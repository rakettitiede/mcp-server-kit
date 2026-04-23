import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createMcpRouters } from "../src/create-mcp-routers.mjs";

const validConfig = {
  name: "test-server",
  version: "1.0.0",
  search: () => {},
  fetch: () => {},
};

describe("createMcpRouters", () => {
  describe("config validation", () => {
    it("throws when name is missing", () => {
      assert.throws(
        () => createMcpRouters({ ...validConfig, name: undefined }),
        { message: "createMcpRouters: `name` is required" },
      );
    });

    it("throws when version is missing", () => {
      assert.throws(
        () => createMcpRouters({ ...validConfig, version: undefined }),
        { message: "createMcpRouters: `version` is required" },
      );
    });

    it("throws when search is not a function", () => {
      assert.throws(
        () => createMcpRouters({ ...validConfig, search: "nope" }),
        { message: "createMcpRouters: `search` must be a function" },
      );
    });

    it("throws when fetch is not a function", () => {
      assert.throws(
        () => createMcpRouters({ ...validConfig, fetch: "nope" }),
        { message: "createMcpRouters: `fetch` must be a function" },
      );
    });

    it("throws when refresh is provided but not a function", () => {
      assert.throws(
        () => createMcpRouters({ ...validConfig, refresh: "nope" }),
        {
          message:
            "createMcpRouters: `refresh` must be a function when provided",
        },
      );
    });
  });

  describe("return shape", () => {
    it("returns sseRouter, streamableHttpRouter, apiRouter, mcpMeta", () => {
      const result = createMcpRouters(validConfig);
      assert.ok(result.sseRouter, "sseRouter present");
      assert.ok(result.streamableHttpRouter, "streamableHttpRouter present");
      assert.ok(result.apiRouter, "apiRouter present");
      assert.ok(result.mcpMeta, "mcpMeta present");
    });
  });

  describe("mcpMeta.startupLogs", () => {
    it("refresh is undefined when refresh not provided", () => {
      const { mcpMeta } = createMcpRouters(validConfig);
      assert.equal(mcpMeta.startupLogs.refresh, undefined);
    });

    it("refresh is defined when refresh provided", () => {
      const { mcpMeta } = createMcpRouters({
        ...validConfig,
        refresh: () => {},
      });
      assert.equal(typeof mcpMeta.startupLogs.refresh, "string");
    });
  });

  describe("mcpMeta.endpoints", () => {
    it("refresh is undefined when refresh not provided", () => {
      const { mcpMeta } = createMcpRouters(validConfig);
      assert.equal(mcpMeta.endpoints.refresh, undefined);
    });

    it("refresh is defined when refresh provided", () => {
      const { mcpMeta } = createMcpRouters({
        ...validConfig,
        refresh: () => {},
      });
      assert.deepEqual(mcpMeta.endpoints.refresh, {
        refresh: "/api/v1/refresh",
      });
    });
  });

  describe("mcpMeta.openapiSpec", () => {
    it("info.title matches name", () => {
      const { mcpMeta } = createMcpRouters(validConfig);
      assert.equal(mcpMeta.openapiSpec.info.title, "test-server");
    });

    it("info.version matches version", () => {
      const { mcpMeta } = createMcpRouters(validConfig);
      assert.equal(mcpMeta.openapiSpec.info.version, "1.0.0");
    });
  });

  describe("router routes", () => {
    function getRoutePaths(router) {
      return router.stack
        .filter((layer) => layer.route)
        .map((layer) => ({
          path: layer.route.path,
          methods: Object.keys(layer.route.methods),
        }));
    }

    it("sseRouter has GET /sse and POST /messages", () => {
      const { sseRouter } = createMcpRouters(validConfig);
      const routes = getRoutePaths(sseRouter);
      assert.ok(
        routes.some((r) => r.path === "/sse" && r.methods.includes("get")),
      );
      assert.ok(
        routes.some(
          (r) => r.path === "/messages" && r.methods.includes("post"),
        ),
      );
    });

    it("streamableHttpRouter has POST /mcp and GET /mcp", () => {
      const { streamableHttpRouter } = createMcpRouters(validConfig);
      const routes = getRoutePaths(streamableHttpRouter);
      assert.ok(
        routes.some((r) => r.path === "/mcp" && r.methods.includes("post")),
      );
      assert.ok(
        routes.some((r) => r.path === "/mcp" && r.methods.includes("get")),
      );
    });

    it("apiRouter has search, fetch, and openapi routes", () => {
      const { apiRouter } = createMcpRouters(validConfig);
      const routes = getRoutePaths(apiRouter);
      assert.ok(
        routes.some(
          (r) => r.path === "/api/v1/search" && r.methods.includes("get"),
        ),
      );
      assert.ok(
        routes.some(
          (r) => r.path === "/api/v1/fetch" && r.methods.includes("get"),
        ),
      );
      assert.ok(
        routes.some(
          (r) => r.path === "/openapi.json" && r.methods.includes("get"),
        ),
      );
    });

    it("apiRouter has refresh route when refresh provided", () => {
      const { apiRouter } = createMcpRouters({
        ...validConfig,
        refresh: () => {},
      });
      const routes = getRoutePaths(apiRouter);
      assert.ok(
        routes.some(
          (r) => r.path === "/api/v1/refresh" && r.methods.includes("post"),
        ),
      );
    });

    it("apiRouter does not have refresh route when refresh not provided", () => {
      const { apiRouter } = createMcpRouters(validConfig);
      const routes = getRoutePaths(apiRouter);
      assert.ok(
        !routes.some((r) => r.path === "/api/v1/refresh"),
      );
    });
  });
});
