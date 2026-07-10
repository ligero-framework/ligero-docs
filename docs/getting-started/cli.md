---
sidebar_position: 3
---

# The Ligero CLI

[`ligero-cli`](https://github.com/ligero-framework/ligero-cli) scaffolds
ready-to-run projects — including Docker packaging and an optional database.

## Install

The CLI ships as a **native binary** (built with GraalVM) — no JVM required,
near-instant startup.

**macOS / Linux:**

```bash
curl -fsSL https://github.com/ligero-framework/ligero-cli/releases/latest/download/install.sh | sh
```

**Windows** (PowerShell):

```powershell
irm https://github.com/ligero-framework/ligero-cli/releases/latest/download/install.ps1 | iex
```

Both download the binary for your OS into `~/.ligero/bin` and add it to your
`PATH`. Open a new terminal and check it with `ligero version`. You can also
grab the binary (or the JVM `ligero-<version>.zip`) directly from the
[latest release](https://github.com/ligero-framework/ligero-cli/releases/latest),
or — once available — `sdk install ligero` via [SDKMAN!](https://sdkman.io).

## Scaffold a project

```bash
ligero new my-api --package com.acme.api            # modular app
ligero new my-api --db postgres                     # + PostgreSQL via Docker Compose
ligero new my-api --db h2                            # + in-memory H2 (nothing to install)
ligero new my-api --wiring processor                # annotate-only DI (compile-time generated)
ligero generate resource Order                       # a whole CRUD slice (module + layers), wired
```

## Wiring: `--wiring explicit` (default) or `--wiring processor`

- **`explicit`** — hand-written modules with `bind(...)`; `ligero generate`
  weaves new artifacts into them. Fully reflection-free.
- **`processor`** — you only annotate classes; the optional
  [`ligero-processor`](../guides/dependency-injection.md#optional-generate-the-wiring-at-compile-time)
  generates the same `bind(...)` at compile time (still no runtime
  reflection). No module to edit — add a feature by writing an annotated
  class. See the [DI guide](../guides/dependency-injection.md) for the
  before/after.

## What `new` generates

A **modular, layered** application (see the
[architecture guide](../guides/architecture.md)): `Application` lists
modules, and a `GreetingModule` owns the greeting slice — its beans and
routes — wired with the [`Beans` container](../guides/dependency-injection.md)
and ready to debug with [devtools](../guides/devtools.md).

```
Application.java                          lists modules — no wiring here
greeting/GreetingModule.java              this slice's beans + routes (with anchors)
greeting/GreetingController.java          @Controller  — routes -> service
greeting/GreetingService.java             interface    — business layer
greeting/DefaultGreetingService.java      @Service
greeting/GreetingRepository.java          interface    — data-access layer
greeting/InMemoryGreetingRepository.java  @Repository (default)
greeting/JdbcGreetingRepository.java      @Repository (with --db)
```

- Repositories and services are bound **as interfaces**, so the generated
  test swaps the repository in-memory and devtools traces calls through them.
- The module owns its DB wiring (`DataSource` bean + `db` health check with
  `--db`); `Application` stays free of dependency wiring.
- Gradle build wired to `ligero-core`, `ligero-devtools`, `ligero-server-jdk`,
  `ligero-json`.
- An end-to-end test using `ligero-test`
- **`Dockerfile`** (multi-stage: Gradle build → slim JRE runtime)
- **`docker-compose.yml`** — with `--db postgres` it includes a PostgreSQL 16
  service with healthcheck and seed data (`db/init.sql`)

## Run it

```bash
cd my-api
gradle run                  # local, http://localhost:8080
gradle test                 # e2e test on an ephemeral port
docker compose up --build   # containerized (app + db when --db postgres)

curl localhost:8080/hello/world     # {"hello":"Hola, world!"}
curl localhost:8080/api/greetings   # rows from the repository (seeded with --db)
curl localhost:8080/health          # {"status":"UP","checks":{"db":"UP"}} (with --db)
```

Then open **http://localhost:8080/ligero/dev**: the bean graph and a live
trace of each request through controller → service → repository.

## Generators (auto-registered, like Angular's CLI)

Every generator writes the file **and** wires it into its module — the
binding, the route, and (for modules) the entry in `Application.modules()`.
No manual registration step.

```bash
ligero generate module Billing            # empty feature module, registered in Application
ligero generate repository Invoice        # interface + in-memory impl, bound in the module
ligero generate service Invoice           # interface + default impl (injects the repository if present)
ligero generate controller Invoice        # controller + route, bound in the module
ligero generate resource Invoice          # all of the above at once: a full CRUD slice
```

| Generator | Creates | Auto-wires |
|---|---|---|
| `module <Name>` | `<name>/<Name>Module.java` | registers it in `Application.modules()` |
| `repository <Name>` | `<Name>Repository` + `InMemory<Name>Repository` | `builder.bind(...)` in the module |
| `service <Name>` | `<Name>Service` + `Default<Name>Service` | binding (injects `<Name>Repository` if it exists) |
| `controller <Name>` | `<Name>Controller` | binding + `register(app)` route (needs its service) |
| `resource <Name>` | module + domain + repository + service + controller | every binding, the route, and the module registration |

Pick the target module with `--module <Name>`. With a single module it's
inferred; with several, it's required.

```bash
ligero generate service Invoice --module Billing
```

How it works: generated files carry `// ligero-cli:*` anchor comments, and
the generators insert new lines just above them — so the wiring stays in
ordinary, reviewable Java you can also edit by hand.

## Database options

| Flag | What you get |
|---|---|
| *(none)* | No persistence — pure API |
| `--db h2` | In-memory H2, schema created on startup. Ideal to try things instantly. |
| `--db postgres` | Real PostgreSQL in Compose, seeded via `db/init.sql`; the app reads `DB_URL`/`DB_USER`/`DB_PASSWORD` (already set in Compose). |

## About the CLI itself

`ligero-cli` is written in **Java** (zero runtime dependencies) — it scaffolds
Java projects, and its templates are type-checked Java, so Java is the natural
home. It is **not** a Python tool.

For distribution there are two options:

- **Runnable jar / install dist** — works anywhere a JVM is present.
- **GraalVM native image** — compile the CLI to a single self-contained binary
  (`ligero`) with no JVM required, so it installs and starts like any native
  CLI. This is the recommended distribution path; the CLI does no reflection,
  so it builds native cleanly.

## `ligero dev` — hot reload

Run the app and restart it on every source change — a simple watch → rebuild →
restart loop, no extra dependencies.

```bash
cd my-api
ligero dev        # runs the app, restarts on changes under src/main (Ctrl+C to stop)
```

It launches the app via Gradle (`./gradlew run` when a wrapper is present,
otherwise `gradle run`), watches the whole `src/main` tree and debounces bursts
of saves into one restart.
