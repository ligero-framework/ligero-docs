---
sidebar_position: 1
---

# Building MCP servers

`ligero-mcp` turns a Ligero app into a **Model Context Protocol** server: you
expose your application's capabilities as **tools** that an LLM (Claude, etc.)
can discover and call. It speaks JSON-RPC 2.0 over the **Streamable HTTP**
transport and mounts as a normal middleware — so an MCP server is just a route
in your app.

## Dependency

```groovy
implementation "com.ligeroframework:ligero-mcp:$ligeroVersion"
```

## Quick start

```java
var app = new Ligero();

McpServer mcp = McpServer.create("weather", "1.0.0")
    .tool("get_forecast", "Get the forecast for a city",
          McpServer.objectSchema(
              Map.of("city", McpServer.stringParam("City name")), "city"),
          args -> weather.forecast((String) args.get("city")));

app.use(mcp.http("/mcp"));   // POST /mcp now speaks MCP
app.start();
```

Point an MCP client (Claude Desktop, the MCP Inspector, …) at
`http://localhost:8080/mcp` and `get_forecast` shows up as a callable tool.

## Registering tools

```java
McpServer.create("calc", "1.0.0")
    .tool("add", "Add two numbers",
          McpServer.objectSchema(Map.of(
              "a", McpServer.numberParam("first"),
              "b", McpServer.numberParam("second")), "a", "b"),
          args -> String.valueOf(
              ((Number) args.get("a")).doubleValue() + ((Number) args.get("b")).doubleValue()));
```

| Method | What it does |
|---|---|
| `create(name, version)` | Start a server with its `serverInfo`. |
| `tool(name, description, schema, handler)` | Register a callable tool. `schema` is JSON Schema for the arguments; `handler` maps parsed arguments → a text result. |
| `objectSchema(props, required...)` | Build an `object` JSON Schema. |
| `stringParam(desc)` / `numberParam(desc)` | Property schemas for the common cases. |
| `http(path)` | A middleware serving the server at `path`. |

A tool handler that **throws** is reported to the client as an MCP error result
(`isError: true`) — the connection stays healthy.

## What's implemented

- The `initialize` handshake (protocol version, `serverInfo`, `tools` capability).
- `ping`.
- `tools/list` — every tool with its JSON Schema.
- `tools/call` — runs the handler and returns text content.
- Notifications (`notifications/*`) are accepted with `202 Accepted`.

One JSON-RPC message per POST is supported (the common client behaviour).
Batching, SSE server-streaming, and `resources` / `prompts` are on the roadmap.

## Why Ligero for MCP

An MCP server is an HTTP + JSON service, which is exactly what Ligero is — so
you get the reflection-free `Beans` container, middleware (auth, rate limiting)
and devtools **for free** around your tools. Put an MCP server and your regular
REST API in the same app, sharing the same services.
