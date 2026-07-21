---
sidebar_position: 6
---

# Application events & lifecycle

`ligero-core` includes a tiny in-process **event bus** and **lifecycle hooks**
so producers and consumers decouple without a message broker.

:::info Install with the CLI
```bash
ligero add events
```
:::

`Events` and the lifecycle hooks are in `ligero-core` — no extra dependency.

## Events

```java
Events events = new Events();

// subscribe by type (also delivered to supertype/interface subscribers)
events.subscribe(OrderPlaced.class, e -> mailer.confirm(e.orderId()));
events.subscribe(DomainEvent.class, e -> audit.record(e));

// publish anywhere you hold the bus
events.publish(new OrderPlaced(42));
```

- Delivery is **synchronous** and in subscription order.
- A subscriber matches the event's **exact type and any supertype/interface** it
  implements.
- A handler that **throws** is logged and does **not** stop the others.

Register the `Events` bus as a bean and inject it where you publish or subscribe.

## Lifecycle hooks

Run code when the server starts (port bound) and stops (before the engine shuts
down):

```java
app.onStart(() -> log.info("ready on {}", app.port()))
   .onStop(scheduler::close)
   .onStop(pool::close);
app.start();
```

Hooks run in registration order; a failing hook is logged and doesn't abort the
rest.

## Notes

- Use events for **in-process** decoupling (a write triggers a notification,
  an audit entry, a cache invalidation). For cross-service messaging, publish to
  a broker from a subscriber.
- Lifecycle hooks are the clean place to start/stop a [`Scheduler`](./scheduler.md),
  close a connection pool, or warm a [cache](./cache.md).
