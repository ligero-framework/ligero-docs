---
sidebar_position: 6
---

# Security

Everything here comes from `ligero-auth` plus two core middlewares. Add:

```groovy
implementation 'com.ligeroframework:ligero-auth:0.5.0'
```

## JWT (HS256)

Signing and verification are implemented with `javax.crypto` — no external
dependencies. `alg=none` and algorithm-confusion tokens are rejected (the
header's `alg` must match exactly); signature comparison is constant-time;
`exp`/`nbf` are enforced and must be numeric — a token with a malformed expiry
is refused rather than treated as never expiring.

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
app.use(SessionMiddleware.of(secret).secureCookie(true));   // Secure: HTTPS only

app.post("/cart", ctx -> {
    Session session = ctx.attribute(SessionMiddleware.ATTRIBUTE);
    session.set("items", items);
});
```

Three things to get right:

- **Rotate the id on login.** Call `SessionMiddleware.regenerate(ctx)` after a
  successful authentication (it keeps the attributes). This defeats *session
  fixation*, where an attacker plants a session id in the victim's browser
  before they log in.
- **Destroy it on logout** with `SessionMiddleware.invalidate(ctx)`.
- **Mark the cookie `Secure`** in every deployment served over TLS, as above.

```java
app.post("/login", ctx -> {
    User user = authenticate(ctx);
    Session session = SessionMiddleware.regenerate(ctx);   // fresh id, same attributes
    session.set("userId", user.id());
});

app.post("/logout", ctx -> SessionMiddleware.invalidate(ctx));
```

The default in-memory store expires sessions after 30 minutes of inactivity
and holds at most 100 000 of them (least recently used are evicted). Tune it
with `new InMemorySessionStore(Duration.ofHours(2), 50_000)`, or use the
[Redis store](scaling.md) to share sessions across instances.

## CORS

```java
app.use(CorsMiddleware.builder()
    .allowOrigins("https://app.example.com")
    .allowCredentials(true)                 // cookies / Authorization from that origin
    .build());
```

`CorsMiddleware.permissive()` allows any origin **without credentials** — fine
for public, unauthenticated APIs. Credentials always require an explicit
origin list: `allowCredentials(true)` with the default `*` origin fails at
startup, because echoing any origin back with credentials would let every
website read your users' authenticated responses.

## WebSockets

Browsers send cookies on WebSocket handshakes from *any* site and do not apply
CORS to them. Ligero therefore rejects handshakes whose `Origin` is not the
app's own (`403`), which prevents cross-site WebSocket hijacking. Allow extra
origins explicitly — see [Real-time](realtime.md#origin-checks).

## File uploads

Never build a path from the client-supplied filename. Use `safeFilename()`,
which strips directories and control characters:

```java
Multipart.UploadedFile file = ctx.multipart().file("avatar");
Files.write(uploadDir.resolve(file.safeFilename()), file.content());
```

Requests are limited by `maxBodyBytes` (10 MiB by default) and to 1 000
multipart parts.

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
- **Request hygiene**: paths carrying null bytes (`%00`), control characters,
  backslashes or dot segments (`/../`, `/./`, plain or percent-encoded) are
  rejected with `400` before any handler runs.

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

Request body limits (413), traversal-safe static files (including symlinks
that point outside the served directory), opaque 500s (no stack traces to
clients), case-insensitive header handling, validated cookie names and values
(no header or attribute injection), a bounded in-memory rate limiter, and
`400` — never `500` — for malformed percent-encoding.

`RequestIdMiddleware` only reuses an incoming `X-Request-Id` when it is a
short, plain identifier, and the JSON access log escapes everything the
client controls, so requests cannot forge log records.

## Production checklist

- Serve over TLS; enable HSTS and a Content-Security-Policy (above).
- `SessionMiddleware...secureCookie(true)`, `regenerate` on login,
  `invalidate` on logout.
- CORS: an explicit origin list, never `*`, for anything authenticated.
- Behind a reverse proxy every request appears to come from the proxy. Key
  the rate limiter on the address your proxy forwards — and only trust that
  header when the proxy sets it:
  `RateLimitMiddleware.of(100, 100, ctx -> ctx.header("X-Real-IP"))`.
- Keep [devtools](devtools.md#production) out of the production build.
- Keep secrets (JWT keys, session secrets, database passwords) in the
  environment (`${DB_PASSWORD}` in `ligero.yml`), never in source control.
- Give [MCP endpoints](mcp.md#securing-the-endpoint) authentication and an
  origin allow-list before exposing them beyond localhost.
