---
sidebar_position: 4
---

# Ligero and Spring Boot 4

Spring Boot 4 (November 2025) and its follow-ups 4.1 (June 2026) and 4.2 are
built on Spring Framework 7. This page lists what that line added and where
Ligero stands on each point, so you can tell whether a missing piece matters
for your application before you pick a framework. Most of the gaps listed in
the first version of this page are covered by the release after 0.8.0. The performance side is in [Benchmarks](benchmarks.md).

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
| **`@ConcurrencyLimit`** (cap concurrent calls to a method) | ✅ [`ConcurrencyLimit`](../guides/resilience.md#concurrency-limit-bulkhead) for calls, `ConcurrencyLimitMiddleware` for requests (`503` + `Retry-After`) |
| **API versioning** (version from header, path, query or media type; routing by version; deprecation headers) | ✅ [`ApiVersioning`](../guides/api-versioning.md): the same four sources, `Deprecation`/`Sunset`/`Link` headers, per-version handlers and `@ApiVersion` on typed controllers |
| **Declarative HTTP clients** (`@HttpExchange` interfaces, `RestClient`, per-group configuration) | ✅ [`ligero-http-client`](../guides/http-client.md): `RestClient`, and `@ClientApi` interfaces implemented at compile time |
| **SSRF protection for outgoing requests** (`InetAddressFilter`, 4.1) | ✅ [`AddressFilter.publicOnly()`](../guides/http-client.md#server-side-request-forgery-ssrf), checked on every redirect hop |
| **RFC 9457 Problem Details** error bodies (`application/problem+json`) | ✅ [`app.problemDetails(true)`](../guides/error-handling.md#problem-details), `ProblemException`, and problems read back by the HTTP client |
| **Null-safety annotations** on the whole API (JSpecify) | ❌ Not annotated |
| **OpenTelemetry starter**: OTLP export of traces, metrics and logs; OTel semantic conventions (4.2) | ✅ [`ligero-otel-otlp`](../guides/observability.md#exporting-over-otlp-in-one-call): traces, semantic-convention metrics and request logs over OTLP, from `OTEL_*` variables |
| **Virtual threads** (`spring.threads.virtual.enabled`) | ✅ Ligero serves requests on virtual threads by default; the Pluma engine adds dedicated platform threads for the first 256 connections |
| **HTTP/2** (via Tomcat, Jetty or Netty) | ✅ The [Pluma engine](../guides/engines.md) implements HTTP/2 itself, with rapid-reset and flood protection |
| **Forwarded headers**, unified under `server.request.header.forwarded.*` (4.2) | ✅ [`TrustedProxyMiddleware`](../guides/security.md#behind-a-reverse-proxy): `X-Forwarded-For` or RFC 7239 `Forwarded`, from listed proxies only |
| **Multipart limits by default** (WebFlux, 4.2) | ✅ Size and part-count limits on by default |
| **`RestTestClient`** for tests, against a mock or a live server | ✅ [`ligero-test`](../guides/testing.md) drives the real app end to end; handlers can also be tested without a server |
| **Programmatic bean registration** (`BeanRegistrar`) | ✅ Registration is programmatic by design ([dependency injection](../guides/dependency-injection.md)) |
| **Native image / AOT** | ✅ [Native-ready](../guides/native-image.md) by construction (no reflection in the core) |
| **JWT/OAuth2 resource server**, authorities from claims | ✅ [JWT](../guides/security.md), [asymmetric keys and JWKS](../guides/auth-asymmetric.md) — fetching the JWKS document is up to you |
| **gRPC** servers and clients (4.1) | ✅ [`ligero-grpc`](../guides/grpc.md): services next to the HTTP server, virtual threads, health checks (clients: grpc-java's own channels) |
| **Messaging**: AMQP 1.0 (4.2), RabbitMQ, Kafka, JMS (`JmsClient`) | ✅ [`ligero-kafka`, `ligero-jms`, `ligero-amqp`](../guides/messaging.md): JSON payloads, at-least-once delivery, dead-lettering |
| **GraphQL** | ✅ [`ligero-graphql`](../guides/graphql.md) with depth, complexity and size limits |
| **Internationalisation** (`MessageSource`) | ✅ [`Messages` and `LocaleMiddleware`](../guides/i18n.md) |
| **Container images** with Buildpacks, SBOM | ✅ [`ligero image`](../getting-started/cli.md#ligero-image--container-images) in the CLI (Paketo buildpacks, SBOM export) |

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

- **Pick Ligero** for HTTP, GraphQL and gRPC services where throughput,
  startup time, memory and a small, readable stack matter: microservices,
  serverless and scale-to-zero, edge deployments, event consumers, MCP servers.
- **Pick Spring Boot** when you need its long tail of integrations — Spring
  Batch, Spring Data for many stores, Spring Security's OAuth2 server and SAML,
  Spring Cloud — or a team that already knows it.

What is still missing on the Ligero side: null-safety annotations (JSpecify)
on the public API, a GraphQL client, and Spring's breadth of data-store
integrations.
