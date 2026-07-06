---
sidebar_position: 3
---

# The Ligero CLI

[`ligero-cli`](https://github.com/ligero-framework/ligero-cli) scaffolds
ready-to-run projects — including Docker packaging and an optional database.

```bash
ligero new my-api --package com.acme.api            # plain API
ligero new my-api --db postgres                     # + PostgreSQL via Docker Compose
ligero new my-api --db h2                           # + in-memory H2 (nothing to install)
ligero generate controller User                     # CRUD controller with validation
```

## What `new` generates

A **layered** application, wired with the
[`Beans` container](../guides/dependency-injection.md) and ready to debug
visually with [devtools](../guides/devtools.md):

```
Application.java                        composition root: Beans wiring + devtools
greeting/GreetingController.java        @Controller  — routes -> service
greeting/GreetingService.java           interface    — business layer
greeting/DefaultGreetingService.java    @Service
greeting/GreetingRepository.java        interface    — data-access layer
greeting/InMemoryGreetingRepository.java  @Repository (default)
greeting/JdbcGreetingRepository.java      @Repository (with --db)
```

- Repositories and services are bound **as interfaces**, so the generated
  test swaps the repository in-memory and devtools traces calls through them.
- Gradle build wired to `ligero-core`, `ligero-devtools`, `ligero-server-jdk`,
  `ligero-json`; with `--db` a `DataSource` bean plus a `db` health check.
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

## Database options

| Flag | What you get |
|---|---|
| *(none)* | No persistence — pure API |
| `--db h2` | In-memory H2, schema created on startup. Ideal to try things instantly. |
| `--db postgres` | Real PostgreSQL in Compose, seeded via `db/init.sql`; the app reads `DB_URL`/`DB_USER`/`DB_PASSWORD` (already set in Compose). |
