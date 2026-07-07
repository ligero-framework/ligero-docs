---
sidebar_position: 17
---

# Data Access (JDBC & JPA)

Ligero doesn't impose a persistence layer. It gives you the primitives to plug
in whatever you like — and a thin JPA helper for teams that want an ORM
without ceremony.

## The spectrum

| Approach | When | How |
|---|---|---|
| **Raw JDBC** | full control, zero magic, smallest footprint | bind a `DataSource` as a bean, write SQL |
| **`ligero-jdbc`** | SQL without the boilerplate, still no ORM | `Jdbc` helper: `query`/`update`/`tx` mapping rows to records |
| **`ligero-jpa`** | you want JPA/Hibernate but no ceremony | `Jpa` helper over an `EntityManagerFactory` |
| **jOOQ / MyBatis / Spring Data** | you already know and want them | bind them as beans — nothing stops you |

Whatever you choose, it's just a **bean** in your module. Ligero has no opinion
baked into the core.

## Raw JDBC

Bind a pooled `DataSource` and use it directly. This is what the
[`layered-api`](https://github.com/ligero-framework/ligero-examples) example does:

```java
public void beans(Beans.Builder b) {
    b.bind(DataSource.class,        x -> Db.hikari(config));
    b.bind(ProductRepository.class, x -> new JdbcProductRepository(x.get(DataSource.class)));
}
```

```java
public List<Product> findAll() {
    try (Connection c = dataSource.getConnection();
         Statement s = c.createStatement();
         ResultSet rs = s.executeQuery("SELECT id, name FROM products ORDER BY id")) {
        List<Product> out = new ArrayList<>();
        while (rs.next()) out.add(new Product(rs.getLong(1), rs.getString(2)));
        return out;
    } catch (SQLException e) { throw new IllegalStateException(e); }
}
```

## Lighter than an ORM: `ligero-jdbc`

`ligero-jdbc` keeps you writing SQL, but takes the boilerplate — connections,
statements, result-set loops, transactions — off your hands. Rows map to your
records via a `RowMapper`.

```groovy
implementation 'com.ligero:ligero-jdbc:0.2.0-SNAPSHOT'
```

```java
Jdbc db = new Jdbc(dataSource);
record Product(long id, String name) {}
RowMapper<Product> asProduct = r -> new Product(r.getLong("id"), r.getString("name"));

List<Product>     all = db.query("select id, name from products order by id", asProduct);
Optional<Product> one = db.queryOne("select id, name from products where id = ?", asProduct, 7);
long              id  = db.insert("insert into products(name) values (?)", "Keyboard"); // generated key
int              rows = db.update("update products set name = ? where id = ?", "Mouse", id);

// a transaction — commit on success, rollback on any exception
db.tx(tx -> {
    long pid = tx.insert("insert into products(name) values (?)", "Bundle");
    tx.update("insert into stock(product_id, qty) values (?, ?)", pid, 100);
    return pid;
});
```

Failures wrap the SQL in a `JdbcException`. No ORM, no reflection — just a thin,
predictable layer you can read in one file.

## JPA / Hibernate with `ligero-jpa`

`ligero-jpa` is a thin, explicit helper over a JPA `EntityManagerFactory` — no
open-session-in-view, no thread-locals, no proxies you didn't ask for.

```groovy
implementation 'com.ligero:ligero-jpa:0.2.0-SNAPSHOT'
// bring your own provider + driver:
runtimeOnly 'org.hibernate.orm:hibernate-core:6.6.4.Final'
runtimeOnly 'com.h2database:h2:2.3.232'
```

Only the JPA **API** is a compile dependency of `ligero-jpa`; the provider
(Hibernate, EclipseLink, …) and JDBC driver are yours.

Declare a persistence unit in `META-INF/persistence.xml`:

```xml
<persistence version="3.1" xmlns="https://jakarta.ee/xml/ns/persistence">
  <persistence-unit name="app">
    <class>com.acme.Todo</class>
    <properties>
      <property name="jakarta.persistence.jdbc.url" value="jdbc:h2:mem:app;DB_CLOSE_DELAY=-1"/>
      <property name="hibernate.hbm2ddl.auto" value="update"/>
    </properties>
  </persistence-unit>
</persistence>
```

Then boot it as a bean and use it:

```java
@Repository
public class JpaTodoRepository implements TodoRepository {
    private final Jpa jpa;
    public JpaTodoRepository(Jpa jpa) { this.jpa = jpa; }

    public List<Todo> all() {
        return jpa.read(em ->
            em.createQuery("select t from Todo t order by t.id", Todo.class).getResultList());
    }
    public Todo add(String title) {
        return jpa.tx(em -> { Todo t = new Todo(title); em.persist(t); return t; });   // commit / rollback
    }
}

// module wiring — Jpa is AutoCloseable, the container closes it on shutdown
public void beans(Beans.Builder b) {
    b.bind(Jpa.class,            x -> Jpa.forUnit("app"));
    b.bind(TodoRepository.class, x -> new JpaTodoRepository(x.get(Jpa.class)));
}
```

- `jpa.tx(em -> ...)` runs the work in a transaction — commit on success,
  **rollback on any exception**.
- `jpa.read(em -> ...)` runs with a short-lived entity manager, no transaction.
- `Jpa.forUnit(name, Map.of(...))` overrides unit properties (e.g. the JDBC
  URL from your [config](configuration-yaml)).

See the [`jpa-todo`](https://github.com/ligero-framework/ligero-examples)
example for a complete, runnable CRUD app.

## Why no built-in ORM?

An ORM in the core would fight everything Ligero optimizes for — fast startup,
small footprint, native-image friendliness. Hibernate is powerful but heavy;
making it mandatory would tax every app, including the ones that just need
three SQL statements. So persistence stays a choice: raw JDBC by default, the
thin `ligero-jpa` helper when you want JPA, or your ORM of choice as a bean.
