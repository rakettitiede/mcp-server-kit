# @rakettitiede/mcp-server-kit

> Opinionated facade for building MCP servers with SSE + Streamable HTTP + REST transports

## What it is

A single `createMcpRouters(config)` call that wires up an MCP server with three Express routers — SSE, Streamable HTTP, and a plain REST API — plus an auto-generated OpenAPI spec. Designed for Rakettitiede MCP servers but usable by anyone.

## Install

```bash
npm install @rakettitiede/mcp-server-kit
```

## Quick start

```js
// TODO: usage example
```

## API reference

### `createMcpRouters(config)`

| Key | Type | Description |
|-----|------|-------------|
| `name` | `string` | Server name |
| `version` | `string` | Server version |
| `tools` | `ToolDef[]` | MCP tool definitions |
| `documents` | `object` | Document listing / retrieval config |
| `openapi` | `object` | OpenAPI customization overrides |

## Returned routers

- **`sseRouter`** — Express router handling the legacy SSE transport
- **`streamableHttpRouter`** — Express router for the Streamable HTTP transport
- **`apiRouter`** — Express router exposing tools as plain REST endpoints

## `mcpMeta`

- `startupLogs` — structured log lines emitted during wiring
- `endpoints` — map of mounted paths
- `openapiSpec` — the generated OpenAPI JSON

## OpenAPI customization

Override via `config.openapi`:

- `info` — OpenAPI info object overrides
- `servers` — server entries
- `schemas` — additional component schemas
- `textSchema` — Zod schema for the `text` field in documents
- `metadataSchema` — Zod schema for the `metadata` field in documents

## Document envelope convention

All document resources follow a standard envelope:

| Field | Owner | Description |
|-------|-------|-------------|
| `id` | kit | Unique document identifier |
| `title` | kit | Human-readable title |
| `text` | consumer | Main text content (schema defined by consumer) |
| `url` | kit | Canonical URL |
| `metadata` | consumer | Arbitrary metadata (schema defined by consumer) |

## Companion packages

- [`@rakettitiede/mcp-oauth-proxy`](https://github.com/rakettitiede/mcp-oauth-proxy) — OAuth middleware for MCP servers

## Licence

MIT
