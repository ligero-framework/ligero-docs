---
sidebar_position: 12
---

# Server Engines

The core never instantiates a server. Engines implement the `ServerEngine` SPI
and are discovered via `ServiceLoader` — switching engines is a dependency
swap, zero code changes:

```groovy
// default: JDK built-in server on virtual threads
runtimeOnly 'com.ligero:ligero-server-jdk:0.2.0-SNAPSHOT'

// or: Jetty 12 (adds WebSocket support)
runtimeOnly 'com.ligero:ligero-server-jetty:0.2.0-SNAPSHOT'
```

| | `ligero-server-jdk` | `ligero-server-jetty` |
|---|---|---|
| Dependencies | none (JDK) | Jetty 12 core |
| Virtual threads | ✓ | ✓ |
| gzip | ✓ | ✓ (GzipHandler) |
| WebSockets | ✗ (fails fast with guidance) | ✓ |
| HTTP/2 | ✗ (`com.sun.net.httpserver` is HTTP/1.1 only) | ✓ (h2c) |

Both engines run the framework's full integration suite — same behavior for
routing, errors, body limits, redirects and headers.

## HTTP/2

The default JDK engine speaks **HTTP/1.1 only** — that's a limitation of
`com.sun.net.httpserver`, not of Ligero. For HTTP/2, use the **Jetty engine**:
it carries an HTTP/1.1 and an HTTP/2 cleartext (**h2c**) connection factory on
the same port, so h2c-capable clients negotiate HTTP/2 (via upgrade or prior
knowledge) and HTTP/1.1 clients are unaffected — no code change, just the
dependency swap above.

```java
// Java's HttpClient asks for HTTP/2 and gets it:
HttpClient.newBuilder().version(HttpClient.Version.HTTP_2).build();
```

## Writing an engine

Implement three methods and register the class in
`META-INF/services/com.ligero.spi.ServerEngine`:

```java
public interface ServerEngine {
    void start(EngineConfig config, HttpHandler rootHandler) throws IOException;
    void stop(Duration grace);
    int port();
}
```

Your adapter maps the native request/response to `HttpRequest`/`HttpResponse`
(case-insensitive headers, body limit enforcement, committed-state tracking)
and calls `rootHandler.handle(request, response)` per request. Use the Jetty
adapter as a reference implementation — it is ~400 lines including WebSockets.

For tests, inject an engine explicitly: `app.engine(new MyEngine())`.
