---
name: mcp-server-kit
version: 1.0.0
description: How to build a new MCP (Model Context Protocol) server using the Rakettitiede kit — `@rakettitiede/mcp-server-kit` for transports/REST/OpenAPI and `@rakettitiede/mcp-oauth-proxy` for Google OAuth + API-key auth. Use whenever standing up a new MCP server, onboarding a partner node to the talent network federation, or extending/refactoring an existing kit-based server (mcp-agileday, ai-talent-network-mcp, future partner nodes). Covers wire-up, domain functions, OpenAPI overrides, polymorphic Document.text via oneOf, auth model, HttpError typed responses, the Custom GPT 300-char description limit, and testing.
---

# Building MCP servers with the Rakettitiede kit

The Rakettitiede ecosystem has two npm packages that handle the boring-but-error-prone parts of an MCP server. Consumers bring domain logic; the kit handles transports, REST, OpenAPI, OAuth, and auth.

## The two packages

**`@rakettitiede/mcp-server-kit`** owns:
- SSE transport (`GET /sse` + `POST /messages`)
- Streamable HTTP transport (`POST /mcp` + `GET /mcp`)
- REST API (`GET /api/v1/search`, `GET /api/v1/fetch`, `POST /api/v1/refresh`)
- OpenAPI 3.1.0 spec generation at `/openapi.json`
- `HttpError` typed-status error class
- Document envelope enforcement (`{ id, title, text, url, metadata }`)

**`@rakettitiede/mcp-oauth-proxy`** owns:
- Google OAuth proxy (`/oauth/authorize`, `/oauth/callback`, `/oauth/token`) for ChatGPT Custom GPT
- `createRequireAuth` middleware: API key (header or query) + Google IAM tokens (Pyry/service-to-service) + OAuth bearer tokens

The consumer brings: domain logic (search/fetch/refresh), OpenAPI schema overrides, environment plumbing, database/storage, and any service-specific middleware.

## When the kit fits

Use it for any server that:

- Speaks MCP to AI assistants (Claude, Gemini CLI, Cursor) AND/OR exposes REST to non-MCP consumers (Custom GPT, Pyry, Minna)
- Wants OpenAPI spec generation without `swagger-jsdoc` boilerplate
- Wants Custom GPT compatibility out of the box (Document envelope enforced, OpenAPI 3.1.0, operationIds in place)
- Is or might become a federation node — the kit gives shared shape across nodes, partners can `npm update` to inherit improvements

Don't use it when the server only needs MCP (no REST, no Custom GPT) AND won't ever be in a federation. The kit isn't wrong there, just heavier than necessary.

## Minimum file structure

```
src/
  index.mjs           # compose → mount → listen (~35-50 lines)
  do-search.mjs       # domain: text query → { results: [...] }
  do-fetch.mjs        # domain: id → Document envelope
  do-refresh.mjs      # domain: { token } → { message } | throw HttpError(400)
  openapi.mjs         # spec overrides: schemas, operations prose
  database.mjs        # SQLite + sqlite-vec (or partner's own data layer)
  storage.mjs         # GCS load/save (or partner's own)
  constants.mjs       # env vars, server name, version
```

## Canonical `src/index.mjs`

