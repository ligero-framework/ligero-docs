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

### Why can't the JDK engine do it — and why don't we write our own?

A common question: *doesn't "pure Java" support HTTP/2 and WebSockets?* The
answer splits by **client vs. server**:

| | HTTP/2 | WebSockets |
|---|:--:|:--:|
| JDK — **client** (`java.net.http.*`) | ✓ | ✓ |
| JDK — **server** (`com.sun.net.httpserver`) | ✗ | ✗ |

So Java *does* ship an HTTP/2 and a WebSocket **client**, but its built-in
**server** — the one the zero-dependency engine wraps — speaks HTTP/1.1 only and
has no WebSocket support. (Raw TCP `Socket`/`ServerSocket` exist, of course; a
*WebSocket server* — the protocol layered over HTTP — does not.)

The deeper point: **our JDK engine doesn't implement HTTP at all** — it's a thin
wrapper that delegates the protocol to `com.sun.net.httpserver`, so it inherits
that class's limits. **Jetty doesn't use that class**; it reads raw bytes off
NIO channels and implements the protocols itself. That's the whole difference —
not "Jetty can and we can't," but "Jetty wrote a full HTTP stack; we reused the
JDK's."

Could we ship our own HTTP/2 engine module? Technically yes — but HTTP/2 means
implementing, from raw sockets up:

- **ALPN** negotiation in the TLS handshake (this part the JDK *does* provide, via `SSLEngine` since Java 9),
- the **binary framing** layer (`HEADERS`/`DATA`/`SETTINGS`/`WINDOW_UPDATE`/… and a per-stream state machine),
- **stream multiplexing** over one connection,
- **HPACK** header compression (RFC 7541 — stateful, and a classic source of compression-bomb CVEs),
- per-stream and per-connection **flow control**.

That's thousands of lines of spec-sensitive, security-critical code with
perpetual maintenance — exactly the kind of heavy component the *lightweight*
core is meant to avoid. The `ServerEngine` SPI exists precisely so we **don't**
reimplement a production HTTP/2 stack: the JDK engine stays zero-dependency for
the HTTP/1.1 fast path, and you swap in Jetty's battle-tested implementation only
when you actually need HTTP/2 or WebSockets.

> **Virtual threads** would let you write an HTTP/2 server in a blocking,
> one-virtual-thread-per-stream style instead of a classic NIO event loop — a
> nice fit for multiplexing — but you'd still have to implement framing, HPACK
> and flow control. Loom simplifies the concurrency, not the protocol.

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
