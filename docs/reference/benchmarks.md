---
sidebar_position: 3
---

# Benchmarks

Two comparisons. The framework comparison is reproducible from the
[`perf/`](https://github.com/ligero-framework/ligero/tree/main/perf) directory
of the framework repository (`python3 perf/run.py`); the DI comparison from
[`ligero-examples`](https://github.com/ligero-framework/ligero-examples). Absolute numbers depend on your hardware — the point is the
**shape** of the differences, and that you can re-run them yourself.

## Framework comparison (same app, eight setups)

The same products CRUD app (`GET /products`, `GET /products/{id}`,
`POST /products`, in-memory store) built in each framework and launched
identically (`installDist` → start script, same JVM flags). From a run on a
4-core machine, JDK 21 — medians of 3 interleaved rounds, 32 keep-alive
connections, requests per second:

| Framework | GET list | GET by id | POST | Overall | p99 list (ms) | Startup (ms) | Dist libs (MB) |
|---|--:|--:|--:|--:|--:|--:|--:|
| **Ligero (Pluma engine)** | **173 758** | **184 657** | **131 595** | **161 628** | **2.60** | **369** | **2.8** |
| Javalin 6 (Jetty) | 58 387 | 58 481 | 48 437 | 54 891 | 4.58 | 637 | 8.3 |
| Ligero (Jetty engine) | 44 856 | 43 598 | 35 750 | 41 196 | 3.43 | 593 | 5.4 |
| Ligero (JDK engine) | 39 401 | 38 806 | 31 870 | 36 525 | 3.16 | 478 | 2.7 |
| Ligero (JDK engine), typed controllers | 36 915 | 38 819 | 32 823 | 36 097 | 3.31 | 493 | 2.7 |
| Spring Boot 4.2 (MVC / Tomcat), virtual threads | 36 419 | 33 688 | 26 048 | 31 734 | 3.62 | 1 901 | 19.9 |
| Spring Boot 4.2 (MVC / Tomcat) | 35 570 | 32 158 | 24 833 | 30 512 | 4.32 | 1 842 | 19.9 |
| Spring Boot 3.5 (MVC / Tomcat) | 28 198 | 29 508 | 26 348 | 27 988 | 5.18 | 1 892 | 20.9 |

Spring Boot 4.2.0 runs on Spring Framework 7.1, Tomcat 11 and Jackson 3;
Spring Boot 3.5.16 is the last 3.x line, for comparison.

*Overall = geometric mean of the three scenarios. Startup = process exec →
first HTTP 200.*

**What it says:**

- **Ligero's own engine leads by a wide margin** — about 2.9× Javalin and
  5.3× Spring Boot 4.2 — while starting fastest and shipping the smallest dependency
  tree. [`ligero-server-pluma`](../guides/engines.md#the-pluma-engine)
  implements HTTP/1.1 itself, with one thread per connection and no
  dispatcher in between.
- **The engine is what matters.** The same Ligero application on the JDK's
  built-in server is 4.4× slower: that server tops out at roughly 48 000
  requests/s on this machine with no framework on top at all.
- **Spring Boot 4 is faster than 3.5, not fast.** 4.2 gains about 9 % over
  3.5 overall (and 3 % more with virtual threads), still below Ligero on the
  JDK's own server, and it takes five times as long as the Pluma engine to
  start. See [Ligero and Spring Boot 4](spring-boot-4.md) for the feature
  side of the comparison.
- **Typed controllers cost nothing.** They run at the same throughput as
  hand-written lambdas, because the routing code is generated at compile time.
- **The lead depends on the machine.** On the GitHub-hosted runner that
  checks every pull request the same benchmark measured the Pluma engine at
  1.4× Javalin and 2.6× Spring Boot 3.4 — still first, by a smaller margin than on
  the development machine above.
- **And on the workload.** The Pluma engine serves its first 256
  concurrent connections on dedicated threads. With 1 000 busy connections it
  measured 57–110 thousand requests/s against Javalin's 73 thousand.

**HTTP/2 and TLS.** Measured with `h2load` against the Pluma engine on the
same machine (`GET /products`, requests/s):

| | Plain | TLS 1.3 |
|---|--:|--:|
| HTTP/1.1, 32 connections | 140 437 | 95 445 |
| HTTP/2, 8 connections × 16 streams | 141 564 | 120 482 |

Multiplexed HTTP/2 matches HTTP/1.1, and TLS costs roughly 15–30 %.

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
| **Best all-round** | **Ligero (Pluma engine)** | highest throughput, fastest startup, smallest deps, WebSockets, plus DI/modules/devtools |
| **Nothing but the JDK's own server** | **Ligero (JDK engine)** | the conservative default; still ahead of Spring Boot |
| **A long-established third-party server** | **Ligero (Jetty engine)** | same app, one dependency swap via the [`ServerEngine` SPI](../guides/engines.md) |
| **The biggest ecosystem & maturity** | **Spring Boot** | not what this benchmark measures — slowest to start and heaviest, but the ecosystem (messaging, gRPC, GraphQL, batch...) is unmatched; see [what Spring Boot 4 has that Ligero does not](spring-boot-4.md) |

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
python3 perf/run.py --candidate 0.0.0-pr-SNAPSHOT --spring-extras   # + Spring Boot 4.2 on virtual threads and 3.5
python3 perf/run.py --help          # rounds, duration, connections, gates
```

`perf/run.py` builds each app, starts it cold several times in interleaved
rounds, drives it with `perf/Load.java` — a zero-dependency raw-socket HTTP
client on virtual threads — and compares the medians. Everything runs on one
machine, load driver included, so compare rows of the same run rather than
numbers across machines.
