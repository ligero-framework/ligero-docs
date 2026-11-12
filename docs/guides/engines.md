---
sidebar_position: 12
---

# Server Engines

The core never instantiates a server. Engines implement the `ServerEngine` SPI
and are discovered via `ServiceLoader` — switching engines is a dependency
swap, zero code changes:

```groovy
// default: JDK built-in server on virtual threads
runtimeOnly 'com.ligeroframework:ligero-server-jdk:0.5.0'

// or: Ligero's own server — fastest, WebSockets, still zero dependencies
runtimeOnly 'com.ligeroframework:ligero-server-loom:0.5.0'

// or: Jetty 12 (WebSockets and HTTP/2)
runtimeOnly 'com.ligeroframework:ligero-server-jetty:0.5.0'
```

| | `ligero-server-jdk` | `ligero-server-loom` | `ligero-server-jetty` |
|---|---|---|---|
| HTTP implementation | the JDK's `com.sun.net.httpserver` | Ligero's own | Jetty 12 core |
| Dependencies | none | none | Jetty |
| Virtual threads | ✓ | ✓ (plus dedicated threads) | ✓ |
| gzip | ✓ | ✓ | ✓ (GzipHandler) |
| WebSockets | ✗ (fails fast with guidance) | ✓ | ✓ |
| HTTP/2 | ✗ | ✗ | ✓ (h2c) |
| Throughput (same app, same machine) | 1× | ~4.5× | ~1.2× |

All engines give the same behavior for routing, errors, body limits,
redirects and headers.

## The Loom engine

:::info Availability
`ligero-server-loom` ships in the release after 0.7.0.
:::

`ligero-server-loom` is Ligero's own HTTP server. It does not wrap the JDK's
server or Jetty: it reads and writes HTTP/1.1 and WebSockets directly on
sockets, in a few small classes with no dependencies.

**How it is fast.** A connection is a simple loop on its own thread — read a
request, run your pipeline, write the response — with plain blocking I/O.
Nothing is handed between threads, so there is no dispatcher to queue behind;
requests are parsed straight from a per-connection buffer and a response is
normally a single write. The first 256 concurrent connections each get a
dedicated platform thread, which the kernel wakes directly when bytes arrive;
connections beyond that run on virtual threads, so tens of thousands of mostly
idle keep-alive connections stay cheap.

In the framework's [benchmark](../reference/benchmarks.md) (same products API,
32 connections, 4 CPUs) it served about 162,000 requests/s overall, against
57,000 for Javalin and 27,000 for Spring Boot. With far more *busy*
connections than dedicated threads the lead narrows; raise the budget if that
is your workload:

```java
app.engine(new LoomServerEngine(LoomServerEngine.Limits.defaults().withDedicatedThreads(1024)));
```

**What it supports.** Keep-alive and pipelining, chunked request bodies,
streaming responses ([SSE](realtime.md)), `Expect: 100-continue`, `HEAD`,
gzip, graceful shutdown, and [WebSockets](realtime.md) — handshake with the
same origin check as the Jetty engine, fragmented messages, ping/pong and
close codes.

**What it refuses.** A server that guesses at malformed input is how request
smuggling and resource exhaustion happen, so the engine is strict:

| Input | Answer |
|---|---|
| `Content-Length` together with `Transfer-Encoding` | `400` |
| two different `Content-Length` values, or one that is not plain digits | `400` |
| a transfer coding other than `chunked` | `501` |
| folded header lines, whitespace before the colon, control characters | `400` |
| missing or repeated `Host` (HTTP/1.1) | `400` |
| request head over 16 KiB or more than 100 headers | `431` |
| body over `maxBodyBytes` (declared or chunked) | `413` |
| a request head that takes more than 10 s to arrive | `408` |
| more than 20,000 concurrent connections | refused |

On the way out, header names and values are validated — user input placed in
a header cannot inject another header or a second response — and the
`Content-Length` / `Transfer-Encoding` headers always come from the engine.

**What it does not do.** TLS and HTTP/2. Terminate both at your reverse proxy
or load balancer (the usual production setup), or use the Jetty engine for
h2c.

The limits are configurable through `LoomServerEngine.Limits`.

## HTTP/2

The JDK and Loom engines speak **HTTP/1.1 only**. For HTTP/2, use the
**Jetty engine**:
it carries an HTTP/1.1 and an HTTP/2 cleartext (**h2c**) connection factory on
the same port, so h2c-capable clients negotiate HTTP/2 (via upgrade or prior
knowledge) and HTTP/1.1 clients are unaffected — no code change, just the
dependency swap above.

```java
// Java's HttpClient asks for HTTP/2 and gets it:
HttpClient.newBuilder().version(HttpClient.Version.HTTP_2).build();
```

### Why can't the JDK engine do it — and why not write our own HTTP/2?

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

The deeper point: **the JDK engine doesn't implement HTTP at all** — it's a thin
wrapper that delegates the protocol to `com.sun.net.httpserver`, so it inherits
that class's limits. The **Loom engine** and **Jetty** don't use that class;
they read raw bytes off sockets and implement the protocol themselves, which
is why both can offer WebSockets.

Could we ship our own HTTP/2 engine module? Technically yes — but HTTP/2 means
implementing, from raw sockets up:

- **ALPN** negotiation in the TLS handshake (this part the JDK *does* provide, via `SSLEngine` since Java 9),
- the **binary framing** layer (`HEADERS`/`DATA`/`SETTINGS`/`WINDOW_UPDATE`/… and a per-stream state machine),
- **stream multiplexing** over one connection,
- **HPACK** header compression (RFC 7541 — stateful, and a classic source of compression-bomb CVEs),
- per-stream and per-connection **flow control**.

That's thousands of lines of spec-sensitive, security-critical code with
perpetual maintenance — a very different size of problem from HTTP/1.1, which
the Loom engine implements in a few hundred lines. The `ServerEngine` SPI
exists precisely so we **don't** have to reimplement a production HTTP/2
stack: use the Loom engine for the HTTP/1.1 fast path, and swap in Jetty's
battle-tested implementation when you actually need HTTP/2.

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
