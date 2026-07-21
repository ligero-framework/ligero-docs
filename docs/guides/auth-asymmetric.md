---
sidebar_position: 4
---

# Asymmetric JWT & JWKS

`ligero-auth` verifies and signs JWTs with the asymmetric **RS256** and
**ES256** algorithms in addition to HS256 — so a Ligero service can act as an
**OIDC resource server**, validating tokens issued by an external identity
provider (Auth0, Keycloak, Cognito, Google, …) against its public keys.

:::info Install with the CLI
```bash
ligero add auth
```
:::

```groovy
implementation "com.ligeroframework:ligero-auth:$ligeroVersion"
```

## Verify tokens from an identity provider (JWKS)

An OIDC provider publishes its public keys at a `jwks_uri`. Fetch that document
yourself and hand it to `Jwks.parse` — it returns JDK public keys by `kid`:

```java
// 1. fetch the JWKS (cache it; refresh periodically)
String jwksJson = httpClient.send(
    HttpRequest.newBuilder(URI.create(issuer + "/.well-known/jwks.json")).build(),
    HttpResponse.BodyHandlers.ofString()).body();

Jwks jwks = Jwks.parse(jwksJson, bodyMapper);

// 2. verify a bearer token with the key named in its header (kid)
PublicKey key = jwks.key(kidFromTokenHeader).orElseThrow();
Map<String, Object> claims = Jwt.rs256Verifier(key, bodyMapper).verify(bearerToken);
```

`Jwks.parse` supports **RSA** (`kty=RSA`) and **EC P-256** (`kty=EC`,
`crv=P-256`) keys — the key types behind RS256 and ES256.

## Sign and verify yourself

```java
KeyPair keys = /* your RSA or EC key pair */;

Jwt jwt = Jwt.rs256(keys.getPrivate(), keys.getPublic(), bodyMapper);
String token = jwt.sign(Map.of("sub", "ada"), Duration.ofHours(1));
Map<String, Object> claims = jwt.verify(token);
```

## API

| Factory | Use |
|---|---|
| `Jwt.hs256(secret, mapper)` | symmetric (issue + verify yourself) |
| `Jwt.rs256(priv, pub, mapper)` / `Jwt.es256(...)` | asymmetric sign + verify |
| `Jwt.rs256Verifier(pub, mapper)` / `es256Verifier(...)` | verify-only (resource server) |
| `Jwks.parse(json, mapper)` → `key(kid)` | public keys from a JWKS document |

## Security notes

- The verifier **pins the algorithm** it was created with, rejecting tokens with
  a different `alg` — this defends against algorithm-confusion and the `none`
  algorithm attack.
- `exp` and `nbf` are always enforced.
- **Cache the JWKS** and refresh it periodically (e.g. hourly, or on an unknown
  `kid`); don't fetch it per request.
