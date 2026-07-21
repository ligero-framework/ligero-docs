---
sidebar_position: 2
---

# Caching

Ligero ships a small `Cache<K,V>` abstraction with a load-through helper and
TTLs. The in-process `InMemoryCache` lives in `ligero-core`; a distributed
`RedisCache` ships in `ligero-redis`. Program against the interface so you can
swap between them.

:::info Install with the CLI
```bash
ligero add cache          # in-process (ligero-core)
ligero add redis          # + distributed RedisCache
```
:::

`InMemoryCache` needs no extra dependency (it's in `ligero-core`).

## Quick start

```java
Cache<String, User> users = new InMemoryCache<>();

// load-through: compute + cache on miss, with a 10-minute TTL
User u = users.get(id, Duration.ofMinutes(10), db::findUser);

users.put("token", value, Duration.ofSeconds(30));
users.evict(id);
```

## API

| Method | Description |
|---|---|
| `get(key)` | `Optional<V>` — empty when absent or expired |
| `put(key, value)` / `put(key, value, ttl)` | store, optionally with a TTL |
| `get(key, loader)` / `get(key, ttl, loader)` | return cached value, else compute + cache |
| `evict(key)` / `clear()` | remove one / all entries |

## Distributed cache (Redis)

```java
Cache<String, String> cache = RedisCache.usingJedis(pool);
String json = cache.get(id, Duration.ofMinutes(10), this::loadUserJson);
```

`RedisCache` is a **string** cache — serialize structured data (e.g. to JSON)
before caching it. Keys are namespaced under `cache:` by default. `clear()` is
intentionally unsupported (flushing a shared Redis is unsafe) — evict specific
keys instead.

## Notes

- `InMemoryCache` expires entries **lazily** (on access). Pair it with a
  [`Scheduler`](./scheduler.md) task if you want periodic sweeping of entries
  that are never read again.
- Load-through uses an atomic compute, so concurrent callers for the same key
  load at most once.
