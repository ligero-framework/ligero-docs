---
sidebar_position: 4
---

# GraphQL

:::note Availability
Ships in the release after 0.8.0.
:::

`ligero-graphql` serves a GraphQL API with
[graphql-java](https://www.graphql-java.com), as an ordinary route.

```groovy
implementation 'com.ligeroframework:ligero-graphql:<version>'
```

```graphql
# src/main/resources/graphql/schema.graphqls
type Query { book(id: ID!): Book  books: [Book!]! }
type Mutation { addBook(title: String!): Book! }
type Book { id: ID!  title: String! }
```

```java
GraphQlEndpoint graphql = GraphQlEndpoint.builder()
    .schemaResource("graphql/schema.graphqls")
    .wiring(wiring -> wiring
        .type("Query", type -> type
            .dataFetcher("book", env -> books.find(env.getArgument("id")))
            .dataFetcher("books", env -> books.all()))
        .type("Mutation", type -> type
            .dataFetcher("addBook", env -> books.add(env.getArgument("title")))))
    .build();

app.post("/graphql", graphql).get("/graphql", graphql);
```

Data fetchers reach the HTTP request — headers, the authenticated user,
services — with `GraphQlEndpoint.context(env)`:

```java
.dataFetcher("me", env -> GraphQlEndpoint.context(env).<User>attribute("user"))
```

## Safe by default

| Protection | Default | Setting |
|---|---|---|
| Selection depth | 10 | `maxDepth` |
| Fields per query (complexity) | 1 000 | `maxComplexity` |
| Query length | 20 000 characters | `maxQueryLength` |
| Parser tokens | 15 000 | `maxTokens` |
| Introspection | on | `introspection(false)` |

Without these limits, one crafted query (deeply nested, or the same field
aliased thousands of times) can keep the server busy for minutes.

- **No cross-site mutations.** A `POST` must be `application/json` — an HTML
  form on another site cannot send that without a CORS preflight — and a
  `GET` may only run queries.
- **No leaked internals.** An exception in a data fetcher is logged, and the
  client sees `"Internal error"`. Throw an `HttpException`
  (`new ForbiddenException("Not your order")`) for messages meant for the
  client; its status appears in the error's `extensions`.

## Responses

The endpoint follows GraphQL over HTTP. Clients that accept
`application/graphql-response+json` get `400` for requests that could not
run (syntax or validation errors); others always get `200` with an `errors`
array, as most GraphQL clients expect.
