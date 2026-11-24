---
sidebar_position: 7
---

# API versioning

:::note Availability
Ships in the release after 0.8.0.
:::

An API that other teams or apps depend on has to change without breaking
them. `ApiVersioning` lets clients say which version they speak, refuses
versions you no longer serve, and warns them before a version goes away.

## Choosing where the version comes from

```java
app.use(ApiVersioning.builder()
    .header("API-Version")          // API-Version: 2
    .supported("1", "2")
    .defaultVersion("2")            // requests without a version get 2
    .build());
```

| Source | Request | Builder |
|---|---|---|
| Header | `API-Version: 2` | `.header("API-Version")` |
| Query parameter | `/products?version=2` | `.queryParam("version")` |
| Path segment | `/v2/products` | `.pathSegment(0)` |
| Media type parameter | `Accept: application/vnd.shop+json;version=2` | `.mediaTypeParameter("version")` |

You can list several sources; the first one that carries a version wins.
With the path strategy, the routes contain the segment
(`app.group("/v2", ...)`). Versions are `major[.minor[.patch]]`, with or
without a leading `v`; `2` and `2.0` are the same version.

Without `defaultVersion`, a request may name no version (`ctx.apiVersion()`
is `null`); add `.required()` to refuse those.

## One route, one handler per version

```java
app.get("/products", ApiVersioning.handlers()
    .version("1", ctx -> ctx.json(catalog.allV1()))
    .version("2+", ctx -> ctx.json(catalog.all()))    // 2, 3, 4 ... until a newer handler exists
    .otherwise(ctx -> ctx.json(catalog.all()))        // optional: no version at all
    .build());
```

`"2"` serves exactly version 2; `"2+"` serves 2 and every later version
without a more specific handler. A version with no handler on that route is a
`404` problem ("not available in API version 1").

## Typed controllers

```java
@Controller("/api/products")
public class ProductController {

    @Get("/{id}") @ApiVersion("1")
    ProductV1 getV1(@PathParam long id) { ... }

    @Get("/{id}") @ApiVersion("2+")
    Product get(@PathParam long id) { ... }
}
```

`ligero-processor` turns methods that share a verb and path into one
dispatching route at compile time. A method without `@ApiVersion` on that
route serves the requests no other method covers. `@ApiVersion` on the class
is the default for its methods. Two methods for the same version, or a
malformed version, are compile errors.

## Deprecating a version

```java
.deprecate("1", ApiVersioning.Deprecation.since(Instant.parse("2026-06-01T00:00:00Z"))
    .sunset(Instant.parse("2027-01-01T00:00:00Z"))
    .link("https://example.com/docs/migrate-to-v2"))
```

Requests for version 1 keep working, and their responses carry:

```http
Deprecation: @1780272000
Sunset: Fri, 1 Jan 2027 00:00:00 GMT
Link: <https://example.com/docs/migrate-to-v2>; rel="deprecation"; type="text/html"
```

These are the standard headers ([RFC 9745](https://www.rfc-editor.org/rfc/rfc9745),
[RFC 8594](https://www.rfc-editor.org/rfc/rfc8594)), so API gateways and
client libraries can warn about them.

## Errors

| Case | Response |
|---|---|
| Unsupported version (`API-Version: 9`) | `400`, title "Unsupported API version", with a `supported` list |
| Malformed (`API-Version: two`) | `400`, title "Malformed API version" |
| Missing, with `.required()` | `400`, title "API version required" |

All three are RFC 9457 problems (`application/problem+json`), see
[Error handling](error-handling.md#problem-details). With the header or media
type strategy, responses also carry `Vary`, so caches keep the versions
apart.

## Calling a versioned API

```java
RestClient catalog = RestClient.builder()
    .baseUrl("https://catalog.internal")
    .apiVersion("API-Version", "2")
    .build();
```

See [HTTP client](http-client.md).
