---
sidebar_position: 2
title: Learning Path
description: A guided route from your first route to a production service.
---

# Learning Path

A guided route through Ligero — from your first `GET` to a production service —
in the order concepts build on each other. Each stage links the guides you need
and says, in one line, what you'll walk away knowing. Skim the whole thing once,
then follow it top to bottom.

:::tip New here?
If you just want to see it run, do **Stage 0** and stop. Come back for the rest
when you're building something real.
:::

---

## Stage 0 · Get it running

Your goal: a Ligero app answering requests on your machine in under a minute.

- **[Installation](getting-started/installation)** — add `ligero-core` + an engine, nothing else.
- **[Quickstart](getting-started/quickstart)** — the smallest complete app: create, route, start.
- **[The CLI](getting-started/cli)** — scaffold a project and use `ligero dev` for hot-reload while you learn.

> ✅ You can start a server, hit a route, and see it reload on save.

## Stage 1 · The HTTP core

Your goal: handle any request and shape any response — the 80% you'll use daily.

- **[Routing](guides/routing)** — path params, wildcards, groups, automatic 405/OPTIONS.
- **[Context](guides/context)** — read the request, write the response: `ctx.json`, `ctx.pathParam`, cookies, typed params.
- **[Middleware](guides/middleware)** — the pipeline: CORS, auth, rate-limit, logging — composed, path-scoped.
- **[Error handling](guides/error-handling)** — the `HttpException` hierarchy and uniform JSON error bodies.

> ✅ You can build a complete REST endpoint with validation and clean errors.

## Stage 2 · Structure a real app

Your goal: move wiring out of `main()` and keep a growing codebase navigable.

- **[Dependency injection](guides/dependency-injection)** — explicit, compile-checked wiring (no reflection); optional compile-time processor.
- **[Architecture & modules](guides/architecture)** — feature slices (`LigeroModule`) that own their beans and routes.
- **[Devtools](guides/devtools)** — the `/ligero/dev` dashboard: live bean graph + per-request traces.

> ✅ Your app is organized into modules and you can *see* how it's wired.

## Stage 3 · Configuration

Your goal: the same build running cleanly across dev, staging and prod.

- **[Configuration](guides/configuration)** — typed config and the precedence rules (builder > env > file > defaults).
- **[YAML & profiles](guides/configuration-yaml)** — `ligero.yml` + per-profile overlays and `${ENV:-default}` interpolation.

> ✅ One artifact, environment-specific behavior, no code changes.

## Stage 4 · Data

Your goal: talk to a database the way that fits the job.

- **[Data access](guides/data)** — pick your level: `ligero-jdbc` (SQL → records, no ORM), `ligero-jpa` (Hibernate), and `ligero-migrations` (Flyway) to version your schema.

> ✅ You can query, map, transact and migrate — with or without an ORM.

## Stage 5 · Web & real-time

Your goal: serve HTML, stream updates, and document your API.

- **[Templates](guides/templates)** — Mustache / FreeMarker / Pebble adapters (auto-escaping in all three).
- **[Real-time](guides/realtime)** — Server-Sent Events in core; WebSockets on the Jetty engine.
- **[OpenAPI](guides/openapi)** — a spec generated from your routes, with opt-in Swagger UI.

> ✅ You can render pages, push live data, and hand consumers a spec.

## Stage 6 · Harden & ship

Your goal: something you'd put in front of real traffic.

- **[Security](guides/security)** — the OWASP-aligned baseline, JWT/CSRF/sessions, what's on by default.
- **[Testing](guides/testing)** — the fluent end-to-end client for fast, real HTTP tests.
- **[Observability](guides/observability)** — health, metrics (Micrometer), structured logs, distributed tracing.
- **[Engines & HTTP/2](guides/engines)** — swap the JDK engine for Jetty in one line for HTTP/2 and WebSockets.
- **[Scaling out](guides/scaling)** — Redis-backed rate-limit and session stores shared across instances.

> ✅ Secured, tested, observable, and ready to run more than one replica.

## Reference

Keep these open while you build:

- **[Modules](reference/modules)** — every artifact and what it pulls in.
- **[Architecture](reference/architecture)** — how core, SPIs and adapters fit together.
- **[Benchmarks](reference/benchmarks)** — the numbers behind the speed claims, and how they were measured.

---

Done with all six stages? You know Ligero. Build something and
[tell us how it went](https://github.com/ligero-framework/ligero/discussions).
