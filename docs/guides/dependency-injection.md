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
