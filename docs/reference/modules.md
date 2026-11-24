---
sidebar_position: 1
---

# Modules

| Artifact | Depends on | What it is |
|---|---|---|
| `ligero-core` | slf4j-api | API, router, middleware, SPIs, config, validation, SSE, WebSocket API |
| `ligero-server-jdk` | core | Default engine (`com.sun.net.httpserver`, virtual threads) |
| `ligero-server-pluma` | core | Ligero's own engine: HTTP/1.1, HTTP/2, HTTPS and WebSockets; fastest |
| `ligero-compress-brotli` | core, brotli4j | Brotli (`br`) response compression for engines supporting the `ContentEncoder` SPI |
| `ligero-server-jetty` | core, Jetty 12 | Alternative engine; WebSockets and HTTP/2 |
| `ligero-json` | core, Jackson | `BodyMapper` implementation |
| `ligero-auth` | core | JWT HS256, CSRF, sessions |
| `ligero-template-mustache` | core, JMustache | `TemplateEngine` adapter |
| `ligero-template-freemarker` | core, FreeMarker | `TemplateEngine` adapter |
| `ligero-template-pebble` | core, Pebble | `TemplateEngine` adapter |
| `ligero-otel` | core, OpenTelemetry API | Traces (W3C trace join), `http.server.request.duration` metrics, per-request logs |
| `ligero-otel-otlp` | otel, OpenTelemetry SDK + OTLP exporter | `Otlp.instrument(app)`: traces, metrics and logs to any OTLP backend, from `OTEL_*` variables |
| `ligero-http-client` | core | `RestClient` (`java.net.http`), declarative `@ClientApi` clients, Problem Details errors, SSRF filter |
| `ligero-resilience` | slf4j-api | Retry, timeout, circuit breaker, concurrency limit |
| `ligero-graphql` | core, graphql-java | GraphQL endpoint with depth, complexity and size limits |
| `ligero-grpc` | core, grpc-java | gRPC services next to the HTTP server, health checks |
| `ligero-kafka` | core, kafka-clients | Producer and consumers, retries, dead-letter topic |
| `ligero-jms` | core, Jakarta Messaging API | JSON messaging over JMS brokers, transacted delivery |
| `ligero-amqp` | core, Qpid ProtonJ2 | JSON messaging over AMQP 1.0 |
| `ligero-openapi` | core | OpenAPI 3 generation + Swagger UI |
| `ligero-metrics-micrometer` | core, Micrometer | `MetricsCollector` adapter |
| `ligero-devtools` | core | Dev dashboard: bean graph + live request traces |
| `ligero-processor` | core (annotationProcessor) | Optional compile-time DI: generates `bind(...)` from annotations |
| `ligero-config-yaml` | core, SnakeYAML | `ConfigSource`: `ligero.yml` + profiles + `${ENV:-default}` |
| `ligero-jdbc` | core | Tiny DataSource helper: `query`/`update`/`tx`, rows → records |
| `ligero-jpa` | core, Jakarta Persistence API | Thin JPA/Hibernate helper (bring your own provider) |
| `ligero-migrations` | core, Flyway | `Migrations.run(dataSource)` — Flyway migrations at startup |
| `ligero-validation` | core, Hibernate Validator | Annotation-based request validation → 400 |
| `ligero-redis` | core, auth, Jedis | Distributed rate-limit + session stores |
| `ligero-test` | core | End-to-end test client |

All published modules except `ligero-kafka` (whose `kafka-clients` dependency
declares no module name) ship `module-info.java` (JPMS) with `provides`/`uses`
declarations for the SPIs, plus classic `META-INF/services` files for
classpath users.

A minimal API needs `ligero-core` + one engine; add `ligero-json` for JSON
bodies. Everything else is opt-in.
