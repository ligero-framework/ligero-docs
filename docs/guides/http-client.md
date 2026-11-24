---
sidebar_position: 8
---

# HTTP client

:::note Availability
Ships in the release after 0.8.0.
:::

`ligero-http-client` calls other HTTP APIs, on the JDK's own
`java.net.http` client — no extra dependency.

```groovy
implementation 'com.ligeroframework:ligero-http-client:<version>'
```

## Fluent calls

```java
RestClient catalog = RestClient.builder()
    .baseUrl("https://catalog.internal/api")
    .header("Authorization", "Bearer " + token)
    .timeout(Duration.ofSeconds(5))
    .build();

Product product = catalog.get("/products/{id}", 42).retrieve(Product.class);
List<Product> cheap = catalog.get("/products").query("maxPrice", 10).retrieveList(Product.class);
Optional<Product> maybe = catalog.get("/products/{id}", 7).retrieveOptional(Product.class); // 404 -> empty
Product created = catalog.post("/products").body(new NewProduct("Mouse", 25)).retrieve(Product.class);
catalog.delete("/products/{id}", 42).send();
```

| Finish with | Returns |
|---|---|
| `retrieve(Type.class)` | the JSON body as `Type` (`String` and `byte[]` as they are) |
| `retrieveList(Type.class)` | a JSON array as `List<Type>` |
| `retrieveOptional(Type.class)` | `Optional.empty()` on `404` |
| `retrieveString()` | the body as text |
| `send()` | nothing; fails on a non-2xx status |
| `execute()` | the `ClientResponse`, whatever its status |

Bodies: an object is sent as JSON, a `String` as text, a `byte[]` as is,
`form(map)` as an HTML form. Each `{placeholder}` takes the next path value,
percent-encoded as **one** segment: `"../admin"` becomes `..%2Fadmin`, so a
value can never add segments to the URL.

## Declarative clients

Describe the API as an interface, with the same annotations as
[typed controllers](controllers.md):

```java
@ClientApi("/api/products")
public interface ProductsApi {

    @Get("/{id}")
    Optional<Product> find(@PathParam long id);

    @Get
    List<Product> search(@QueryParam String name, @HeaderParam("X-Tenant") String tenant);

    @Post
    Product create(@Body NewProduct product);

    @Delete("/{id}")
    void delete(@PathParam long id);
}
```

With `ligero-processor` on the annotation processor path, the compiler
writes `ProductsApiClient` — plain code, no proxies or reflection:

```java
ProductsApi products = new ProductsApiClient(catalog);
products.find(42).ifPresent(System.out::println);
```

Return types: `void`, a class or record, `String`, `byte[]`,
`Optional<T>`, `List<T>`, `Set<T>`, primitives, and `ClientResponse` for the
raw response. A path parameter the path does not have, a parameter without an
annotation or an unsupported return type is a compile error. Default methods
are left as you wrote them.

## Errors

| What happened | Exception |
|---|---|
| Status other than 2xx | `HttpStatusException`: `status()`, `response()`, `problem()` |
| Connection refused, timeout, response too large | `RestClientException` |
| Address refused by the filter | `BlockedAddressException` |

When the server answers with an RFC 9457 problem — as Ligero does with
`app.problemDetails(true)` — `e.problem()` gives you its type, title, detail
and extension members.

Combine with [resilience](resilience.md) for retries and circuit breaking:

```java
Product product = Retry.of(3, Duration.ofMillis(200)).exponential()
    .call(() -> catalog.get("/products/{id}", id).retrieve(Product.class));
```

## Server-side request forgery (SSRF)

If the URLs come from users — webhooks, "import from URL", avatar links — an
attacker can point them at your internal network: the cloud metadata service
at `169.254.169.254`, an admin port on `localhost`, a database at `10.0.0.5`.

```java
RestClient webhooks = RestClient.builder()
    .addressFilter(AddressFilter.publicOnly())
    .build();
```

`publicOnly()` refuses loopback, private, link-local (which includes cloud
metadata), carrier-grade NAT, multicast and reserved addresses, and the IPv6
forms that hide them (`::ffff:10.0.0.1`, NAT64, 6to4). Every address a host
resolves to is checked, and so is every redirect. Exceptions are explicit:
`.allow("10.20.0.7")`, `.deny("203.0.113.0/24")`.

:::caution
The check resolves the name and then the JDK client resolves it again; a DNS
server that answers differently the second time (DNS rebinding) could slip
through. For URLs straight from untrusted users, also restrict outbound
traffic at the network level.
:::

## Defaults

| Setting | Default |
|---|---|
| Connect timeout | 5 s (`connectTimeout`) |
| Request timeout | 30 s (`timeout`, or per request) |
| Redirects followed | 5 (`maxRedirects`; `0` returns them) |
| Largest response | 10 MiB (`maxResponseBytes`) |
| Address filter | `allowAll()` |

Redirects are followed by the client itself: a `303` (or a `301`/`302` after
a `POST`) becomes a `GET`, and `Authorization` and `Cookie` are dropped when a
redirect leaves the original host. Non-HTTP schemes are refused.
