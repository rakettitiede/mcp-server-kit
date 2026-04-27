import { createApiRouter } from "./api-router.mjs";
import { createMcpServerFactory } from "./mcp-server-factory.mjs";
import { buildOpenapiSpec } from "./openapi-spec.mjs";
import { createSseRouter } from "./sse-router.mjs";
import { createStreamableHttpRouter } from "./streamable-http-router.mjs";

export function createMcpRouters(config) {
  const {
    name,
    version,
    search,
    fetch: fetchFn,
    refresh,
    openapi = {},
  } = config;

  if (!name) throw new Error("createMcpRouters: `name` is required");
  if (!version) throw new Error("createMcpRouters: `version` is required");
  if (typeof search !== "function")
    throw new Error("createMcpRouters: `search` must be a function");
  if (typeof fetchFn !== "function")
    throw new Error("createMcpRouters: `fetch` must be a function");
  if (refresh !== undefined && typeof refresh !== "function") {
    throw new Error(
      "createMcpRouters: `refresh` must be a function when provided",
    );
  }

  const createServer = createMcpServerFactory({
    name,
    version,
    search,
    fetch: fetchFn,
    searchDescription: openapi?.searchDescription,
    fetchDescription: openapi?.fetchDescription,
  });

  const sseRouter = createSseRouter({ createServer });

  const streamableHttpRouter = createStreamableHttpRouter({ createServer });

  const openapiSpec = buildOpenapiSpec({
    name,
    version,
    hasRefresh: typeof refresh === "function",
    openapi,
  });

  const mcpMeta = {
    startupLogs: {
      sse: "📡 SSE: GET /sse  |  POST /messages?sessionId=...",
      streamableHttp: "🔗 Streamable HTTP: POST /mcp",
      search: "🔍 Search: GET /api/v1/search?q=...",
      fetch: "🎯 Fetch: GET /api/v1/fetch?id=",
      openapi: "📋 OpenAPI: GET /openapi.json",
      ...(refresh && { refresh: "💖 Refresh: POST /api/v1/refresh" }),
    },
    endpoints: {
      sse: { sse: "/sse", messages: "/messages" },
      streamableHttp: { mcp: "/mcp" },
      search: { search: "/api/v1/search" },
      fetch: { fetch: "/api/v1/fetch" },
      openapi: { "openapi-json": "/openapi.json" },
      ...(refresh && { refresh: { refresh: "/api/v1/refresh" } }),
    },
    openapiSpec,
  };

  const apiRouter = createApiRouter({
    search,
    fetch: fetchFn,
    refresh,
    openapiSpec,
  });

  return { sseRouter, streamableHttpRouter, apiRouter, mcpMeta };
}
