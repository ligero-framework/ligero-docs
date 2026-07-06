---
sidebar_position: 13
---

# Dependency Injection

Ligero ships a dependency container — `Beans`, in `ligero-core`, ~170 lines —
built around one idea: **your wiring is plain code the compiler checks**, not
annotations resolved by classpath scanning and reflection at startup.

```java
Beans beans = Beans.builder()
    .bind(DataSource.class,        b -> pgDataSource())
    .bind(ProductRepository.class, b -> new JdbcProductRepository(b.get(DataSource.class)))
    .bind(ProductService.class,    b -> new ProductService(b.get(ProductRepository.class)))
    .start();          // instantiates and validates the WHOLE graph here

Ligero app = Ligero.create();
app.beans(beans);      // every bean available to handlers via ctx.get(...)

app.get("/products/{id}", ctx ->
    ctx.json(ctx.get(ProductService.class).find(ctx.pathParamAsInt("id"))));
```

## Why lambdas instead of `@Autowired`

| | Scanning + reflection (Spring style) | `Beans` (lambdas) |
|---|---|---|
| Missing dependency | runtime error, sometimes deep in a request | **compile error** or fail-fast at `start()` |
| Startup cost | scan classpath, build metadata, reflective injection | **plain constructor calls** |
| "Where does this come from?" | search annotations across the codebase | **Ctrl+click the lambda** |
| GraalVM native | needs reachability metadata / build-time processors | works as-is (no reflection) |

Measured on a 100-bean chain (fresh JVMs, median of 5 runs): wiring with
`Beans` costs **~65 ms** — almost all of it plain class-loading — vs
~400 ms for Guice 7 and ~555 ms for Spring 6.2 with component scanning.

## The API

### Binding

```java
Beans beans = Beans.builder()
    .bind(Repo.class, b -> new JdbcRepo(b.get(DataSource.class)))  // lazy singleton
    .bindInstance(Config.class, config)                            // existing object
    .start();      // eager: build everything, fail fast
// or .buildLazy() — beans are created on first get()
```

Each binding is a **memoized singleton**: the factory runs once, every
`get()` after that returns the same instance.

### Fail-fast validation

`start()` resolves the whole graph immediately, so a broken wiring can never
reach a request:

```
No binding for interface com.acme.Mailer (needed by com.acme.SignupService)
Dependency cycle: SignupService -> Mailer -> SignupService
```

### Collections, lifecycle

```java
List<HealthCheck> checks = beans.all(HealthCheck.class); // every bean assignable to the type

beans.close(); // closes AutoCloseable beans in reverse creation order
```

## Stereotypes: metadata, never magic

`@Component`, `@Service`, `@Repository` and `@Controller` exist so that tools
(like the [devtools dashboard](devtools.md)) can classify your beans. They
**never** trigger scanning or reflective injection — wiring stays 100 % in
your lambdas:

```java
@Repository
public class JdbcProductRepository implements ProductRepository { ... }

@Service
public class ProductService { ... }
```

`beans.graph()` returns the typed dependency graph — nodes tagged by
stereotype, edges captured from the *real* resolution order — which is
exactly what the devtools dashboard draws.

## Instrumentation hook

`Beans.Builder.instrument(BeanDecorator)` lets a tool wrap every bean as it
is created. Devtools uses it to spy interface-typed beans in development; in
production no decorator exists, so beans are exactly the objects your
lambdas returned.

```java
Beans beans = Beans.builder()
    .bind(...)
    .instrument(devtools.recorder())   // dev only
    .start();
```

## A layered application

The pattern we recommend (and the one the CLI generates): one **composition
root** where the whole object graph is declared, layer by layer.

