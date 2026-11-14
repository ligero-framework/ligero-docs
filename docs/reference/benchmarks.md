---
sidebar_position: 3
---

# Benchmarks

Two comparisons. The framework comparison is reproducible from the
[`perf/`](https://github.com/ligero-framework/ligero/tree/main/perf) directory
of the framework repository (`python3 perf/run.py`); the DI comparison from
[`ligero-examples`](https://github.com/ligero-framework/ligero-examples). Absolute numbers depend on your hardware — the point is the
**shape** of the differences, and that you can re-run them yourself.

## Framework comparison (same app, five setups)

The same products CRUD app (`GET /products`, `GET /products/{id}`,
`POST /products`, in-memory store) built in each framework and launched
identically (`installDist` → start script, same JVM flags). From a run on a
4-core machine, JDK 21 — medians of 3 interleaved rounds, 32 keep-alive
connections, requests per second:

| Framework | GET list | GET by id | POST | Overall | Startup (ms) | Dist libs (MB) |
|---|--:|--:|--:|--:|--:|--:|
| **Ligero (Loom engine)** | **188 813** | **173 212** | **129 087** | **161 621** | **374** | **2.7** |
| Javalin 6 (Jetty) | 59 451 | 60 681 | 50 025 | 56 511 | 654 | 8.3 |
| Ligero (Jetty engine) | 44 794 | 44 613 | 35 569 | 41 424 | 685 | 5.4 |
| Ligero (JDK engine) | 38 196 | 38 299 | 31 016 | 35 667 | 429 | 2.7 |
| Spring Boot 3.4 (MVC / Tomcat) | 29 338 | 29 114 | 23 394 | 27 136 | 1 812 | 20.4 |

*Overall = geometric mean of the three scenarios. Startup = process exec →
first HTTP 200.*

**What it says:**

- **Ligero's own engine leads by a wide margin** — about 2.9× Javalin and 6×
  Spring Boot — while starting fastest and shipping the smallest dependency
  tree. [`ligero-server-loom`](../guides/engines.md#the-loom-engine)
  implements HTTP/1.1 itself, with one thread per connection and no
  dispatcher in between.
- **The engine is what matters.** The same Ligero application on the JDK's
  built-in server is 4.5× slower: that server tops out at roughly 48 000
  requests/s on this machine with no framework on top at all.
- **Typed controllers cost nothing.** They run at the same throughput as
  hand-written lambdas, because the routing code is generated at compile time.
- **The lead depends on the machine.** On the GitHub-hosted runner that
  checks every pull request the same benchmark measured the Loom engine at
  1.4× Javalin and 2.6× Spring Boot — still first, by a smaller margin than on
  the development machine above.
- **And on the workload.** The Loom engine serves its first 256
  concurrent connections on dedicated threads. With 1 000 busy connections it
  measured 57–110 thousand requests/s against Javalin's 73 thousand.

:::note Earlier numbers
Previous versions of this page showed about 13 000 requests/s for every fast
framework. That figure was the load generator's limit, not the servers': the
driver has since been replaced by a raw-socket client that is cheap enough to
let the servers be the bottleneck.
:::

**Checked on every pull request.** The framework repository runs this
benchmark for each PR against its target branch and fails the check if any
scenario gets more than 10 % slower, or if Ligero's lead over the other
frameworks drops below a recorded floor.

### Verdict — which should you pick?

| If you want… | Pick | Why |
|---|---|---|
| **Best all-round** | **Ligero (Loom engine)** | highest throughput, fastest startup, smallest deps, WebSockets, plus DI/modules/devtools |
| **Nothing but the JDK's own server** | **Ligero (JDK engine)** | the conservative default; still ahead of Spring Boot |
| **HTTP/2** | **Ligero (Jetty engine)** | same app, one dependency swap via the [`ServerEngine` SPI](../guides/engines.md) |
| **The biggest ecosystem & maturity** | **Spring Boot** | not what this benchmark measures — slowest to start and heaviest, but the ecosystem is unmatched |

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
# framework comparison — from the framework repository
./gradlew publishToMavenLocal -Pversion=0.0.0-pr-SNAPSHOT -x javadoc
python3 perf/run.py --candidate 0.0.0-pr-SNAPSHOT
python3 perf/run.py --help          # rounds, duration, connections, gates
```

`perf/run.py` builds each app, starts it cold several times in interleaved
rounds, drives it with `perf/Load.java` — a zero-dependency raw-socket HTTP
client on virtual threads — and compares the medians. Everything runs on one
machine, load driver included, so compare rows of the same run rather than
numbers across machines.
