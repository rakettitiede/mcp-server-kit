import { describe, it } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import { createSseRouter } from "../src/sse-router.mjs";

const mockCreateServer = () => ({
  connect: async (transport) => {
    await transport.start();
  },
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

describe("createSseRouter", () => {
  describe("validation", () => {
    it("throws when createServer is not a function", () => {
      assert.throws(
        () => createSseRouter({ createServer: "nope" }),
        /`createServer` must be a function/,
      );
    });

    it("throws when createServer is missing", () => {
      assert.throws(
        () => createSseRouter({}),
        /`createServer` must be a function/,
      );
    });
  });

  describe("factory return", () => {
    it("returns an Express Router", () => {
      const router = createSseRouter({ createServer: mockCreateServer });
      assert.equal(typeof router, "function");
      assert.ok(router.stack, "has stack (is a Router)");
    });

    it("router has GET /sse and POST /messages", () => {
      const router = createSseRouter({ createServer: mockCreateServer });
      const routes = router.stack
        .filter((l) => l.route)
        .map((l) => ({
          path: l.route.path,
          methods: Object.keys(l.route.methods),
        }));
      assert.ok(
        routes.some((r) => r.path === "/sse" && r.methods.includes("get")),
      );
      assert.ok(
        routes.some(
          (r) => r.path === "/messages" && r.methods.includes("post"),
        ),
      );
    });
  });

  describe("HTTP behavior", () => {
    it("GET /sse returns 200 with text/event-stream", async (t) => {
      t.mock.method(console, "log", () => {});
      t.mock.method(console, "error", () => {});

      const router = createSseRouter({ createServer: mockCreateServer });
      const { server, base } = await startApp(router);

      try {
        const res = await new Promise((resolve, reject) => {
          http.get(`${base}/sse`, resolve).on("error", reject);
        });
        assert.equal(res.statusCode, 200);
        assert.match(res.headers["content-type"], /text\/event-stream/);
        res.destroy();
      } finally {
        server.closeAllConnections();
        await new Promise((resolve) => server.close(resolve));
      }
    });

    it("POST /messages without sessionId returns 400", async (t) => {
      t.mock.method(console, "log", () => {});
      t.mock.method(console, "warn", () => {});

      const router = createSseRouter({ createServer: mockCreateServer });
      const { server, base } = await startApp(router);

      try {
        const res = await fetch(`${base}/messages`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({}),
        });
        assert.equal(res.status, 400);
      } finally {
        server.closeAllConnections();
        await new Promise((resolve) => server.close(resolve));
      }
    });

    it("POST /messages with unknown sessionId returns 400", async (t) => {
      t.mock.method(console, "log", () => {});
      t.mock.method(console, "warn", () => {});

      const router = createSseRouter({ createServer: mockCreateServer });
      const { server, base } = await startApp(router);

      try {
        const res = await fetch(`${base}/messages?sessionId=nonexistent`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({}),
        });
        assert.equal(res.status, 400);
      } finally {
        server.closeAllConnections();
        await new Promise((resolve) => server.close(resolve));
      }
    });
  });
});
