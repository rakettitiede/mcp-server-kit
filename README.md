# @rakettitiede/mcp-server-kit

Opinionated facade for building MCP servers with SSE + Streamable HTTP + REST transports.

Pairs with [`@rakettitiede/mcp-oauth-proxy`](https://github.com/rakettitiede/mcp-oauth-proxy) for Custom GPT OAuth.

## Install

```bash
npm install @rakettitiede/mcp-server-kit express @modelcontextprotocol/sdk zod
```

## Quickstart

```js
import express from "express";
import { createMcpRouters } from "@rakettitiede/mcp-server-kit";

const { sseRouter, streamableHttpRouter, apiRouter, mcpMeta } = createMcpRouters({
  name: "my-mcp-server",
  version: "1.0.0",
  search: async (q) => ({ results: [/* ... */] }),
  fetch: async (id) => ({ id, title: "...", text: { /* ... */ }, url: "...", metadata: { /* ... */ } }),
  refresh: async (body) => ({ ok: true }),  // optional
  openapi: {
    info: { description: "My MCP server" },
    servers: [{ url: "https://example.com" }],
    textSchema: { type: "object", properties: { /* your domain */ } },
    metadataSchema: { type: "object", properties: { /* your domain */ } },
  },
});

const app = express();
app.use(express.json());
app.use(sseRouter);
app.use(streamableHttpRouter);
app.use(apiRouter);

app.listen(8080);
```

## API

### `createMcpRouters(config)`

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | string | yes | Server name reported to MCP clients |
| `version` | string | yes | Server version |
| `search` | `(query) => Promise<{ results }>` | yes | Search implementation |
| `fetch` | `(id) => Promise<Document>` | yes | Fetch-by-id implementation |
| `refresh` | `(body) => Promise<any>` | no | If provided, mounts `POST /api/v1/refresh` |
| `openapi` | object | no | OpenAPI spec overrides (see below) |

Returns `{ sseRouter, streamableHttpRouter, apiRouter, mcpMeta }`:

- `sseRouter` — Express Router exposing `GET /sse` + `POST /messages`
- `streamableHttpRouter` — Express Router exposing `POST /mcp` + `GET /mcp` + `DELETE /mcp`
- `apiRouter` — Express Router exposing `GET /api/v1/search`, `GET /api/v1/fetch`, optional `POST /api/v1/refresh`, `GET /openapi.json`
- `mcpMeta` — metadata object: `{ startupLogs, endpoints, openapiSpec }`

### Document envelope

`fetch` must return a Document:

```js
{
  id: "string",       // required
  title: "string",    // required
  text: { /* ... */ },// required object — your domain payload
  url: "string",      // required
  metadata: { /* ... */ }, // optional object
}
```

`text` and `metadata` are objects whose internal shape is your concern. Pass `openapi.textSchema` and `openapi.metadataSchema` to document them in the published OpenAPI spec.

This envelope matches Custom GPT Actions' retrieval contract — your server is Custom-GPT-compatible by construction.

### OpenAPI overrides

The package owns the spec's `openapi` version, `paths`, and reserved schemas (`Document`, `SearchResult`, `SearchResponse`, `Error`). Consumers can override:

| Field | Behavior |
|---|---|
| `info` | Shallow merge over package defaults |
| `servers` | Replace |
| `schemas` | Merge into `components.schemas`. Reserved names throw at startup. |
| `textSchema` | Inlined as `Document.properties.text` |
| `metadataSchema` | Inlined as `Document.properties.metadata` |

## Serving documentation

The package serves the merged OpenAPI spec at `GET /openapi.json` automatically — `apiRouter` includes that route. You don't need to wire anything to expose the spec.

What you do need to wire is a UI, if you want one. The kit deliberately ships no UI dependency. Pick whichever renderer fits your stack:

### Swagger UI

```bash
npm install swagger-ui-express
```

```js
import swaggerUi from "swagger-ui-express";
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(mcpMeta.openapiSpec));
```

### Redoc

```js
app.get("/docs", (req, res) => {
  res.send(`<!doctype html><html><body>
    <redoc spec-url="/openapi.json"></redoc>
    <script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script>
  </body></html>`);
});
```

### Custom GPT Actions

Point your Custom GPT at `https://yourserver.com/openapi.json`. The Document envelope (`id`, `title`, `text`, `url`, `metadata`) matches Custom GPT's retrieval contract — your server is GPT-Actions-compatible by construction.

## License

MIT — Rakettitiede Oy
