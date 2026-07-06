---
sidebar_position: 15
---

# Architecture (layers & modules)

Ligero doesn't force an architecture on you, but it **promotes one** — the
shape the CLI scaffolds, the examples follow and the devtools dashboard
visualizes. It's the familiar layered design (the same one Spring Boot
teaches), organized into feature modules (the idea behind Angular modules),
with the wiring kept explicit and compiler-checked.

## The layers

A request flows top to bottom; each layer depends only on the one below it,
through an **interface**:

```
HTTP  →  Controller  →  Service  →  Repository  →  data
         @Controller    @Service    @Repository
```

| Layer | Responsibility | Rule of thumb |
|---|---|---|
| **Controller** | HTTP only: parse, validate, status codes | no business logic; calls a service |
| **Service** | business logic, orchestration | no HTTP types, no SQL; depends on repository interfaces |
| **Repository** | data access | an interface + one implementation per backing store |
| **Domain** | entities / records | plain data, no framework imports |

Why interfaces between layers? Three payoffs: you swap implementations
(in-memory ↔ JDBC) without touching callers; tests inject fakes; and
**devtools** can wrap them in spy proxies to trace every call.

```java
public interface ProductRepository {          // data-access contract
    List<Product> findAll();
    Optional<Product> findById(long id);
}

@Repository                                    // metadata: colors the devtools node
public class JdbcProductRepository implements ProductRepository { ... }

@Service
public class DefaultProductService implements ProductService {
    private final ProductRepository repository;      // depends on the interface
    public DefaultProductService(ProductRepository repository) {
        this.repository = repository;
    }
}

@Controller
public class ProductController {
    private final ProductService service;            // depends on the interface
    public ProductController(ProductService service) { this.service = service; }
    public void register(Ligero app) { /* routes -> service */ }
}
```

The [stereotype annotations](dependency-injection.md#stereotypes-metadata-never-magic)
are **pure metadata** — they classify the layer for the dashboard and never
drive injection.

## Feature modules

A large app is a set of vertical slices. A **module** groups everything for
one feature — its controller, service, repository and routes — and declares
its own wiring, so the startup class never grows:

```java
public final class ProductsModule implements LigeroModule {

    @Override
    public void beans(Beans.Builder builder) {
        builder.bind(ProductRepository.class, b -> new JdbcProductRepository(b.get(DataSource.class)));
        builder.bind(ProductService.class,    b -> new DefaultProductService(b.get(ProductRepository.class)));
        builder.bind(ProductController.class, b -> new ProductController(b.get(ProductService.class)));
    }

    @Override
    public void routes(Ligero app, Beans beans) {
        beans.get(ProductController.class).register(app);
    }
}
```

`Application` just lists modules — no dependency wiring lives here:

```java
public class Application {
    public static Ligero create() {
        Ligero app = Ligero.create(8080);
        Devtools devtools = Devtools.create();
        Beans beans = Modules.install(app, devtools.recorder(), modules());
        devtools.install(app, beans);
        return app;
    }

    static LigeroModule[] modules() {
        return new LigeroModule[] { new ProductsModule(), new UsersModule() };
    }
}
```

All modules contribute to **one** [`Beans`](dependency-injection.md)
container, so a module can depend on beans another module provides (a shared
`DataSource` from an infrastructure module, say). Cross-module dependencies
resolve naturally; binding the same type twice fails fast at startup.

### Directory layout

```
com/acme/shop/
  Application.java              lists modules — no wiring
  greeting/
    GreetingModule.java         this slice's beans + routes
    GreetingController.java
    GreetingService.java   DefaultGreetingService.java
    GreetingRepository.java   InMemoryGreetingRepository.java
  products/
    ProductsModule.java
    ...
```

## The CLI wires it for you

The [CLI](../getting-started/cli.md) generates this structure and, like
Angular's CLI, **auto-registers** every artifact into its module:

```bash
ligero new shop                       # modular app, one greeting module
ligero generate resource Product      # a whole CRUD slice, module wired + listed in Application
ligero generate module Billing        # empty module, registered in Application
ligero generate repository Invoice --module Billing   # + binding in BillingModule
ligero generate service Invoice --module Billing      # + binding (injects the repository)
ligero generate controller Invoice --module Billing   # + binding and route
```

Each command writes the file **and** inserts the binding/route/registration
for you — no manual wiring step.

## Other architectures

Layers-and-modules is the default, not a mandate. The
[`hexagonal-todo`](https://github.com/ligero-framework/ligero-examples)
example shows **ports & adapters** on the same primitives; the
[`layered-api`](https://github.com/ligero-framework/ligero-examples) example
shows the same layers wired **by hand** in a composition root, with no
container at all. Ligero's core stays out of your way — pick the structure
that fits, and the tooling supports the promoted one.
