---
sidebar_position: 2
---

# Typed controllers

Lambdas (`app.get("/x", ctx -> ...)`) are great for a handful of routes. As an
API grows they start to read like a script: every handler pulls strings out of
`ctx`, parses them by hand, and pushes a response back in. **Typed
controllers** give the same routes a structure the compiler understands — an
endpoint is a method, its inputs are typed parameters and its output is the
return type.

:::info Availability
Typed controllers need a Ligero release that includes the `com.ligero.web`
package (the release after 0.7.0) and the matching `ligero-processor`.
:::

## The same endpoint, both ways

```java title="Lambda style"
app.get("/api/products/{id}", ctx -> {
    long id = ctx.pathParamAsLong("id");
    ctx.json(products.get(id));
});

app.post("/api/products", ctx -> {
    NewProduct body = ctx.bodyValidator(NewProduct.class)
        .check(p -> p.name() != null && !p.name().isBlank(), "name is required")
        .get();
    Product created = products.create(body);
    ctx.status(201).header("Location", "/api/products/" + created.id()).json(created);
});
```

```java title="Typed controller"
@Controller("/api/products")
public final class ProductController {

    private final ProductService products;

    public ProductController(ProductService products) {
        this.products = products;
    }

    @Get("/{id}")
    Product get(@PathParam long id) {
        return products.get(id);
    }

    @Post
    Response<Product> create(@Body @Valid NewProduct body) {
        Product created = products.create(body);
        return Response.created("/api/products/" + created.id(), created);
    }
}
```

The second version states its contract in the signature, can be unit-tested by
calling the method, and cannot forget to parse a parameter or send a response.

## Setup

Add the annotation processor and install the generated modules:

```groovy
dependencies {
    implementation      'com.ligeroframework:ligero-core:0.5.0'
    annotationProcessor 'com.ligeroframework:ligero-processor:0.5.0'
}
```

```java
Ligero app = Ligero.create(8080);
Modules.install(app, GeneratedModules.all());   // beans wired, routes mounted
app.start();
```

Using [explicit wiring](dependency-injection.md) instead? Keep your module and
mount the generated routes class yourself:

```java
@Override
public void routes(Ligero app, Beans beans) {
    ProductControllerRoutes.mount(app, beans.get(ProductController.class));
}
```

With the CLI: `ligero new my-api --controllers typed`.

## Routes

| Annotation | Maps to |
|---|---|
| `@Get`, `@Post`, `@Put`, `@Patch`, `@Delete` | that HTTP method |
| `@Route(method = "QUERY", path = "/search")` | any other method (`HEAD`, `OPTIONS`, [`QUERY`](query.md), ...) |

The path is appended to the prefix on `@Controller("/api/products")` and uses
the [router's syntax](routing.md): `{name}` segments and a trailing `*name`
wildcard. `@Get` with no path maps the prefix itself.

## Inputs

| Parameter | Bound from | When absent |
|---|---|---|
| `@PathParam long id` | the `{id}` segment | — (always present) |
| `@QueryParam int page` | `?page=` | `400` — primitives are required |
| `@QueryParam(defaultValue = "1") int page` | `?page=` | `1` |
| `@QueryParam String q` | `?q=` | `null` — reference types are optional |
| `@QueryParam("tag") List<String> tags` | every `?tag=` | empty list |
| `@HeaderParam("X-Tenant") String tenant` | the header | `null` |
| `@Body NewProduct body` | the JSON body | `400` |
| `@Body String raw` / `@Body byte[] raw` | the raw body | empty |
| `Context ctx` | the request context | — |

Names default to the Java parameter name (`@PathParam long id` reads `{id}`).

**Conversions** are available for `String`, `int`, `long`, `double`,
`boolean` (and their boxed forms), `UUID`, `BigDecimal` and any `enum`
(matched case-insensitively). A value that does not convert answers `400` and
names the parameter — without echoing the offending input:

```json
{"status":400,"error":"Path parameter 'id' must be an integer"}
```

### Validation

Add `ligero-validation` and mark the body `@Valid`; constraint annotations on
the record are enforced before your method runs, and every violation is
reported in one `400`:

```java
record NewProduct(@NotBlank String name, @Positive BigDecimal price) {}

@Post
Product create(@Body @Valid NewProduct body) { ... }
```

If a controller uses `@Valid` and no validator is on the classpath, the app
refuses to start — you find out at boot, not on the first request.

## Outputs

| Return type | Response |
|---|---|
| a record, `List`, `Map`, any object | JSON, `200` |
| `String` | `text/plain`, `200` |
| `Optional<T>` | the value — or `404` when empty |
| `void` (or `null`) | `204 No Content` |
| `byte[]` | `application/octet-stream` |
| `Response<T>` | whatever status and headers you set |

Fixed status? Annotate the method:

```java
@Post
@Status(201)
Product create(@Body NewProduct body) { ... }
```

Decided at runtime? Return a `Response`:

```java
@Put("/{id}")
Response<Product> upsert(@PathParam long id, @Body NewProduct body) {
    boolean existed = products.exists(id);
    Product saved = products.save(id, body);
    return existed ? Response.ok(saved) : Response.created("/api/products/" + id, saved);
}
```

`Response` has `ok`, `created`, `accepted`, `noContent`, `status(int)`,
`of(int, body)` and `.header(name, value)`.

Errors work exactly as everywhere else: throw an
[`HttpException`](error-handling.md) (`NotFoundException`,
`BadRequestException`, ...) or let a registered exception handler map your own.

## Escape hatch

Take a `Context` when you need something the annotations do not cover —
cookies, streaming, [SSE](realtime.md), redirects. If the method writes the
response itself, the return value is ignored:

```java
@Get("/export")
void export(Context ctx, @QueryParam(defaultValue = "csv") String format) {
    ctx.header("Content-Disposition", "attachment; filename=\"products." + format + "\"");
    ctx.text(products.export(format));
}
```

## What actually runs

There is no reflection and no classpath scanning. The annotations have
`SOURCE` retention — they do not exist at runtime. While compiling,
`ligero-processor` writes a `ProductControllerRoutes` class next to your
controller:

```java title="build/generated/.../ProductControllerRoutes.java"
public static void mount(Ligero app, ProductController controller) {
    app.route("GET", "/api/products/{id}", ctx -> {
        Object result = controller.get(
            Binding.toLong(Binding.required(ctx.pathParam("id"), "path parameter", "id"), "path parameter", "id"));
        ctx.respond(result);
    });
    // ...
}
```

That is the same code you would write by hand, so typed controllers cost
nothing at runtime, show up in a debugger as ordinary calls, and compile to a
[native image](native-image.md) without extra configuration.

## Compile-time checks

Because the processor sees your code, these are **build errors**, not bugs
found in production:

| Mistake | Error |
|---|---|
| `@PathParam long userId` on a route with `{id}` | the route has no `{userId}` segment |
| a parameter with no annotation | say where this parameter comes from |
| `@QueryParam Instant when` | unsupported parameter type |
| `@Body List<Item> items` | wrap generic payloads in a record |
| a `private` or `static` route method | route methods must be non-private instance methods |
| `@Get` in a class without `@Controller` | only works inside a `@Controller` class |
| two verb annotations on one method | keep one, or split the method |

## Mixing styles

Typed controllers and lambdas register into the same router. Keep health
checks and one-off endpoints as lambdas, move resource-shaped APIs to
controllers, and migrate one class at a time — a controller may even keep a
`register(Ligero app)` method alongside its annotated ones.
