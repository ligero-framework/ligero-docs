---
sidebar_position: 11
---

# Testing

## End-to-end with ligero-test

`ligero-test` starts your app on an **ephemeral port** and drives it over real
HTTP:

```groovy
testImplementation "com.ligeroframework:ligero-test:$ligeroVersion"
```

```java
@Test
void createsUsers() {
    try (LigeroTest test = LigeroTest.create(app -> {
        app.post("/users", ctx -> ctx.status(201).json(Map.of("ok", true)));
    })) {
        LigeroTest.TestResponse response = test.post("/users")
            .json("{\"name\":\"Ada\"}")
            .execute();

        assertEquals(201, response.status());
        assertTrue(response.body().contains("ok"));
        assertEquals("application/json", response.header("content-type"));
    }
}
```

`LigeroTest.start(app)` attaches to a pre-built app (configure it with port 0).

## Unit tests without a server

Because the engine is an SPI, you can inject an in-memory fake and exercise the
whole pipeline — routing, middleware, error mapping — without opening a socket:

```java
class FakeEngine implements ServerEngine {
    HttpHandler root;
    public void start(EngineConfig cfg, HttpHandler root) { this.root = root; }
    public void stop(Duration grace) {}
    public int port() { return 0; }
}

FakeEngine engine = new FakeEngine();
app.engine(engine);
app.start();
engine.root.handle(fakeRequest, fakeResponse);  // drive it directly
```

This is exactly how the framework tests itself (158 tests, both styles).

## What `ligero new` gives you

Every scaffolded project ships a ready **`ApplicationTest`** that boots the app
with `ligero-test` and hits a route — a working example to copy for your own
features, and a green baseline from the first commit. Repositories and services
are bound **as interfaces**, so a test can swap the repository for an in-memory
fake without touching the rest of the wiring.

While you write tests, keep [devtools](./devtools.md) open at `/ligero/dev`: the
bean graph and per-request traces make it obvious which layer a failing call
stops in.

## Shared test helpers

`ligero-test` **is** the shared-helpers story — a normal, versioned, documented
dependency (`testImplementation "com.ligeroframework:ligero-test:$ligeroVersion"`),
not a special build coordinate. There is intentionally **no Gradle
`testFixtures` variant** to consume: one obvious path keeps the POM small and
avoids two ways to pull in the same helpers. If you need helpers shared across
*your own* modules, put them in an ordinary test-support module (or your own
`testFixtures`) — that's an app-level choice, not something the framework
imposes.