```java
public final class Application {

    public static Beans wire(Devtools devtools) {
        return Beans.builder()
            // infrastructure
            .bind(DataSource.class,         b -> Db.pooledDataSource())
            // repositories (interface -> implementation)
            .bind(ProductRepository.class,  b -> new JdbcProductRepository(b.get(DataSource.class)))
            // services
            .bind(ProductService.class,     b -> new DefaultProductService(b.get(ProductRepository.class)))
            // controllers
            .bind(ProductController.class,  b -> new ProductController(b.get(ProductService.class)))
            .instrument(devtools.recorder())
            .start();
    }
}
```

Binding repositories and services **as interfaces** keeps layers swappable
(JDBC ↔ in-memory for tests) and lets devtools trace calls through them.

## Modules: split the wiring by feature

One `wire(...)` method works for a small app, but it grows. Group each
feature's bindings and routes into a `LigeroModule` and let `Modules.install`
assemble them — the wiring leaves the startup class entirely. See the
[architecture guide](architecture.md) for the full picture; in short:

```java
public final class ProductsModule implements LigeroModule {
    @Override public void beans(Beans.Builder builder) {
        builder.bind(ProductRepository.class, b -> new JdbcProductRepository(b.get(DataSource.class)));
        builder.bind(ProductService.class,    b -> new DefaultProductService(b.get(ProductRepository.class)));
        builder.bind(ProductController.class, b -> new ProductController(b.get(ProductService.class)));
    }
    @Override public void routes(Ligero app, Beans beans) {
        beans.get(ProductController.class).register(app);
    }
}

// startup:
Beans beans = Modules.install(app, devtools.recorder(), new ProductsModule(), new UsersModule());
```

All modules share one container (cross-module dependencies resolve
naturally; duplicate bindings fail fast). The [CLI](../getting-started/cli.md)
generates modules and auto-registers artifacts into them.

## Optional: generate the wiring at compile time

The explicit style is the default because it's the fastest and reflection-free.
But if the `bind(...)` lines feel like boilerplate, an **opt-in** annotation
processor (`ligero-processor`) writes them for you **at compile time** — no
classpath scanning, no runtime reflection. It reads your stereotype
annotations and generates the *same* explicit bindings.

Turn it on with one dependency:

```groovy
// build.gradle
annotationProcessor 'com.ligero:ligero-processor:0.2.0-SNAPSHOT'
```

Then you just annotate — no module, no `bind(...)`:

```java
@Repository class JdbcProductRepository implements ProductRepository {
    JdbcProductRepository(DataSource ds) { ... }          // the constructor IS the wiring
}
@Service class DefaultProductService implements ProductService {
    DefaultProductService(ProductRepository repo) { ... }
}
@Controller class ProductController {
    ProductController(ProductService service) { ... }
    public void register(Ligero app) { ... }
}

// third-party beans (a DataSource) come from a @Provides static method:
@Provides static DataSource dataSource() { ... }

// startup — the processor generated GeneratedModules for you:
Beans beans = Modules.install(app, devtools.recorder(), GeneratedModules.all());
```

The processor emits one `LigeroModule` per package plus a single
`GeneratedModules.all()`. The generated code is **byte-for-byte** what you'd
write by hand, so startup speed and native-image behavior are identical —
you're just not typing it.

| | Explicit (default) | With the processor |
|---|---|---|
| Wiring | you write `bind(...)` | generated from annotations |
| Runtime reflection | none | none |
| Native image | clean | clean |
| Startup | fastest | identical |
| Config knobs | — | `@Service(as = X.class)` to pick the key; `@Provides` for third-party beans; `@Inject` to disambiguate a constructor |

The two styles **mix**: pass hand-written modules and `GeneratedModules.all()`
together to `Modules.install`. Remove the dependency and you're back to
explicit wiring. Scaffold either with `ligero new --wiring=explicit`
(default) or `--wiring=processor`.

> Why not reflection-based auto-wiring (like Spring's `@Autowired`)? Because
> runtime reflection is exactly what makes those frameworks slow to start and
> awkward on GraalVM — the things Ligero is built to avoid. The processor
> gives you the brevity without the cost, by moving the work to compile time.
