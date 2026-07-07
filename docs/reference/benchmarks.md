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
| **Ligero (JDK engine)** | **429** | 371 | **13 049** | **2.8** | 13.6 | **3** |
| **Ligero (Jetty engine)** | 592 | 262 | 10 044 | 3.7 | 15.1 | 5 |
| Spring Boot (MVC / Tomcat) | 1 952 | 309 | 5 809 | 6.7 | 29.2 | 20 |
| Javalin (Jetty) | 624 | 273 | 10 937 | 3.1 | 19.5 | 8 |

*Startup = median of 4 cold JVM launches (process exec → first HTTP 200).
Throughput = `GET /products`, 50 connections, 8 s, after warmup. RSS =
`/proc/<pid>/status` VmRSS after the load run.*

**What it says:**

- **Ligero's default engine sweeps the board.** On the zero-dependency JDK
  engine (`com.sun.net.httpserver`) it now leads throughput (~13 k req/s,
  p50 2.8 ms), starts fastest (~0.43 s, ~4.5× faster than Spring Boot), and
  ships the smallest dependency tree (3 MB vs 20 MB).
- **This used to read the other way.** The JDK engine looked slow (~1 k req/s,
  p50 44 ms) purely because `com.sun.net.httpserver` leaves Nagle's algorithm
  on — which on keep-alive connections adds ~40 ms per response. The engine
  now disables it (`sun.net.httpserver.nodelay`) by default; nothing in your
  app changes. It's a good reminder to profile before blaming the design.
- **The Jetty engine is still one dependency away** for teams that want
  HTTP/2, WebSockets, or Jetty's tuning knobs — the same `App.java`, only the
  `runtimeOnly` server dependency differs.

### Verdict — which should you pick?

| If you want… | Pick | Why |
|---|---|---|
| **Best all-round** | **Ligero (JDK engine)** | fastest startup, smallest deps, top throughput, plus DI/modules/devtools a micro-framework doesn't ship |
| **HTTP/2 or WebSockets** | **Ligero (Jetty engine)** | same app, one dependency swap via the [`ServerEngine` SPI](../guides/engines.md) |
| **The biggest ecosystem & maturity** | **Spring Boot** | not what this benchmark measures — slowest to start (2 s) and heaviest (20 MB), but the ecosystem is unmatched |

In one line: **Ligero gives you a micro-framework's startup and footprint
with top-tier throughput on zero server dependencies — plus DI, modules and
devtools built in.** Spring Boot remains the pick when the ecosystem
outweighs startup, memory and size.

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
