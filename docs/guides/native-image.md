---
sidebar_position: 5
---

# Native image (GraalVM)

Ligero is a good fit for GraalVM `native-image`: the core is **reflection-free**
(the `arch-test` module enforces it), DI can be generated at compile time, and
engines/mappers are discovered through `ServiceLoader` — so most of the
closed-world metadata GraalVM needs is either unnecessary or already shipped.

## Native-ready by construction

These need **no extra metadata** — pure JDK + Ligero code:

| Module | Notes |
|---|---|
| `ligero-core` | router, middleware, `Beans`, SSE/WebSocket, events, cache |
| `ligero-server-jdk` | the `com.sun.net.httpserver` engine (GraalVM-supported) |
| `ligero-scheduler` | virtual-thread scheduling |
| `ligero-resilience` | retry / timeout / circuit breaker |
| `ligero-auth` | HS256/RS256/ES256 + JWKS (JDK crypto) |
| `ligero-jdbc` | plain JDBC (bring a native-friendly driver) |

`ligero-core` also registers the common app resources for native
(`ligero.yml`/`ligero-*.yml`, `templates/`, `static/`, `db/migration/`,
`META-INF/services/`).

## What needs its own metadata

Reflection-heavy libraries bring their own GraalVM metadata or need yours:

- **`ligero-json` (Jackson)** — register your request/response record types for
  reflection (a `reflect-config.json`, or run the tracing agent once).
- **`ligero-jpa` (Hibernate)** / **`ligero-validation`** — use the upstream
  GraalVM support for these if you need them native.
- Prefer **`ligero-server-jdk`** over `ligero-server-jetty` for native.

## Building

With the GraalVM Gradle plugin (`org.graalvm.buildtools.native`):

```bash
./gradlew nativeCompile
./build/native/nativeCompile/<app>
```

For reflective bits, generate metadata by running your tests/app once under the
tracing agent and committing the output:

```bash
java -agentlib:native-image-agent=config-output-dir=src/main/resources/META-INF/native-image \
     -jar build/libs/<app>.jar
```
