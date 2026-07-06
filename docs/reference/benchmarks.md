---
sidebar_position: 3
---

# Benchmarks

Two comparisons, both reproducible from the
[`ligero-examples`](https://github.com/ligero-framework/ligero-examples)
repository. Absolute numbers depend on your hardware — the point is the
**shape** of the differences, and that you can re-run them yourself.

## Framework comparison (same app, four setups)

The same products CRUD app (`GET`/`POST /products`, in-memory store) built in
each framework and launched identically (`installDist` → start script, no JVM
tuning). From a run on a 4-core machine, JDK 21:

| Framework | Startup (ms) | RSS (MB) | Throughput (req/s) | p50 (ms) | p99 (ms) | Dist libs (MB) |
|---|--:|--:|--:|--:|--:|--:|
| **Ligero (JDK engine)** | **436** | 246 | 1 030 | 44.1 | 58.9 | **3** |
| **Ligero (Jetty engine)** | 615 | 256 | 9 669 | 3.7 | 16.0 | 5 |
| Spring Boot (MVC / Tomcat) | 2 143 | 324 | 5 590 | 6.8 | 28.2 | 20 |
| Javalin (Jetty) | 679 | 328 | 11 907 | 2.7 | 15.8 | 8 |

*Startup = median of 5 cold JVM launches (process exec → first HTTP 200).
Throughput = `GET /products`, 50 connections, 8 s, after warmup. RSS =
`/proc/<pid>/status` VmRSS after the load run.*

**What it says:**

- **Ligero starts fastest and ships smallest** — about 0.4 s on the JDK
  engine (≈5× faster than Spring Boot) with a 3 MB dependency tree vs 20 MB.
- **Throughput is a choice of engine.** The default engine is the JDK's
  built-in `com.sun.net.httpserver` — *zero server dependencies*, but it caps
  concurrency and becomes the bottleneck under load (~1 k req/s here). That is
  the right trade for internal APIs and low-to-medium traffic, where instant
  startup and a tiny footprint matter most.
- **Need more? Swap the engine, not your code.** Adding
  `ligero-server-jetty` instead of `ligero-server-jdk` — one line, no code
  change, thanks to the [`ServerEngine` SPI](../guides/engines.md) — takes the
  *same app* to ~9.7 k req/s at a p99 of ~16 ms, matching Javalin (both run on
  Jetty) and beating Spring Boot MVC, while still starting faster and lighter.

The two Ligero rows share byte-for-byte the same `App.java`; only the
`runtimeOnly` server dependency differs.

### Verdict — which should you pick?

There is no single winner; it depends on what you optimize for.

| If you want… | Pick | Why |
|---|---|---|
| **Best balance** (throughput + footprint + features) | **Ligero on the Jetty engine** | ~Javalin throughput, the smallest deps of the fast options, plus DI, modules, devtools, OpenAPI, auth — batteries a micro-framework doesn't ship |
| **Fastest startup & smallest footprint** | **Ligero on the JDK engine** | 0.4 s cold start, 3 MB of libs, zero server deps — ideal for internal APIs, serverless, low-to-medium traffic |
| **Maximum raw throughput, minimal surface** | **Javalin** | highest req/s here; Ligero-on-Jetty is within run-to-run variance |
| **The biggest ecosystem & maturity** | **Spring Boot** | not what this benchmark measures — it's the slowest to start (2.1 s) and the heaviest (20 MB) — but its ecosystem is unmatched |

In one line: **Ligero gives you a micro-framework's startup and footprint,
and — with a one-line engine swap — Javalin-class throughput, while bringing
DI, modules and devtools that the micro-frameworks don't.** Spring Boot
remains the pick when the ecosystem outweighs startup, memory and size.

## Dependency-injection comparison

Wiring cost of a 100-bean dependency graph (fresh JVMs, median of 5),
comparing Ligero's [`Beans`](../guides/dependency-injection.md) container to
reflection/scanning containers:

| Container | Median wiring time | Relative |
|---|--:|--:|
| **Ligero `Beans`** | ~65 ms (≈ class-loading; the container works in µs) | 1× |
| Guice 7 | ~400 ms | ~6× |
| Spring 6.2 (component scanning) | ~555 ms | ~8.5× |

Explicit lambda bindings do no classpath scanning and no reflective
injection, so "wiring" is essentially just running your constructors —
which is why it barely registers next to class-loading.

## Reproduce

```bash
# framework comparison
cd ligero-examples/comparison
./run.sh                      # writes results.md
RUNS=7 CONC=100 DUR=15 ./run.sh

# both need Ligero published locally first, from the framework repo:
#   ./gradlew publishToMavenLocal
```

The harness (`comparison/run.sh` + `comparison/bench/Load.java`, a
zero-dependency virtual-thread load driver) builds each app, launches it with
identical flags, and records median cold-start, RSS and throughput. It is
deliberately simple and honest — one app at a time, warmup before load,
medians over cold starts — so you can read exactly how each number is
produced.
