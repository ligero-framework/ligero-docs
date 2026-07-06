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

- Gradle build wired to `ligero-core`, `ligero-server-jdk`, `ligero-json`
- `Application` with routes, middleware and (with `--db`) a `DataSource`
  registered for `ctx.get(DataSource.class)`, a `db` health check and a
  sample `/db/greetings` route
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

curl localhost:8080/health         # {"status":"UP","checks":{"db":"UP"}}
curl localhost:8080/db/greetings   # rows from the seeded table
```

## Database options

| Flag | What you get |
|---|---|
| *(none)* | No persistence — pure API |
| `--db h2` | In-memory H2, schema created on startup. Ideal to try things instantly. |
| `--db postgres` | Real PostgreSQL in Compose, seeded via `db/init.sql`; the app reads `DB_URL`/`DB_USER`/`DB_PASSWORD` (already set in Compose). |
