import { describe, it } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import { createStreamableHttpRouter } from "../src/streamable-http-router.mjs";

const mockCreateServer = () => ({
  connect: async () => {},
  close: async () => {},
});

async function startApp(router) {
  const app = express();
  app.use(express.json());
  app.use(router);
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  return { server, base: `http://127.0.0.1:${port}` };
}

describe("createStreamableHttpRouter", () => {
  describe("validation", () => {
    it("throws when createServer is not a function", () => {
      assert.throws(
        () => createStreamableHttpRouter({ createServer: "nope" }),
        /`createServer` must be a function/,
      );
    });

    it("throws when createServer is missing", () => {
      assert.throws(
        () => createStreamableHttpRouter({}),
        /`createServer` must be a function/,
      );
    });
  });

  describe("factory return", () => {
    it("returns an Express Router", () => {
      const router = createStreamableHttpRouter({
        createServer: mockCreateServer,
      });
      assert.equal(typeof router, "function");
      assert.ok(router.stack, "has stack (is a Router)");
    });

    it("router has POST, GET, DELETE /mcp routes", () => {
      const router = createStreamableHttpRouter({
        createServer: mockCreateServer,
      });
      const routes = router.stack
        .filter((l) => l.route)
        .map((l) => ({
          path: l.route.path,
          methods: Object.keys(l.route.methods),
        }));
      assert.ok(
        routes.some((r) => r.path === "/mcp" && r.methods.includes("post")),
      );
      assert.ok(
        routes.some((r) => r.path === "/mcp" && r.methods.includes("get")),
      );
      assert.ok(
        routes.some((r) => r.path === "/mcp" && r.methods.includes("delete")),
      );
    });
  });

  describe("HTTP behavior", () => {
    it("POST /mcp with initialize request returns 200 and mcp-session-id", async (t) => {
      t.mock.method(console, "log", () => {});
      t.mock.method(console, "error", () => {});

      const router = createStreamableHttpRouter({
        createServer: mockCreateServer,
      });
      const { server, base } = await startApp(router);

      try {
        const url = new URL(`${base}/mcp`);
        const res = await new Promise((resolve, reject) => {
          const req = http.request(
            {
              hostname: url.hostname,
              port: url.port,
              path: "/mcp",
              method: "POST",
              headers: {
                "content-type": "application/json",
                accept: "application/json, text/event-stream",
              },
            },
            resolve,
          );
          req.on("error", reject);
          req.end(
            JSON.stringify({
              jsonrpc: "2.0",
              method: "initialize",
              params: {
                protocolVersion: "2025-03-26",
                capabilities: {},
                clientInfo: { name: "test", version: "0.0.1" },
              },
              id: 1,
            }),
          );
        });
        assert.equal(res.statusCode, 200);
        assert.ok(
          res.headers["mcp-session-id"],
          "mcp-session-id header present",
        );
        res.destroy();
      } finally {
        server.closeAllConnections();
        await new Promise((resolve) => server.close(resolve));
      }
    });

    it("GET /mcp without mcp-session-id returns 400", async (t) => {
      t.mock.method(console, "log", () => {});
      t.mock.method(console, "warn", () => {});
      t.mock.method(console, "error", () => {});

      const router = createStreamableHttpRouter({
        createServer: mockCreateServer,
      });
      const { server, base } = await startApp(router);

      try {
        const res = await fetch(`${base}/mcp`, { method: "GET" });
        assert.equal(res.status, 400);
        const body = await res.json();
        assert.equal(body.error, "mcp-session-id header required");
      } finally {
        server.closeAllConnections();
        await new Promise((resolve) => server.close(resolve));
      }
    });

    it("GET /mcp with unknown session returns 400", async (t) => {
      t.mock.method(console, "log", () => {});
      t.mock.method(console, "warn", () => {});
      t.mock.method(console, "error", () => {});

      const router = createStreamableHttpRouter({
        createServer: mockCreateServer,
      });
      const { server, base } = await startApp(router);

      try {
        const res = await fetch(`${base}/mcp`, {
          method: "GET",
          headers: { "mcp-session-id": "nonexistent" },
        });
        assert.equal(res.status, 400);
        const body = await res.json();
        assert.equal(body.error, "Invalid or expired session");
      } finally {
        server.closeAllConnections();
        await new Promise((resolve) => server.close(resolve));
      }
    });

    it("DELETE /mcp without mcp-session-id returns 400", async (t) => {
      t.mock.method(console, "log", () => {});
      t.mock.method(console, "error", () => {});

      const router = createStreamableHttpRouter({
        createServer: mockCreateServer,
      });
      const { server, base } = await startApp(router);

      try {
        const res = await fetch(`${base}/mcp`, { method: "DELETE" });
        assert.equal(res.status, 400);
      } finally {
        server.closeAllConnections();
        await new Promise((resolve) => server.close(resolve));
      }
    });
  });
});
