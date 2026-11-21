---
sidebar_position: 4
---

# Ligero and Spring Boot 4

Spring Boot 4 (November 2025) and its follow-ups 4.1 (June 2026) and 4.2 are
built on Spring Framework 7. This page lists what that line added, which of
it Ligero already covers, and what Ligero does not have — so you can tell
whether a missing piece matters for your application before you pick a
framework. The performance side is in [Benchmarks](benchmarks.md).

## Performance at a glance

Same products API, same machine, same load (4 cores, 32 keep-alive
connections, medians of 3 interleaved rounds):

| | Ligero (Pluma engine) | Spring Boot 4.2 | Spring Boot 4.2, virtual threads |
|---|--:|--:|--:|
| Overall throughput (req/s) | **161 628** | 30 512 | 31 734 |
| p99 latency, `GET /products` (ms) | **2.60** | 4.32 | 3.62 |
| Startup to first response (ms) | **369** | 1 842 | 1 901 |
| Dependencies shipped (MB) | **2.8** | 19.9 | 19.9 |

Ligero serves about **5.3×** the requests of Spring Boot 4.2 and starts about
**5×** faster. Spring Boot 4.2 is about 9 % faster than 3.5; turning on its
virtual threads adds another 4 %.

## What Spring Boot 4 added, and where Ligero stands

| Spring Boot 4.x / Spring Framework 7 | Ligero |
|---|---|
| **Typed controller methods** (`@GetMapping`, `@PathVariable`, `@RequestBody`) — long-standing | ✅ [Typed controllers](../guides/controllers.md), generated at compile time instead of resolved by reflection at startup |
| **Resilience in the core**: `@Retryable`, `RetryTemplate` | ✅ [`ligero-resilience`](../guides/resilience.md): `Retry`, `Timeout`, `CircuitBreaker` |
| **`@ConcurrencyLimit`** (cap concurrent calls to a method) | ❌ Not yet — the closest is per-client [rate limiting](../guides/middleware.md) |
| **API versioning** (version from header, path, query or media type; routing by version; deprecation headers) | ❌ Not built in — today you encode the version in the path (`/v2/...`) by hand |
| **Declarative HTTP clients** (`@HttpExchange` interfaces, `RestClient`, per-group configuration) | ❌ No HTTP client module — use `java.net.http.HttpClient` directly |
| **SSRF protection for outgoing requests** (`InetAddressFilter`, 4.1) | ❌ Follows from the above: there is no Ligero client to protect |
| **RFC 9457 Problem Details** error bodies (`application/problem+json`) | ⚠️ Errors are a uniform `{"status":…, "error":…}` JSON body ([error handling](../guides/error-handling.md)); a custom exception handler can emit Problem Details |
| **Null-safety annotations** on the whole API (JSpecify) | ❌ Not annotated |
| **OpenTelemetry starter**: OTLP export of traces, metrics and logs; OTel semantic conventions (4.2) | ⚠️ [`ligero-otel`](../guides/observability.md) exports traces; metrics go through Micrometer (`ligero-metrics-micrometer`) |
| **Virtual threads** (`spring.threads.virtual.enabled`) | ✅ Ligero serves requests on virtual threads by default; the Pluma engine adds dedicated platform threads for the first 256 connections |
| **HTTP/2** (via Tomcat, Jetty or Netty) | ✅ The [Pluma engine](../guides/engines.md) implements HTTP/2 itself, with rapid-reset and flood protection |
| **Forwarded headers**, unified under `server.request.header.forwarded.*` (4.2) | ⚠️ [`TrustedProxyMiddleware`](../guides/security.md) reads `X-Forwarded-For` from listed proxies only; the standard `Forwarded` header (RFC 7239) is not read |
| **Multipart limits by default** (WebFlux, 4.2) | ✅ Size and part-count limits on by default |
| **`RestTestClient`** for tests, against a mock or a live server | ✅ [`ligero-test`](../guides/testing.md) drives the real app end to end; handlers can also be tested without a server |
| **Programmatic bean registration** (`BeanRegistrar`) | ✅ Registration is programmatic by design ([dependency injection](../guides/dependency-injection.md)) |
| **Native image / AOT** | ✅ [Native-ready](../guides/native-image.md) by construction (no reflection in the core) |
| **JWT/OAuth2 resource server**, authorities from claims | ✅ [JWT](../guides/security.md), [asymmetric keys and JWKS](../guides/auth-asymmetric.md) — fetching the JWKS document is up to you |
| **gRPC** servers and clients (4.1) | ❌ Not supported |
| **Messaging**: AMQP 1.0 (4.2), RabbitMQ, Kafka, JMS (`JmsClient`) | ❌ Not supported — Ligero has in-process [events](../guides/events.md) and Redis-backed stores only |
| **GraphQL** | ❌ Not supported |
| **Internationalisation** (`MessageSource`) | ❌ Not built in |
| **Container images** with Buildpacks, SBOM | ❌ No build tooling of its own — a plain `Dockerfile` (the CLI generates one) |

✅ covered · ⚠️ partly covered · ❌ missing

## What Ligero has that Spring Boot does not

- **Speed and size** — see the table above: several times the throughput, a
  fifth of the startup time and a seventh of the dependencies.
- **No reflection at runtime.** Routes, controllers and dependency injection
  are plain code or generated at compile time, so what runs is what you can
  read, and startup does no classpath scanning.
- **Its own server engine.** HTTP/1.1, HTTP/2, TLS and WebSockets in one
  dependency-free module, with strict request parsing (request smuggling is
  refused, not repaired) and certificate reload without a restart.
- **MCP servers** in the framework itself ([`ligero-mcp`](../guides/mcp.md)),
  with origin checks against DNS rebinding.
- **A development dashboard** ([devtools](../guides/devtools.md)) with the
  bean graph and request traces, local-only by default.
- **A benchmark gate on every pull request**, so the framework cannot get
  slower without someone noticing.

## When to pick which

- **Pick Ligero** for HTTP APIs and services where throughput, startup time,
  memory and a small, readable stack matter: microservices, serverless and
  scale-to-zero, edge deployments, MCP servers.
- **Pick Spring Boot** when you need its integrations — messaging brokers,
  gRPC, GraphQL, batch, the wider Spring Data and Spring Security ecosystem —
  or a team that already knows it. Those are the gaps in the table above,
  and none of them is about speed.

The missing pieces most likely to matter for a typical HTTP API are API
versioning, a declarative HTTP client and Problem Details errors.
