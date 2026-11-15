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
| HTTPS (TLS) | ✗ | ✓ (TLS 1.3 / 1.2, safe suites only) | ✗ (not wired) |
| HTTP/2 | ✗ | ✓ (over TLS, and cleartext) | ✓ (cleartext h2c) |
| WebSockets | ✗ (fails fast with guidance) | ✓ text, binary, compressed | ✓ text, binary |
| Compression | gzip | gzip + Brotli, also for streams | gzip |
| Request body streaming | ✗ (buffered) | ✓ | ✗ (buffered) |
| Slow-client protection | partial | head, body and write deadlines | Jetty's |
| Per-address connection limit | ✗ | ✓ | ✗ |
| Throughput (same app, same machine) | 1× | 2–4.5× | ~1.2× |

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

**What it supports.** HTTP/1.1 with keep-alive and pipelining, **HTTP/2**,
**HTTPS**, chunked and streamed request bodies, streaming responses
([SSE](realtime.md)), `Expect: 100-continue`, `HEAD`, gzip and Brotli,
graceful shutdown, and [WebSockets](realtime.md) — text and binary, with
`permessage-deflate` compression and the same origin check as the Jetty engine.

### HTTPS

TLS comes from the JDK itself; nothing to add to the build. Point the engine
at a certificate with two environment variables —

```bash
LIGERO_TLS_CERT=/etc/letsencrypt/live/example.com/fullchain.pem
LIGERO_TLS_KEY=/etc/letsencrypt/live/example.com/privkey.pem
```

— or in code:

```java
Tls tls = Tls.fromPem(Path.of("fullchain.pem"), Path.of("privkey.pem"));   // or Tls.fromKeyStore(path, password)
app.engine(new LoomServerEngine(LoomServerEngine.Limits.defaults(), tls));
```

Only what is considered safe today is negotiated: TLS 1.3 and TLS 1.2, and
for 1.2 only forward-secret key exchange with authenticated encryption
(ECDHE + AES-GCM / ChaCha20). The key must be an unencrypted PKCS#8 PEM
(`-----BEGIN PRIVATE KEY-----`) or live in a PKCS#12 keystore
(`LIGERO_TLS_KEYSTORE` / `LIGERO_TLS_KEYSTORE_PASSWORD`). Renewed certificate
files are picked up within seconds, without a restart; if a renewal cannot be
loaded the previous certificate stays in force and a warning is logged. Add
HSTS with
[`SecurityHeadersMiddleware`](security.md).

### HTTP/2

With TLS on, browsers and clients negotiate HTTP/2 automatically (ALPN);
HTTP/1.1 clients keep working on the same port. Without TLS, clients that
start with the HTTP/2 preface ("prior knowledge", e.g. gRPC-style internal
traffic or `curl --http2-prior-knowledge`) are served as HTTP/2 too. Your
handlers do not change: `ctx.req().getProtocol()` says `HTTP/2.0`.

HTTP/2 gives a client many ways to make a server work for nothing, and each
is bounded:

| Attack | Defence |
|---|---|
| Rapid reset (open a stream, cancel it, repeat — CVE-2023-44487) | a cancelled stream keeps its slot until its handler has returned, and resets are rate limited |
| CONTINUATION flood (a header block that never ends) | header blocks are capped while they are still arriving |
| PING / SETTINGS / empty-frame floods | control frames are rate limited |
| HPACK bombs (tiny block, huge header list) | the decoded size is bounded during decoding |
| Slow or stuck receivers | responses wait for the client's window with a deadline |
| Unread uploads | the client is only granted more window as the application consumes the body |

Malformed requests — upper-case or connection-specific fields, misplaced
pseudo-headers, a body that disagrees with `content-length` — are refused
rather than repaired, which is what keeps HTTP/2 from being used to smuggle
requests. Concurrent requests per connection default to 100
(`Limits.withMaxConcurrentStreams`).

### Compression

Switch it on with `gzip(true)` (or `LIGERO_GZIP=true`). Text, JSON, XML,
JavaScript and SVG are compressed; images, video and archives — already
compressed — are left alone. Streamed responses are compressed as well, and
`flush()` still delivers immediately, so Server-Sent Events work compressed.

For **Brotli** — Google's codec, typically 15–25 % smaller than gzip — add one
dependency; it is preferred whenever the client accepts it and falls back to
gzip otherwise:

```groovy
runtimeOnly 'com.ligeroframework:ligero-compress-brotli:0.5.0'
```

:::caution
Do not compress responses that mix secrets (CSRF tokens, session data) with
text an attacker can influence in the same body: the compressed size can leak
the secret (the BREACH attack). Leave compression off for those routes.
:::

### Large uploads

`ctx.body(...)` and `ctx.bodyAsBytes()` hold the whole body in memory.
For big uploads read it as a stream instead — memory stays constant:

```java
app.put("/files/{name}", ctx -> {
    try (InputStream in = ctx.bodyStream(500L * 1024 * 1024)) {   // this route allows up to 500 MB
        Files.copy(in, uploads.resolve(safeName), StandardCopyOption.REPLACE_EXISTING);
    }
    ctx.status(204).res().end();
});
```

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
| a client that stops reading a response for 30 s | disconnected |
| more than 20,000 connections, or 5,000 from one address | refused |

On the way out, header names and values are validated — user input placed in
a header cannot inject another header or a second response — and the
`Content-Length` / `Transfer-Encoding` headers always come from the engine.

:::tip Behind a reverse proxy
Every connection then comes from the proxy's address, so raise the
per-address limit (`Limits.withMaxConnectionsPerAddress`) and install
[`TrustedProxyMiddleware`](security.md#behind-a-reverse-proxy) so rate limits
and logs see the real client.
:::

**What it does not do.** HTTP/3 (it runs over UDP and is normally provided by
a CDN).

The limits are configurable through `LoomServerEngine.Limits`, e.g.
`Limits.defaults().withMaxConnectionsPerAddress(20_000).withWriteTimeout(Duration.ofSeconds(60))`.

## HTTP/2

The **Loom engine** speaks HTTP/2 itself (see above). The JDK engine is
HTTP/1.1 only, and the **Jetty engine** offers cleartext HTTP/2:
it carries an HTTP/1.1 and an HTTP/2 cleartext (**h2c**) connection factory on
the same port, so h2c-capable clients negotiate HTTP/2 (via upgrade or prior
knowledge) and HTTP/1.1 clients are unaffected — no code change, just the
dependency swap above.

```java
// Java's HttpClient asks for HTTP/2 and gets it:
HttpClient.newBuilder().version(HttpClient.Version.HTTP_2).build();
```

### Why can't the JDK engine do it?

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

That is why the Loom engine exists: it implements HTTP/1.1, HTTP/2 (framing,
multiplexing, HPACK, flow control) and WebSockets itself, with no dependency.

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
