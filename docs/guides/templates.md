---
sidebar_position: 9
---

# Templates

Server-side rendering goes through the `TemplateEngine` SPI. **Templates are
fully optional** — a pure JSON microservice simply doesn't add any adapter and
pays zero cost. Three adapters ship today; pick one:

| Adapter | Engine | Syntax | Template files |
|---|---|---|---|
| `ligero-template-mustache` | JMustache | `{{name}}` (logic-less) | `templates/*.mustache` |
| `ligero-template-freemarker` | FreeMarker | `${name}`, macros, includes | `templates/*.ftl` |
| `ligero-template-pebble` | Pebble | `{{ name }}` (Twig/Jinja style, inheritance) | `templates/*.peb` |

All three auto-escape HTML and are discovered via `ServiceLoader` — add the
dependency and `ctx.render(...)` just works:

```groovy
runtimeOnly 'com.ligero:ligero-template-mustache:0.2.0-SNAPSHOT'
// or
runtimeOnly 'com.ligero:ligero-template-freemarker:0.2.0-SNAPSHOT'
// or
runtimeOnly 'com.ligero:ligero-template-pebble:0.2.0-SNAPSHOT'
```

Put templates on the classpath under `templates/`:

```
src/main/resources/templates/profile.mustache
```

```mustache
<h1>Hello {{name}}!</h1>
<p>You have {{count}} messages.</p>
```

```java
app.get("/profile/{name}", ctx ->
    ctx.render("profile", Map.of("name", ctx.pathParam("name"), "count", 3)));
```

HTML escaping is on by default; templates are compiled once and cached.

## Writing another adapter

Implement `com.ligero.spi.TemplateEngine` and register it via
`META-INF/services/com.ligero.spi.TemplateEngine` (or `app.templateEngine(...)`).
That's the whole contract:

```java
public interface TemplateEngine {
    String render(String templateName, Map<String, Object> model);
}
```
