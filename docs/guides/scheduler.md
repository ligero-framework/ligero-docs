---
sidebar_position: 1
---

# Scheduling background tasks

`ligero-scheduler` runs periodic and one-off background jobs. Timing runs on a
tiny daemon pool, but **each task runs on its own virtual thread** — so a slow
job never stalls the timer, and a job that throws never cancels its own schedule
(the error is logged, the schedule keeps ticking).

:::info Install with the CLI
```bash
ligero add scheduler
```
:::

```groovy
implementation "com.ligeroframework:ligero-scheduler:$ligeroVersion"
```

## Quick start

```java
try (Scheduler scheduler = new Scheduler()) {
    scheduler.fixedRate(Duration.ofMinutes(5), cache::evictExpired);
    scheduler.dailyAt(LocalTime.of(3, 0), ZoneId.systemDefault(), reports::nightly);
    scheduler.once(Duration.ofSeconds(2), () -> log.info("warm-up done"));

    app.onStop(scheduler::close);   // stop jobs when the app stops
    app.start();
}
```

Register the `Scheduler` as a bean and the `Beans` container closes it on
shutdown (it's `AutoCloseable`).

## API

| Method | Runs the task… |
|---|---|
| `fixedRate(period, task)` | every `period`, measured from each start |
| `fixedDelay(delay, task)` | repeatedly, waiting `delay` **between** completions |
| `once(after, task)` | once, after a delay |
| `dailyAt(time, zone, task)` | every day at a wall-clock time |

Each returns a `ScheduledTask` with `cancel()`.

## Notes

- **Virtual threads** — the daemon pool only *fires* tasks; the work itself runs
  on a fresh virtual thread, so long/blocking jobs are cheap and never block the
  timer.
- **Failures are isolated** — an exception in a task is logged and the schedule
  continues (unlike a raw `ScheduledExecutorService`, which cancels on throw).
- **Distributed schedules** — this is in-process. For cluster-wide "run once
  across all instances", guard the task with a lock (e.g. a Redis key).
