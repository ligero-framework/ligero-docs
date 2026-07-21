---
sidebar_position: 5
---

# The HTTP QUERY method

The [HTTP `QUERY` method](https://datatracker.ietf.org/doc/draft-ietf-httpbis-safe-method-w-body/)
is a **safe, idempotent** method — like `GET` — but with a **request body**. Use
it when a read is driven by input too large or too structured to fit in a URL: a
faceted search, a filter object, a GraphQL-style read. Unlike `POST`, a `QUERY`
is not supposed to change server state, so caches and clients can treat it like a
read.

## Quick start

```java
var app = new Ligero();

app.query("/search", ctx -> {
    // read the body just like a POST
    SearchFilter filter = ctx.body(SearchFilter.class);
    return ctx.json(products.search(filter));
});

app.start();
```

```bash
curl -X QUERY http://localhost:8080/search \
  -H 'Content-Type: application/json' \
  -d '{"text":"laptop","maxPrice":1500,"tags":["gaming","16gb"]}'
```

`app.query(path, handler)` registers the route; inside the handler you read the
body with `ctx.body(Type.class)` / `ctx.bodyAsString()` exactly as for `POST`.
It is also available inside a route group:

```java
app.group("/catalog", api -> {
    api.query("/search", ctx -> ctx.json(catalog.search(ctx.body(Filter.class))));
});
```

## Why QUERY instead of GET or POST

| | `GET` | `POST` | **`QUERY`** |
|---|---|---|---|
| Request body | ✗ | ✓ | ✓ |
| Safe / idempotent | ✓ | ✗ | ✓ |
| Cacheable | ✓ | rarely | ✓ (by design) |

A long search encoded in the query string bumps into URL length limits and is
awkward to build; `POST /search` works but lies about semantics (it looks like a
write). `QUERY` says exactly what it is: a **read with a body**.

## Notes

- **Engines** — no configuration needed. The router accepts the method and the
  built-in JDK engine (`ligero-server-jdk`) and the Jetty engine both pass it
  through, body included.
- **CORS** — the default `CorsMiddleware` allow-list does not include `QUERY`.
  If you expose a QUERY endpoint cross-origin, add it explicitly:

  ```java
  app.use(CorsMiddleware.builder().allowMethods("GET", "QUERY").build());
  ```
- **Client support** — `QUERY` is an IETF draft. `java.net.http.HttpClient`,
  `curl` and most HTTP tooling can send it today; some browsers/proxies may not
  yet. Keep a `POST` fallback if you need universal reach.
