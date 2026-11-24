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
implementation 'com.ligeroframework:ligero-otel:0.8.0'
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
- exposes its trace id as the `traceId` context attribute for log correlation,
- is current for the whole request, so log records and instrumented outgoing
  calls join the trace.

## OpenTelemetry metrics and logs

`ligero-otel` also records metrics and access logs through OpenTelemetry:

```java
app.use(new TracingMiddleware(new OtelTracer(otel)))
   .use(new MetricsMiddleware(new OtelMetricsCollector(otel)))   // http.server.request.duration
   .use(new OtelRequestLogs(otel));                              // one log record per request
```

The histogram follows the HTTP semantic conventions (`http.request.method`,
`http.route`, `http.response.status_code`, `error.type`, recommended
buckets). Log records carry the method, route, path, status and duration — not
the query string, headers or body — at `INFO`, `WARN` (4xx) or `ERROR` (5xx),
joined to the request's trace. Requests that matched no route are reported
with the route `UNMATCHED`, never their raw path, so random URLs cannot
create unbounded metric series.

## Exporting over OTLP in one call

`ligero-otel-otlp` builds the OpenTelemetry SDK and sends all three signals to
any OTLP backend — the OpenTelemetry Collector, Grafana, Honeycomb, Datadog,
New Relic, ...:

```groovy
implementation 'com.ligeroframework:ligero-otel-otlp:<version>'
```

```java
Ligero app = Ligero.create();
Otlp.instrument(app);      // first, so every request is observed
```

It is configured with the standard environment variables:

```bash
OTEL_SERVICE_NAME=shop
OTEL_EXPORTER_OTLP_ENDPOINT=https://otel-collector.internal:4318
OTEL_EXPORTER_OTLP_HEADERS=x-api-key=...
OTEL_TRACES_SAMPLER=parentbased_traceidratio
OTEL_TRACES_SAMPLER_ARG=0.1
```

Data goes out as OTLP/HTTP (`http/protobuf`, port 4318) through the JDK's own
HTTP client, and what is buffered is flushed when the app stops. The gRPC
transport is not bundled.

:::note Availability
Metrics, request logs and `ligero-otel-otlp` ship in the release after 0.8.0.
:::

Without any tracing backend, `RequestIdMiddleware` alone still parses
`traceparent` and exposes `traceId` for logs.
