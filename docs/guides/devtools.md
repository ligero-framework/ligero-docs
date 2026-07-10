---
sidebar_position: 14
---

# Devtools Dashboard

`ligero-devtools` is a **visual debugger for development**: a dashboard at
`/ligero/dev` that shows your bean dependency graph and a live trace of every
request through the layers — controller → service → repository — with
arguments, return values and timing per call.

```groovy
// build.gradle — development only, never ship it
implementation 'com.ligeroframework:ligero-devtools:0.5.0'
```

```java
Devtools devtools = Devtools.create();

Beans beans = Beans.builder()
    .bind(NameRepo.class,     b -> new JdbcNameRepo(b.get(DataSource.class)))
    .bind(GreetService.class, b -> new DefaultGreetService(b.get(NameRepo.class)))
    .instrument(devtools.recorder())   // spies interface-typed beans
    .start();

Ligero app = Ligero.create();
app.beans(beans);
devtools.install(app, beans);          // mounts /ligero/dev — call before app.start()
app.get("/greet/{id}", ctx -> ctx.text(ctx.get(GreetService.class).greet(ctx.pathParamAsInt("id"))));
app.start(8080);
```

Open **http://localhost:8080/ligero/dev** and you get two tabs.

## Beans tab — the dependency graph

The graph from [`beans.graph()`](dependency-injection.md), drawn left to
right — consumers → dependencies — with each node colored by stereotype:

- `@Controller` — blue
- `@Service` — green
- `@Repository` — orange
- `@Component` — purple
- unannotated — gray

The stereotype is read from the **implementation class** even when the bean
is bound as an interface, so `bind(Repo.class, b -> new JdbcRepo(...))` with
`@Repository` on `JdbcRepo` shows up orange.

## Requests tab — live traces

Every request your app handles appears **instantly** (pushed over SSE):
method, path, status, duration and how many bean calls it made. Click a row
to unfold the trace through the layers:

```
[service]    DefaultGreetService.greet(7) → hello user-7 · 180 µs
    [repository] FixedNameRepo.find(7) → user-7 · 12 µs
```

Each line is one spied call — `bean.method(args) → result` — with nesting
depth, a truncated preview of the return value, and elapsed time. Failed
calls show the exception in red. This is "spying the layers": you see what
the service asked the repository and what came back, per request, without a
debugger or a single log line.

## How the spying works

- `devtools.recorder()` is a [`BeanDecorator`](dependency-injection.md#instrumentation-hook):
  beans bound **as interfaces** get wrapped in a JDK dynamic proxy (no
  bytecode generation, no agents).
- Beans bound as concrete classes can't be proxied; they pass through
  untouched and the dashboard lists them so it's obvious why their calls
  don't appear. Bind by interface if you want them traced.
- A middleware opens one trace per request (reusing the `requestId`
  attribute when the request-id middleware is on) and keeps the last 100.
- Devtools endpoints themselves are never traced.

## Endpoints

| Endpoint | What |
|---|---|
| `GET /ligero/dev` | the dashboard (self-contained HTML — no CDN assets) |
| `GET /ligero/dev/api/graph` | bean graph JSON (nodes, edges, unspied list) |
| `GET /ligero/dev/api/requests` | last 100 traces, most recent first |
| `GET /ligero/dev/api/stream` | SSE stream of completed traces |

## Production

Don't install devtools in production — it exposes arguments and return
values of your beans. Two switches:

1. **Classpath** (recommended): keep the dependency out of your production
   build; there is zero overhead because nothing is there.
2. **Environment**: `LIGERO_DEVTOOLS=false` turns `install()` into a no-op
   without a code change.
