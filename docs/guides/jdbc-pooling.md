---
sidebar_position: 2
---

# Connection pooling

`ligero-jdbc` builds pooled `DataSource`s with **HikariCP** — the connection
pool almost every JDBC app needs — through a one-line factory.

:::info Install with the CLI
```bash
ligero add jdbc --pool
```
:::

```groovy
implementation "com.ligeroframework:ligero-jdbc:$ligeroVersion"
```

## Quick start

```java
DataSource ds = DataSources.pooled(
    "jdbc:postgresql://localhost:5432/app", "app", secret);

Jdbc db = new Jdbc(ds);
List<Product> rows = db.query("select id, name from products", AS_PRODUCT);
```

The returned `HikariDataSource` is `AutoCloseable`, so registering it (or the
`Jdbc`) as a bean closes the pool on shutdown.

## Tuning the pool

```java
DataSource ds = DataSources.pooled(url, user, secret, cfg -> {
    cfg.setMaximumPoolSize(20);
    cfg.setPoolName("app-pool");
    cfg.setConnectionTimeout(3_000);
});
```

The customizer receives the raw `HikariConfig`, so anything Hikari supports is
available (pool size, timeouts, leak detection, health checks).

| Factory | Description |
|---|---|
| `DataSources.pooled(url, user, password)` | pooled DataSource with sensible defaults (`ligero-pool`) |
| `DataSources.pooled(url, user, password, cfg -> …)` | same, tuning the `HikariConfig` |

## Notes

- Bring the JDBC driver for your database (`org.postgresql:postgresql`,
  `com.h2database:h2`, …) — `ligero-jdbc` provides the pool and the query helper,
  not the driver.
- Prefer a different pool? `Jdbc` works over **any** `DataSource`; wire your own
  and skip `DataSources`.
