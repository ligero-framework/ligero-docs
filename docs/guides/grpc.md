---
sidebar_position: 5
---

# gRPC

:::note Availability
Ships in the release after 0.8.0.
:::

`ligero-grpc` serves gRPC services ([grpc-java](https://grpc.io/docs/languages/java/))
on their own port, next to the HTTP server, with the same lifecycle.

```groovy
implementation 'com.ligeroframework:ligero-grpc:<version>'
```

Generate the service classes from your `.proto` files as usual (the
`com.google.protobuf` Gradle plugin with `protoc-gen-grpc-java`), then:

```java
public final class GreeterService extends GreeterGrpc.GreeterImplBase {
    @Override
    public void sayHello(HelloRequest request, StreamObserver<HelloReply> reply) {
        reply.onNext(HelloReply.newBuilder().setMessage("Hello, " + request.getName()).build());
        reply.onCompleted();
    }
}

GrpcServer grpc = GrpcServer.builder(9090)
    .service(new GreeterService())
    .health()                       // grpc.health.v1 for load balancers and Kubernetes
    .build();
grpc.attach(app);                   // starts with app.start(), drains on app.stop()
```

Each call runs on its own **virtual thread**, so service code can block —
JDBC, other services — exactly like an HTTP handler.

## Errors

Throw the same exceptions as in HTTP handlers:

| Thrown | gRPC status |
|---|---|
| `NotFoundException` (404) | `NOT_FOUND` with the message |
| `BadRequestException` (400) | `INVALID_ARGUMENT` |
| `UnauthorizedException` / `ForbiddenException` | `UNAUTHENTICATED` / `PERMISSION_DENIED` |
| `HttpException(409)` | `ABORTED` |
| `TooManyRequestsException` | `RESOURCE_EXHAUSTED` |
| `HttpException(503)` | `UNAVAILABLE` |
| `StatusRuntimeException` | as is |
| anything else | `UNKNOWN`, no detail (logged) |

## Limits and options

| Setting | Default |
|---|---|
| `maxMessageBytes` | 4 MiB |
| `maxMetadataBytes` | 8 KiB |
| `maxConcurrentCallsPerConnection` | 100 |
| `handshakeTimeout` | 20 s |
| `maxConnectionIdle` | 5 min |
| client keep-alive pings | at most every 30 s |
| `shutdownGrace` | 10 s |

- `.tls(certChainPem, privateKeyPem)` or `.credentials(...)` for mutual TLS.
- `.interceptor(...)` for authentication or logging around every call.
- `.reflection()` lets tools such as `grpcurl` discover the services. Use it in
  development: it also shows anyone who can connect what your API looks like.
- `grpc.setHealth("my.Service", false)` reports `NOT_SERVING`, e.g. while a
  dependency is down. While the server drains on stop, health checks already
  answer `NOT_SERVING`.
