---
sidebar_position: 18
---

# Scaling Out (Distributed Stores)

Rate limiting and sessions keep state. By default that state lives **in
memory** — perfect for a single instance, but each replica has its own copy
once you run several behind a load balancer. `ligero-redis` moves that state
into Redis so it's shared across every instance.

Both are just SPI implementations — the middleware doesn't change, you swap the
store.

```groovy
implementation 'com.ligeroframework:ligero-redis:0.5.0'
```

```java
JedisPool pool = new JedisPool("redis-host", 6379);
```

## Distributed rate limiting

A fixed-window counter in Redis: one atomic `INCR` per window, keyed by
`ratelimit:<key>:<window>`, and the key expires with the window so old buckets
clean themselves up. A limit of "N per window" is then enforced across the
whole cluster.

```java
RateLimiterStore limiter =
    RedisRateLimiterStore.usingJedis(pool, 100, Duration.ofMinutes(1));

app.use(RateLimitMiddleware.of(limiter));   // 100 req/min per client, cluster-wide
```

Swap `RedisRateLimiterStore` for the default in-memory token bucket and every
replica shares the same budget.

## Distributed sessions

Each session becomes a Redis hash (`session:<id>`) with a **sliding TTL**, so
sessions survive across instances and restarts.

```java
SessionStore sessions = RedisSessionStore.usingJedis(pool, Duration.ofHours(1));

app.use(SessionMiddleware.of(secret, sessions));
```

`SessionMiddleware` flushes changes after each request (via a `save()` hook on
the `SessionStore` SPI — a no-op for the in-memory store), so attribute writes
during a request are persisted to Redis automatically.

:::note Attribute values are strings
The Redis session store stores attribute values as strings
(`String.valueOf(value)`). Sessions are meant for small data — a user id,
roles, a flag. Put large or structured state in your database, not the session.
:::

## Testing without Redis

Both stores sit behind a small `RedisOps` seam, so their logic is unit-tested
against an in-memory fake — no Redis needed in CI. The shipped
`JedisRedisOps` is the real adapter; you could write another for Lettuce or a
managed client.

## Health checks

Wire a Redis ping into your readiness probe so an unavailable Redis surfaces:

```java
app.use(HealthMiddleware.builder()
    .check("redis", () -> { try (var j = pool.getResource()) { return "PONG".equals(j.ping()); } })
    .build());
```
