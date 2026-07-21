---
sidebar_position: 3
---

# Resilience

`ligero-resilience` hardens outbound calls (HTTP, DB, third-party SDKs) with
three dependency-free helpers: **retry**, **timeout** and **circuit breaker**.

:::info Install with the CLI
```bash
ligero add resilience
```
:::

```groovy
implementation "com.ligeroframework:ligero-resilience:$ligeroVersion"
```

## Retry

```java
String body = Retry.of(3, Duration.ofMillis(200))
    .exponential()                    // 200ms, 400ms, 800ms…
    .call(() -> http.get(url));       // retries on any RuntimeException
```

## Timeout

```java
// runs on a virtual thread; abandons (and interrupts) the call past the deadline
String body = Timeout.call(Duration.ofSeconds(2), () -> http.get(url));
```

## Circuit breaker

```java
CircuitBreaker breaker = new CircuitBreaker(5, Duration.ofSeconds(30));

String body = breaker.call(() -> http.get(url));
// after 5 consecutive failures it OPENS and fails fast (CircuitOpenException)
// for 30s, then HALF-OPENs and lets one trial through.
```

| State | Behaviour |
|---|---|
| `CLOSED` | calls pass through; failures are counted |
| `OPEN` | fails fast with `CircuitOpenException` for `openDuration` |
| `HALF_OPEN` | one trial call; success → `CLOSED`, failure → `OPEN` |

## Composing them

Wrap a call with several at once — timeout the attempt, retry it, and trip a
breaker on repeated failure:

```java
Retry.of(3, Duration.ofMillis(100)).call(() ->
    breaker.call(() ->
        Timeout.call(Duration.ofSeconds(1), () -> http.get(url))));
```

## Notes

- All three are **dependency-free** (JDK concurrency only) and thread-safe.
- Retry and the circuit breaker act on `RuntimeException`; wrap checked
  exceptions before entering, or let `Timeout` surface the task's own exception.
