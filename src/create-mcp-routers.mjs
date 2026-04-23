import express from "express";
import { createMcpServerFactory } from "./mcp-server-factory.mjs";
import { createSseRouter } from "./sse-router.mjs";

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

  const notImplemented = (_req, res) =>
    res
      .status(501)
      .json({ error: "not implemented — kit scaffold v0.1.0" });

  const sseRouter = createSseRouter({ createServer });

  const streamableHttpRouter = express.Router();
  streamableHttpRouter.post("/mcp", notImplemented);
  streamableHttpRouter.get("/mcp", notImplemented);

  const apiRouter = express.Router();
  apiRouter.get("/api/v1/search", notImplemented);
  apiRouter.get("/api/v1/fetch", notImplemented);
  if (refresh) apiRouter.post("/api/v1/refresh", notImplemented);
  apiRouter.get("/openapi.json", notImplemented);

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
    openapiSpec: {
      openapi: "3.0.3",
      info: { title: name, version, ...(openapi.info || {}) },
      ...(openapi.servers && { servers: openapi.servers }),
      paths: {},
      components: { schemas: {} },
    },
  };

  return { sseRouter, streamableHttpRouter, apiRouter, mcpMeta };
}
