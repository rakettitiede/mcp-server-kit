import { describe, it } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createApiRouter } from "../src/api-router.mjs";

function makeApp(opts) {
  const app = express();
  app.use(express.json());
  app.use(createApiRouter(opts));
  return app;
}

function listen(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const { port } = server.address();
      resolve({ server, base: `http://127.0.0.1:${port}` });
    });
  });
}

const stubSearch = async (q) => ({ results: [{ id: "1", title: q }] });
const stubFetch = async (id) => ({ id, title: "Doc " + id });
const stubRefresh = async (body) => ({ refreshed: true, ...body });
const stubSpec = { openapi: "3.0.3", info: { title: "test", version: "0.1.0" }, paths: {} };

describe("createApiRouter", () => {
  describe("config validation", () => {
    it("throws when search is not a function", () => {
      assert.throws(
        () => createApiRouter({ search: "nope", fetch: stubFetch, openapiSpec: stubSpec }),
        { message: "createApiRouter: `search` must be a function" },
      );
    });

    it("throws when fetch is not a function", () => {
      assert.throws(
        () => createApiRouter({ search: stubSearch, fetch: "nope", openapiSpec: stubSpec }),
        { message: "createApiRouter: `fetch` must be a function" },
      );
    });

    it("throws when refresh is provided but not a function", () => {
      assert.throws(
        () => createApiRouter({ search: stubSearch, fetch: stubFetch, refresh: "nope", openapiSpec: stubSpec }),
        { message: "createApiRouter: `refresh` must be a function when provided" },
      );
    });

    it("does NOT throw when refresh is omitted", () => {
      assert.doesNotThrow(
        () => createApiRouter({ search: stubSearch, fetch: stubFetch, openapiSpec: stubSpec }),
      );
    });

    it("returns an Express Router", () => {
      const router = createApiRouter({ search: stubSearch, fetch: stubFetch, openapiSpec: stubSpec });
      assert.equal(typeof router, "function");
      assert.ok(router.stack, "has stack (Express Router)");
    });
  });

  describe("GET /api/v1/search", () => {
    it("returns 400 when ?q= is missing", async (t) => {
      const app = makeApp({ search: stubSearch, fetch: stubFetch, openapiSpec: stubSpec });
      const { server, base } = await listen(app);
      t.after(() => server.close());

      const res = await fetch(`${base}/api/v1/search`);
      assert.equal(res.status, 400);
      const body = await res.json();
      assert.deepEqual(body, { error: "Missing query parameter ?q=" });
    });

    it("calls search(q) and returns { results, count }", async (t) => {
      const app = makeApp({ search: stubSearch, fetch: stubFetch, openapiSpec: stubSpec });
      const { server, base } = await listen(app);
      t.after(() => server.close());

      const res = await fetch(`${base}/api/v1/search?q=foo`);
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.deepEqual(body, { results: [{ id: "1", title: "foo" }], count: 1 });
    });

    it("returns 500 when search throws", async (t) => {
      t.mock.method(console, "error", () => {});
      const failSearch = async () => { throw new Error("boom"); };
      const app = makeApp({ search: failSearch, fetch: stubFetch, openapiSpec: stubSpec });
      const { server, base } = await listen(app);
      t.after(() => server.close());

      const res = await fetch(`${base}/api/v1/search?q=test`);
      assert.equal(res.status, 500);
      const body = await res.json();
      assert.deepEqual(body, { error: "Search failed" });
      assert.ok(console.error.mock.calls.length > 0, "console.error was called");
    });
  });

  describe("GET /api/v1/fetch", () => {
    it("returns 400 when ?id= is missing", async (t) => {
      const app = makeApp({ search: stubSearch, fetch: stubFetch, openapiSpec: stubSpec });
      const { server, base } = await listen(app);
      t.after(() => server.close());

      const res = await fetch(`${base}/api/v1/fetch`);
      assert.equal(res.status, 400);
      const body = await res.json();
      assert.deepEqual(body, { error: "Missing query parameter ?id=" });
    });

    it("calls fetch(id) and returns the doc", async (t) => {
      const app = makeApp({ search: stubSearch, fetch: stubFetch, openapiSpec: stubSpec });
      const { server, base } = await listen(app);
      t.after(() => server.close());

      const res = await fetch(`${base}/api/v1/fetch?id=abc`);
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.deepEqual(body, { id: "abc", title: "Doc abc" });
    });

    it("returns 500 when fetch throws", async (t) => {
      t.mock.method(console, "error", () => {});
      const failFetch = async () => { throw new Error("boom"); };
      const app = makeApp({ search: stubSearch, fetch: failFetch, openapiSpec: stubSpec });
      const { server, base } = await listen(app);
      t.after(() => server.close());

      const res = await fetch(`${base}/api/v1/fetch?id=xyz`);
      assert.equal(res.status, 500);
      const body = await res.json();
      assert.deepEqual(body, { error: "Fetch failed" });
      assert.ok(console.error.mock.calls.length > 0, "console.error was called");
    });
  });

  describe("POST /api/v1/refresh", () => {
    it("calls refresh(req.body) and returns result", async (t) => {
      const app = makeApp({ search: stubSearch, fetch: stubFetch, refresh: stubRefresh, openapiSpec: stubSpec });
      const { server, base } = await listen(app);
      t.after(() => server.close());

      const res = await fetch(`${base}/api/v1/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: "abc" }),
      });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.deepEqual(body, { refreshed: true, token: "abc" });
    });

    it("returns { ok: true } when refresh returns undefined", async (t) => {
      const noReturnRefresh = async () => {};
      const app = makeApp({ search: stubSearch, fetch: stubFetch, refresh: noReturnRefresh, openapiSpec: stubSpec });
      const { server, base } = await listen(app);
      t.after(() => server.close());

      const res = await fetch(`${base}/api/v1/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.deepEqual(body, { ok: true });
    });

    it("returns 500 when refresh throws", async (t) => {
      t.mock.method(console, "error", () => {});
      const failRefresh = async () => { throw new Error("boom"); };
      const app = makeApp({ search: stubSearch, fetch: stubFetch, refresh: failRefresh, openapiSpec: stubSpec });
      const { server, base } = await listen(app);
      t.after(() => server.close());

      const res = await fetch(`${base}/api/v1/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      assert.equal(res.status, 500);
      const body = await res.json();
      assert.deepEqual(body, { error: "Refresh failed" });
      assert.ok(console.error.mock.calls.length > 0, "console.error was called");
    });

    it("returns 404 when refresh is not configured", async (t) => {
      const app = makeApp({ search: stubSearch, fetch: stubFetch, openapiSpec: stubSpec });
      const { server, base } = await listen(app);
      t.after(() => server.close());

      const res = await fetch(`${base}/api/v1/refresh`, { method: "POST" });
      assert.equal(res.status, 404);
    });
  });

  describe("GET /openapi.json", () => {
    it("returns the openapiSpec passed in config", async (t) => {
      const app = makeApp({ search: stubSearch, fetch: stubFetch, openapiSpec: stubSpec });
      const { server, base } = await listen(app);
      t.after(() => server.close());

      const res = await fetch(`${base}/openapi.json`);
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.deepEqual(body, stubSpec);
    });
  });
});
