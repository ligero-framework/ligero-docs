---
sidebar_position: 16
---

# Configuration & Profiles (YAML)

Ligero's configuration is small and predictable by design — no fifteen
property sources, no relaxed-binding guesswork. The framework reads its own
settings from a fixed set of keys; your app reads its own keys through a tiny
typed facade. YAML and profiles are an **opt-in** module on top.

## Without any config

Out of the box `LigeroConfig` resolves the framework's settings with this
precedence (highest wins):

```
builder call  >  env var (LIGERO_*)  >  classpath ligero.properties  >  default
```

```java
Ligero app = Ligero.create(LigeroConfig.builder().port(9090).build());
// or LIGERO_PORT=9090, or ligero.port=9090 in ligero.properties
```

That's enough for a pure microservice. Add YAML when you want structured
config and profiles.

## Adding YAML + profiles

```groovy
// build.gradle
implementation 'com.ligero:ligero-config-yaml:0.2.0-SNAPSHOT'
```

Create `src/main/resources/ligero.yml`:

```yaml
server:
  port: 8080
  gzip: true

db:
  url: ${DB_URL:-jdbc:postgresql://localhost:5432/app}   # env with a default
  pool: 10
```

That's it. `server.*` keys configure the framework; everything else is yours.
The precedence simply grows by one tier:

```
builder  >  env (LIGERO_*)  >  YAML (profile > base)  >  ligero.properties  >  default
```

### Profiles

A profile is an overlay file `ligero-<profile>.yml` that wins **key by key**
over the base. Pick the active profile with the `LIGERO_PROFILE` env var or
the `-Dligero.profile` system property.

```yaml
# ligero-dev.yml — only what changes in dev
server:
  port: 8081
db:
  url: jdbc:h2:mem:app
```

```bash
LIGERO_PROFILE=dev gradle run    # port 8081, H2; db.pool still 10 from the base
```

### Environment interpolation

Any string value may reference the environment: `${VAR}` or, with a fallback,
`${VAR:-default}`. Resolution checks environment variables first, then system
properties, then the fallback.

```yaml
db:
  password: ${DB_PASSWORD:-changeme}
apiKey: ${API_KEY}          # empty if unset
```

## Reading your own config

Framework settings are already applied. For **your** keys, use `Config`:

```java
Config config = Config.load();

String url = config.get("db.url").orElse("jdbc:h2:mem:app");
int    pool = config.getInt("db.pool", 10);
boolean tls = config.getBoolean("tls.enabled", false);

config.profile().ifPresent(p -> log.info("Running profile: {}", p));
```

Nested YAML is flattened to dotted keys (`db.url`, `db.pool`); YAML lists
become comma-joined strings (`cors.origins` → `"https://a.com,https://b.com"`).

There is **no** `@ConfigurationProperties` and **no** `@Value` — you read a
key where you need it, or map a subtree into your own record by hand. That's
the whole surface. It's deliberately not Spring.

## Why a module and not built-in?

The core stays dependency-free. YAML support is a
[`ConfigSource`](#the-configsource-spi) implementation (backed by SnakeYAML)
that plugs in through `ServiceLoader` — omit the module and nothing about
your app changes.

### The `ConfigSource` SPI

`ConfigSource` is format-agnostic: `Optional<String> get(String key)` plus an
optional `profile()`. `ligero-config-yaml` is one implementation; you could
write one for TOML, a remote config service, Vault, etc. `Config` merges every
source on the classpath, highest `priority()` first, and `LigeroConfig` reads
its canonical `server.*` / `security.*` keys from them.
