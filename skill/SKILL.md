---
name: mcp-server-kit
version: 1.0.0
description: How to build a new MCP server using @rakettitiede/mcp-server-kit. Covers transports, domain function contracts, OpenAPI overrides, Document envelope, HttpError typed responses, and testing. Does not cover authentication — for auth middleware see @rakettitiede/mcp-oauth-proxy.
---

# @rakettitiede/mcp-server-kit

Opinionated facade for building MCP servers with SSE + Streamable HTTP + REST transports.

## What this package owns

- `GET /sse` + `POST /messages` — SSE transport
- `POST /mcp` + `GET /mcp` — Streamable HTTP transport (preferred)
- `GET /api/v1/search`, `GET /api/v1/fetch`, `POST /api/v1/refresh` — REST API
- `GET /openapi.json` — OpenAPI 3.1.0 spec generation
- `HttpError` — typed error class for domain responses
- Document envelope enforcement (`{ id, title, text, url, metadata }`)

Authentication (API key, IAM tokens, OAuth) is handled separately by `@rakettitiede/mcp-oauth-proxy`. See its [skill](https://github.com/rakettitiede/mcp-oauth-proxy/blob/main/skill/SKILL.md) for auth setup.

## When to use

Any server that needs to speak MCP to AI assistants AND/OR expose REST to non-MCP consumers. The kit handles transports and OpenAPI — you bring domain logic.

## Installation

```bash
npm install @rakettitiede/mcp-server-kit
```

## Minimum usage

```js
import { createMcpRouters } from "@rakettitiede/mcp-server-kit";
import express from "express";

import { doSearch } from "./do-search.mjs";
import { doFetch } from "./do-fetch.mjs";
import { openapi } from "./openapi.mjs";
import { SERVER_NAME, SERVER_VERSION } from "./constants.mjs";

const { sseRouter, streamableHttpRouter, apiRouter, mcpMeta } = createMcpRouters({
  name: SERVER_NAME,
  version: SERVER_VERSION,
  search: doSearch,
  fetch: doFetch,
  openapi,
});

const app = express();
app.use(express.json());
app.use(sseRouter);
app.use(streamableHttpRouter);
app.use(apiRouter);

app.get("/", (req, res) =>
  res.json({ ok: true, service: SERVER_NAME, version: SERVER_VERSION }),
);

app.listen(PORT, "0.0.0.0");
```

To add authentication, mount auth middleware before the routers. See `@rakettitiede/mcp-oauth-proxy`.

## Domain function contracts

Three callbacks `createMcpRouters` calls into:

**`doSearch(query: string) → { results: SearchResult[] }`**

Each `SearchResult` must have at minimum `{ id, title, url }`. Return an empty `results: []` for no matches — don't throw.

**`doFetch(id: string) → Document`**

Shape: `{ id, title, text, url, metadata }`. For "not found": return a Document with `title: "Not found"` and empty `text`/`url` — do NOT throw.

**`doRefresh(body: object) → { message?: string } | undefined`** (optional)

Throw `HttpError(400, "...")` for validation errors. Return `{ message }` on success.

## OpenAPI overrides — `src/openapi.mjs`

```js
import { SERVER_URL } from "./constants.mjs";

export const openapi = {
  info: { description: "..." },
  servers: [{ url: SERVER_URL }],
  schemas: {},               // custom reusable schemas
  textSchema: {},            // shape of Document.text (default: string)
  metadataSchema: {},        // shape of Document.metadata
  refreshRequestSchema: {},  // shape of POST /refresh body
  operations: {
    search:  { summary: "...", description: "..." },  // max 280 chars
    fetch:   { summary: "...", description: "..." },
    refresh: { summary: "...", description: "..." },
  },
};
```

Reserved schema names (will throw if used): `Document`, `SearchResult`, `SearchResponse`, `Error`.

## Custom GPT description limit

Custom GPT rejects operation `description` fields over 300 chars. The kit warns at 280 chars. Keep descriptions between 150-280 chars.

## Polymorphic Document.text via oneOf

When a server returns two different document types (e.g. profiles vs projects), use `textSchema` with `oneOf`:

```js
export const openapi = {
  schemas: {
    ProfileText: { type: "object", properties: { ... } },
    ProjectText:  { type: "object", properties: { ... } },
  },
  textSchema: {
    oneOf: [
      { $ref: "#/components/schemas/ProfileText" },
      { $ref: "#/components/schemas/ProjectText" },
    ],
  },
};
```

## HttpError for typed error responses

```js
import { HttpError } from "@rakettitiede/mcp-server-kit";

export async function doRefresh(body) {
  if (!body?.token) throw new HttpError(400, "Missing token");
  await updateDatabase(body.token);
  return { message: "Database refreshed" };
}
```

## Transport endpoints summary

| Endpoint | Transport | Consumer |
|---|---|---|
| `GET /sse` + `POST /messages` | SSE (legacy) | MCP clients |
| `POST /mcp` + `GET /mcp` | Streamable HTTP (preferred) | MCP clients |
| `GET /api/v1/search` | REST | Custom GPT, Slack bots, direct |
| `GET /api/v1/fetch` | REST | Custom GPT, Slack bots, direct |
| `POST /api/v1/refresh` | REST | Admin, CI/CD |
| `GET /openapi.json` | — | Custom GPT import |

## Testing

The kit doesn't prescribe a test framework. In the Rakettitiede ecosystem, servers use e2e-only integration tests that boot the real server and hit HTTP endpoints. See the `ai-talent-scaffold` skill for the test layout convention.

## Reference implementations

- **ai-talent-network-mcp** — simple single-shape textSchema, anonymous payload. Best starting point.
- **mcp-agileday** — polymorphic `textSchema` (oneOf), full-PII payload, GCS database.
