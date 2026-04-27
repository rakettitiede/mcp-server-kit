import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createApiRouter } from "../src/api-router.mjs";
import { HttpError } from "../src/http-error.mjs";

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

const handlerSpecs = [
  {
    name: "search",
    method: "GET",
    path: "/api/v1/search?q=foo",
    body: undefined,
    fallbackMessage: "Search failed",
    makeApp: (throwingFn) =>
      makeApp({ search: throwingFn, fetch: stubFetch, openapiSpec: stubSpec }),
  },
  {
    name: "fetch",
    method: "GET",
    path: "/api/v1/fetch?id=foo",
    body: undefined,
    fallbackMessage: "Fetch failed",
    makeApp: (throwingFn) =>
      makeApp({ search: stubSearch, fetch: throwingFn, openapiSpec: stubSpec }),
  },
  {
    name: "refresh",
    method: "POST",
    path: "/api/v1/refresh",
    body: { token: "x" },
    fallbackMessage: "Refresh failed",
    makeApp: (throwingFn) =>
      makeApp({ search: stubSearch, fetch: stubFetch, refresh: throwingFn, openapiSpec: stubSpec }),
  },
];

function makeRequest(base, spec) {
  const opts = { method: spec.method };
  if (spec.body) {
    opts.headers = { "content-type": "application/json" };
    opts.body = JSON.stringify(spec.body);
  }
  return fetch(`${base}${spec.path}`, opts);
}

for (const spec of handlerSpecs) {
  describe(`${spec.name} handler — typed status errors`, () => {
    let originalError;
    before(() => {
      originalError = console.error;
      console.error = () => {};
    });
    after(() => {
      console.error = originalError;
    });

    it("honors err.status 400", async (t) => {
      const throwing = async () => { const e = new Error("bad"); e.status = 400; throw e; };
      const { server, base } = await listen(spec.makeApp(throwing));
      t.after(() => server.close());
      const res = await makeRequest(base, spec);
      assert.equal(res.status, 400);
      assert.deepEqual(await res.json(), { error: "bad" });
    });

    it("honors err.status 404", async (t) => {
      const throwing = async () => { const e = new Error("not found"); e.status = 404; throw e; };
      const { server, base } = await listen(spec.makeApp(throwing));
      t.after(() => server.close());
      const res = await makeRequest(base, spec);
      assert.equal(res.status, 404);
      assert.deepEqual(await res.json(), { error: "not found" });
    });

    it("honors err.status 599", async (t) => {
      const throwing = async () => { const e = new Error("edge"); e.status = 599; throw e; };
      const { server, base } = await listen(spec.makeApp(throwing));
      t.after(() => server.close());
      const res = await makeRequest(base, spec);
      assert.equal(res.status, 599);
      assert.deepEqual(await res.json(), { error: "edge" });
    });

    it("falls through to 500 when err has no status", async (t) => {
      const throwing = async () => { throw new Error("plain"); };
      const { server, base } = await listen(spec.makeApp(throwing));
      t.after(() => server.close());
      const res = await makeRequest(base, spec);
      assert.equal(res.status, 500);
      assert.deepEqual(await res.json(), { error: spec.fallbackMessage });
    });

    it("falls through to 500 when err.status is a string", async (t) => {
      const throwing = async () => { const e = new Error("string status"); e.status = "400"; throw e; };
      const { server, base } = await listen(spec.makeApp(throwing));
      t.after(() => server.close());
      const res = await makeRequest(base, spec);
      assert.equal(res.status, 500);
      assert.deepEqual(await res.json(), { error: spec.fallbackMessage });
    });

    it("falls through to 500 when err.status is below 400", async (t) => {
      const throwing = async () => { const e = new Error("low"); e.status = 200; throw e; };
      const { server, base } = await listen(spec.makeApp(throwing));
      t.after(() => server.close());
      const res = await makeRequest(base, spec);
      assert.equal(res.status, 500);
      assert.deepEqual(await res.json(), { error: spec.fallbackMessage });
    });

    it("falls through to 500 when err.status is 600 or higher", async (t) => {
      const throwing = async () => { const e = new Error("high"); e.status = 700; throw e; };
      const { server, base } = await listen(spec.makeApp(throwing));
      t.after(() => server.close());
      const res = await makeRequest(base, spec);
      assert.equal(res.status, 500);
      assert.deepEqual(await res.json(), { error: spec.fallbackMessage });
    });

    it("honors err.body as response envelope", async (t) => {
      const envelope = { error: "Validation failed", fields: { token: "required" } };
      const throwing = async () => { const e = new Error("Validation failed"); e.status = 422; e.body = envelope; throw e; };
      const { server, base } = await listen(spec.makeApp(throwing));
      t.after(() => server.close());
      const res = await makeRequest(base, spec);
      assert.equal(res.status, 422);
      assert.deepEqual(await res.json(), envelope);
    });

    it("works with HttpError class — status only", async (t) => {
      const throwing = async () => { throw new HttpError(400, "Missing token"); };
      const { server, base } = await listen(spec.makeApp(throwing));
      t.after(() => server.close());
      const res = await makeRequest(base, spec);
      assert.equal(res.status, 400);
      assert.deepEqual(await res.json(), { error: "Missing token" });
    });

    it("works with HttpError class — with body envelope", async (t) => {
      const envelope = { error: "Validation failed", fields: { token: "required" } };
      const throwing = async () => { throw new HttpError(422, "Validation failed", envelope); };
      const { server, base } = await listen(spec.makeApp(throwing));
      t.after(() => server.close());
      const res = await makeRequest(base, spec);
      assert.equal(res.status, 422);
      assert.deepEqual(await res.json(), envelope);
    });
  });
}