```js
import express from "express";
import swaggerUi from "swagger-ui-express";
import { createRequireAuth, createOAuthRouter } from "@rakettitiede/mcp-oauth-proxy";
import { createMcpRouters } from "@rakettitiede/mcp-server-kit";

import { doSearch } from "./do-search.mjs";
import { doFetch } from "./do-fetch.mjs";
import { doRefresh } from "./do-refresh.mjs";
import { openapi } from "./openapi.mjs";
import { loadDatabaseFromGCS } from "./storage.mjs";
import { checkHealtDatabase } from "./database.mjs";
import {
  PORT, SERVER_NAME, SERVER_VERSION, API_KEY, NODE_ENV,
  GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_TOKENINFO_URL,
} from "./constants.mjs";

await loadDatabaseFromGCS();
checkHealtDatabase();

const requireAuth = createRequireAuth({
  apiKey: API_KEY,
  googleClientId: GOOGLE_CLIENT_ID,
  googleTokeninfoUrl: GOOGLE_TOKENINFO_URL,
  nodeEnv: NODE_ENV,
});

const { oauthRouter, oauthMeta } = createOAuthRouter({
  googleClientId: GOOGLE_CLIENT_ID,
  googleClientSecret: GOOGLE_CLIENT_SECRET,
});

const { sseRouter, streamableHttpRouter, apiRouter, mcpMeta } = createMcpRouters({
  name: SERVER_NAME,
  version: SERVER_VERSION,
  search: doSearch,
  fetch: doFetch,
  refresh: doRefresh,
  openapi,
});

const app = express();
app.use(express.json());

app.use("/oauth", oauthRouter);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(mcpMeta.openapiSpec));

app.use("/sse", requireAuth);
app.use("/mcp", requireAuth);
app.use("/api/v1", requireAuth);

app.use(sseRouter);
app.use(streamableHttpRouter);
app.use(apiRouter);

app.get("/", (req, res) =>
  res.json({ ok: true, service: SERVER_NAME, version: SERVER_VERSION }),
);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Listening on :${PORT}`);
  Object.values(mcpMeta.startupLogs).forEach((line) => console.log(line));
  console.log(oauthMeta.startupLog);
});
```

## Domain functions

Three contracts the kit calls into:

**`doSearch(query: string) → { results: SearchResult[] }`** — each `SearchResult` must have at minimum `{ id, title, url }`.

**`doFetch(id: string) → Document`** — shape: `{ id, title, text, url, metadata }`. Default convention for "not found": return a Document with `title: "Not found"` and empty `text`/`url`, NOT a thrown error.

**`doRefresh(body: object) → { message?: string } | undefined`** — optional. Throw `HttpError(400, "...")` for validation.

## OpenAPI overrides — `src/openapi.mjs`

```js
import { SERVER_URL } from "./constants.mjs";

export const openapi = {
  info: { description: "..." },
  servers: [{ url: SERVER_URL }],
  schemas: { Tag, ArticleText },
  textSchema: { $ref: "#/components/schemas/ArticleText" },
  metadataSchema: { type: "object", properties: {} },
  refreshRequestSchema: {
    type: "object",
    properties: { token: { type: "string" } },
    required: ["token"],
  },
  operations: {
    search:  { summary: "...", description: "..." },
    fetch:   { summary: "...", description: "..." },
    refresh: { summary: "...", description: "..." },
  },
};
```

Reserved schema names (throw if used): `Document`, `SearchResult`, `SearchResponse`, `Error`.

## Custom GPT description limit

Custom GPT rejects per-operation `description` fields over 300 chars. The kit warns at **280 chars**. Aim for 150-280 chars per description.

## HttpError for typed responses

```js
import { HttpError } from "@rakettitiede/mcp-server-kit";

export async function doRefresh(body) {
  if (!body?.token) throw new HttpError(400, "Missing token");
  await updateDatabase(body.token);
  return { message: "Database refreshed" };
}
```

## Auth model

| Path | Auth |
|------|------|
| `/openapi.json` | public |
| `/api-docs` | public |
| `/oauth/*` | public |
| `/messages` | public |
| `/sse` | required |
| `/mcp` | required |
| `/api/v1/*` | required |

## Quick reference

| Concern | Owned by | Customize via |
|---------|----------|---------------|
| SSE / Streamable HTTP | kit | mount the routers |
| REST `/api/v1/*` | kit | search/fetch/refresh callbacks |
| OpenAPI spec | kit | `openapi` config object |
| OAuth flow (Custom GPT) | oauth-proxy | `createOAuthRouter(...)` |
| API key + IAM auth | oauth-proxy | `createRequireAuth(...)` |
| Domain logic | consumer | `do-search.mjs`, `do-fetch.mjs`, `do-refresh.mjs` |
| 4xx responses | consumer | `throw new HttpError(400, "...")` |

## Reference implementations

- **ai-talent-network-mcp** — simple single-shape textSchema, anonymized payload. Best starting point for partner nodes.
- **mcp-agileday** — polymorphic `textSchema` (`oneOf`) for two record types, full-PII payload.
