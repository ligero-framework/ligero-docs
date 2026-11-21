---
sidebar_position: 6
---

# Messaging

:::note Availability
Ships in the release after 0.8.0.
:::

Three modules with the same shape — send, listen, attach to the app —
for the three families of brokers:

| Module | Brokers |
|---|---|
| `ligero-kafka` | Apache Kafka, Redpanda, Confluent, MSK, ... |
| `ligero-jms` | any Jakarta Messaging broker: ActiveMQ Artemis, IBM MQ, Amazon MQ, ... |
| `ligero-amqp` | any AMQP 1.0 broker: RabbitMQ 4, ActiveMQ Artemis, Azure Service Bus, Solace, ... |

All three:

- send objects as **JSON** (with `ligero-json` on the classpath) and `String`s as they are;
- read each message into the type the listener asks for — **never Java
  serialization**, a well-known path to remote code execution;
- run every listener on a **virtual thread**;
- deliver **at least once**: a message is acknowledged only after the handler
  returns, so make handlers idempotent;
- start with the app and stop with it (`attach(app)`), letting the message in
  hand finish.

## Kafka

```java
Kafka kafka = Kafka.builder()
    .bootstrapServers("kafka-1:9092,kafka-2:9092")
    .groupId("shipping")
    .property("security.protocol", "SASL_SSL")     // any Kafka client setting
    .build();

kafka.listen("orders", OrderPlaced.class, order -> shipping.prepare(order));
kafka.attach(app);

kafka.send("orders", String.valueOf(order.id()), order);   // the key keeps one order's events in order
```

- The producer uses `acks=all` and idempotence: a retried send cannot
  duplicate or reorder records.
- Offsets are committed after each poll's records are handled.
- A failing handler is retried (2 more times by default, with a growing pause:
  `retries(n, backoff)`); then the record is copied to **`<topic>.DLT`** with
  `ligero.dlt.origin` and `ligero.dlt.error` headers, and consumption moves on —
  one bad record never blocks its partition.
- A value that cannot be read as the expected type goes to the dead-letter
  topic at once.
- `listenToRecords(topic, Type.class, record -> ...)` also gives the key,
  headers, partition and offset.

## JMS

```java
Jms jms = Jms.of(new ActiveMQConnectionFactory("tcp://broker:61616", user, password));

jms.listen("orders", OrderPlaced.class, 4, order -> shipping.prepare(order));   // 4 consumers
jms.attach(app);

jms.send("orders", new OrderPlaced(42, "ana@example.com"));
```

Each message is received in a transacted session, committed after the
handler returns. When the handler throws, the session rolls back and the
broker redelivers the message — and, past its redelivery limit, moves it to
its dead-letter queue (configure the limit on the broker). `ObjectMessage`s
are rejected and logged; unreadable messages are dropped with an error log
instead of being redelivered forever.

## AMQP 1.0

```java
Amqp amqp = Amqp.builder()
    .host("broker").port(5671).tls(true)
    .user("shop").password(System.getenv("AMQP_PASSWORD"))
    .build();

amqp.listen("orders", OrderPlaced.class, order -> shipping.prepare(order));
amqp.attach(app);

amqp.send("orders", new OrderPlaced(42, "ana@example.com"));
```

| Handler outcome | Delivery state | Broker does |
|---|---|---|
| returns | `accepted` | removes the message |
| throws | `modified` (delivery failed) | redelivers it; dead-letters it past its limit |
| body not readable | `rejected` | dead-letters or drops it, per its configuration |

`prefetch(n)` (default 10) bounds how many unacknowledged messages a listener
holds. With RabbitMQ, send to and listen on quorum queues addressed as
`/queues/<name>`.

## Security notes

Anyone who can write to a topic or queue can send your consumers data.
Validate payloads as you would request bodies, use the broker's
authentication and TLS, and keep consumers on their own credentials with
read-only rights where the broker allows it.
