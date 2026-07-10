---
sidebar_position: 7
---

# Observability

## Health checks

```java
app.use(HealthMiddleware.builder()
    .path("/health")
    .check("db", () -> dataSource.getConnection().isValid(1))
    .build());
```

`GET /health` → `200 {"status":"UP","checks":{"db":"UP"}}`, or `503` with the
failing checks marked `DOWN`.

## Metrics

`MetricsMiddleware` records method, **matched route pattern** (`/users/{id}`,
not the raw path — bounded cardinality), status and duration through the
`MetricsCollector` SPI.

```java
// dependency-free, expose however you like
InMemoryMetricsCollector metrics = new InMemoryMetricsCollector();
app.use(new MetricsMiddleware(metrics));
app.get("/metrics", ctx -> ctx.json(metrics.snapshot()));

// or Micrometer (ligero-metrics-micrometer) for Prometheus/Datadog/...
MeterRegistry registry = new PrometheusMeterRegistry(PrometheusConfig.DEFAULT);
app.use(new MetricsMiddleware(new MicrometerMetricsCollector(registry)));
```

## Access logs

```java
app.use(new RequestLoggingMiddleware());     // GET /users -> 200 (431 µs)
app.use(RequestLoggingMiddleware.json());    // {"method":"GET","path":"/users","status":200,...}
```

The JSON form includes the request id when `RequestIdMiddleware` runs first.

## Distributed tracing

Tracing is vendor-neutral by design: the core defines a `Tracer` SPI and a
`TracingMiddleware`; **the client decides the backend**. The first adapter is
`ligero-otel` (OpenTelemetry) — New Relic, Datadog, Jaeger and friends work
through it via the OTel SDK/agent exporters, or can implement the SPI directly.

```groovy
implementation 'com.ligeroframework:ligero-otel:0.5.0'
```

```java
// With the OTel Java agent (or SDK autoconfigure), ServiceLoader finds the tracer:
app.use(TracingMiddleware.fromServiceLoader());

// Or wire an explicit SDK:
app.use(new TracingMiddleware(new OtelTracer(openTelemetrySdk)));
```

Per request you get a `SERVER` span that:

- joins the incoming W3C `traceparent` (distributed traces across services),
- is named by the matched route pattern (`GET /users/{id}` — bounded cardinality),
- carries `http.request.method`, `url.path`, `http.route`, `http.response.status_code`,
- records exceptions and marks the span as `ERROR` on failures,
- exposes its trace id as the `traceId` context attribute for log correlation.

Without any tracing backend, `RequestIdMiddleware` alone still parses
`traceparent` and exposes `traceId` for logs.
