---
sidebar_position: 6
---

# Security

Everything here comes from `ligero-auth` plus two core middlewares. Add:

```groovy
implementation 'com.ligero:ligero-auth:0.2.0-SNAPSHOT'
```

## JWT (HS256)

Signing and verification are implemented with `javax.crypto` — no external
dependencies. `alg=none` and algorithm-confusion tokens are rejected; signature
comparison is constant-time; `exp`/`nbf` are enforced.

```java
Jwt jwt = Jwt.hs256(secret, new JacksonBodyMapper()); // secret >= 32 bytes

// issue
String token = jwt.sign(Map.of("sub", "ada", "roles", List.of("admin")), Duration.ofHours(1));

// protect routes
app.use("/api", JwtAuthMiddleware.of(jwt));

app.get("/api/admin/stats", ctx -> {
    JwtAuthMiddleware.requireRole(ctx, "admin");   // 403 without the role
    String user = ctx.attribute(JwtAuthMiddleware.USER_ATTRIBUTE); // "sub" claim
    Map<String, Object> claims = ctx.attribute(JwtAuthMiddleware.CLAIMS_ATTRIBUTE);
    ...
});
```

## Basic auth

```java
app.use("/admin", BasicAuthMiddleware.of("Admin area",
    (user, password) -> store.matches(user, password)));
```

## CSRF

Stateless double-submit-cookie pattern: safe methods receive an `XSRF-TOKEN`
cookie; unsafe methods must echo it in the `X-XSRF-TOKEN` header or get `403`.

```java
app.use(new CsrfMiddleware());
```

## Sessions

The session id travels in an HMAC-signed cookie (unforgeable); state lives
behind the `SessionStore` SPI (in-memory by default, Redis-style stores pluggable).

```java
app.use(SessionMiddleware.of(secret));

app.post("/cart", ctx -> {
    Session session = ctx.attribute(SessionMiddleware.ATTRIBUTE);
    session.set("items", items);
});
```

## Security headers & rate limiting (core)

```java
app.use(SecurityHeadersMiddleware.builder()
    .hsts(Duration.ofDays(365))
    .contentSecurityPolicy("default-src 'self'")
    .build());
app.use(RateLimitMiddleware.of(100, 100)); // burst 100, 100 req/s per client IP
```

## Secure by default (OWASP baseline)

Every Ligero app starts with an OWASP-aligned baseline **enabled
automatically** — no code required:

- **Security headers** on every response: `X-Content-Type-Options: nosniff`,
  `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`.
- **Request hygiene**: paths carrying null bytes (`%00`), control characters
  or percent-encoded traversal (`%2e%2e`) are rejected with `400` before any
  handler runs.

Disable it explicitly if you manage these concerns yourself (e.g. at an API
gateway):

```java
Ligero app = Ligero.create(LigeroConfig.builder()
    .secureDefaults(false)
    .build());
```

or with `LIGERO_SECURE_DEFAULTS=false` / `ligero.secureDefaults=false`.
When disabled, you can still add the pieces individually
(`SecurityHeadersMiddleware`, `RequestHygieneMiddleware`).

## Dependency scanning (OWASP)

The framework repo runs [OWASP dependency-check](https://owasp.org/www-project-dependency-check/)
(`./gradlew dependencyCheckAggregate`, failing on CVSS ≥ 7) on a weekly CI
schedule, plus GitHub `dependency-review` on every PR. For your own apps the
same Gradle plugin works out of the box.

## Defaults you get for free

Request body limits (413), traversal-safe static files, opaque 500s
(no stack traces to clients), case-insensitive header handling.
