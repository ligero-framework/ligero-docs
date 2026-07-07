---
sidebar_position: 1
slug: /
---

import useBaseUrl from '@docusaurus/useBaseUrl';

<div class="hero-ligero">
  <img src={useBaseUrl('/img/Ligero.svg')} alt="Ligero" class="hero-whale" />
  <h1 class="hero-title">ligero</h1>
  <p class="hero-tagline">
    The lightweight Java web framework — a micro-framework's speed and footprint,
    with the batteries the micro-frameworks leave out.
  </p>
  <div class="hero-stats">
    <div class="stat"><b>~13k</b><span>req/s</span></div>
    <div class="stat"><b>0.43&nbsp;s</b><span>cold start</span></div>
    <div class="stat"><b>3&nbsp;MB</b><span>dependencies</span></div>
    <div class="stat"><b>0</b><span>core deps</span></div>
  </div>
  <div class="hero-chips">
    <span>⚡ Virtual threads by default</span>
    <span>🪶 Zero-dependency core</span>
    <span>🔌 Everything is a pluggable adapter</span>
    <span>🧭 DI + modules, no reflection</span>
    <span>🔬 Visual devtools</span>
    <span>🛡️ Secure by default</span>
    <span>🚀 GraalVM-friendly</span>
  </div>
  <div class="hero-cta">
    <a class="btn-primary" href="/getting-started/quickstart">Get started →</a>
    <a class="btn-ghost" href="https://github.com/ligero-framework/ligero">GitHub</a>
  </div>
</div>

# Why Ligero

**Ligero** (Spanish for *lightweight*) is a web framework for Java 21+ that
proves you don't have to choose between **fast and lean** and **productive**.
On the zero-dependency JDK engine it [tops a same-app benchmark](reference/benchmarks)
— ~13k req/s, ~0.43 s cold start, a 3 MB dependency tree — while shipping a DI
container, feature modules, a visual debugger, JPA/Redis integrations and more.

```java
Ligero app = Ligero.create(8080);

app.get("/hello/{name}", ctx ->
    ctx.json(Map.of("message", "Hello, " + ctx.pathParam("name") + "!")));

app.start();   // running in ~0.4 s
```

Built around a few firm ideas:

1. **Zero dependencies in the core** — `ligero-core` depends only on `slf4j-api`.
   JSON, server engines, templates, metrics, config, data — every one is an
   optional, pluggable adapter behind an SPI. Pay only for what you use.
2. **Virtual threads by default** — blocking, easy-to-read handler code that
   scales like async, courtesy of Project Loom.
3. **No runtime magic** — no classpath scanning, no reflection-based injection.
   Wiring is explicit code the compiler checks; an optional annotation
   processor can generate it for you *at compile time* if you prefer brevity.
4. **Batteries, but à la carte** — a DI container, feature modules, a visual
   devtools dashboard, auth, OpenAPI, templates, tracing, JPA and Redis — each
   a module you add when you need it, never weight you carry by default.

## What's in the box

Everything below is optional — add the module, or don't.

| Area | Module(s) | What you get |
|---|---|---|
| **HTTP core** | `ligero-core` | router, middleware, `Context`, SPIs, config — zero deps |
| **Engines** | `ligero-server-jdk` · `ligero-server-jetty` | zero-dep JDK engine or Jetty (HTTP/2, WebSockets) — swap in one line |
| **DI** | `ligero-core` (`Beans`) · `ligero-processor` | explicit lambda wiring, or generate it at compile time |
| **Modules** | `ligero-core` (`LigeroModule`) | feature slices, wiring out of the startup class |
| **Devtools** | `ligero-devtools` | `/ligero/dev` — bean graph + live per-request traces |
| **Data** | `ligero-jpa` | thin JPA/Hibernate helper (bring your own provider) |
| **Config** | `ligero-config-yaml` | `ligero.yml` + profiles, `${ENV:-default}` |
| **Scale-out** | `ligero-redis` | distributed rate-limit + session stores |
| **Also** | auth · JSON · templates (×3) · OpenAPI · metrics · OTel tracing | JWT/CSRF/sessions, Jackson, Mustache/FreeMarker/Pebble, … |

## When to use Ligero

- REST APIs and microservices where **startup time and footprint** matter.
- Services that want **plain, debuggable Java** instead of framework magic.
- Anywhere you'd reach for a micro-framework but still want DI, modules and
  first-class devtools.

## When *not* to use it

If you need the **full Jakarta EE surface** or **Spring's ecosystem breadth**
(reactive stacks, the vast starter/integration catalog), use those — Ligero
optimizes for the lean, explicit end of the spectrum.

## How it compares

Same products CRUD app, measured identically (see [Benchmarks](reference/benchmarks)):

| | Ligero (JDK engine) | Javalin | Spring Boot |
|---|--:|--:|--:|
| Core dependencies | **0** (slf4j-api) | Jetty | dozens |
| Programming model | handlers + middleware, explicit DI | handlers | annotations + DI |
| Virtual threads | **default** | optional | optional |
| Cold start | **~0.43 s** | ~0.62 s | ~2 s |
| Throughput | **~13k req/s** | ~11k | ~5.8k |
| Dependency size | **3 MB** | 8 MB | 20 MB |

Continue with the [Quickstart](getting-started/quickstart).
