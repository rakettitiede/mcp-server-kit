import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { createMcpServerFactory } from "../src/mcp-server-factory.mjs";

const validConfig = {
  name: "test-server",
  version: "1.0.0",
  search: async () => ({ results: [] }),
  fetch: async () => ({}),
};

describe("createMcpServerFactory", () => {
  describe("validation", () => {
    it("throws when name missing", () => {
      assert.throws(
        () => createMcpServerFactory({ ...validConfig, name: "" }),
        /`name` is required/,
      );
    });

    it("throws when version missing", () => {
      assert.throws(
        () => createMcpServerFactory({ ...validConfig, version: "" }),
        /`version` is required/,
      );
    });

    it("throws when search not a function", () => {
      assert.throws(
        () => createMcpServerFactory({ ...validConfig, search: "nope" }),
        /`search` must be a function/,
      );
    });

    it("throws when fetch not a function", () => {
      assert.throws(
        () => createMcpServerFactory({ ...validConfig, fetch: 42 }),
        /`fetch` must be a function/,
      );
    });
  });

  describe("factory return", () => {
    it("returns a function", () => {
      const factory = createMcpServerFactory(validConfig);
      assert.equal(typeof factory, "function");
    });

    it("createServer() returns an object with connect method", () => {
      const factory = createMcpServerFactory(validConfig);
      const srv = factory();
      assert.equal(typeof srv.connect, "function");
    });
  });

  describe("tool descriptions", () => {
    it("uses default descriptions when omitted", () => {
      const factory = createMcpServerFactory(validConfig);
      const srv = factory();
      assert.equal(
        srv._registeredTools.search.description,
        "Search records by query",
      );
      assert.equal(
        srv._registeredTools.fetch.description,
        "Fetch a full record by ID returned from search",
      );
    });

    it("uses custom descriptions when provided", () => {
      const factory = createMcpServerFactory({
        ...validConfig,
        searchDescription: "Custom search",
        fetchDescription: "Custom fetch",
      });
      const srv = factory();
      assert.equal(srv._registeredTools.search.description, "Custom search");
      assert.equal(srv._registeredTools.fetch.description, "Custom fetch");
    });
  });

  describe("tool invocation", () => {
    async function connectPair(srv) {
      const [ct, st] = InMemoryTransport.createLinkedPair();
      await srv.connect(st);
      const client = new Client({ name: "test-client", version: "0.0.1" });
      await client.connect(ct);
      return client;
    }

    it("search tool invokes consumer search function", async () => {
      const searchFn = mock.fn(async (query) => ({
        results: [{ id: "1", title: query }],
      }));
      const factory = createMcpServerFactory({
        ...validConfig,
        search: searchFn,
      });
      const srv = factory();
      const client = await connectPair(srv);

      const result = await client.callTool({
        name: "search",
        arguments: { query: "test-query" },
      });
      assert.equal(searchFn.mock.calls.length, 1);
      assert.equal(searchFn.mock.calls[0].arguments[0], "test-query");

      const parsed = JSON.parse(result.content[0].text);
      assert.deepEqual(parsed.results, [{ id: "1", title: "test-query" }]);

      await client.close();
      await srv.close();
    });

    it("fetch tool invokes consumer fetch function", async () => {
      const fetchFn = mock.fn(async (id) => ({
        id,
        title: "Doc " + id,
      }));
      const factory = createMcpServerFactory({
        ...validConfig,
        fetch: fetchFn,
      });
      const srv = factory();
      const client = await connectPair(srv);

      const result = await client.callTool({
        name: "fetch",
        arguments: { id: "abc-123" },
      });
      assert.equal(fetchFn.mock.calls.length, 1);
      assert.equal(fetchFn.mock.calls[0].arguments[0], "abc-123");

      const parsed = JSON.parse(result.content[0].text);
      assert.deepEqual(parsed, { id: "abc-123", title: "Doc abc-123" });

      await client.close();
      await srv.close();
    });

    it("search returns empty results when consumer throws", async (t) => {
      const errorMock = t.mock.method(console, "error");

      const factory = createMcpServerFactory({
        ...validConfig,
        search: async () => {
          throw new Error("upstream failure");
        },
      });
      const srv = factory();
      const client = await connectPair(srv);

      const result = await client.callTool({
        name: "search",
        arguments: { query: "fail" },
      });
      const parsed = JSON.parse(result.content[0].text);
      assert.deepEqual(parsed, { results: [] });

      assert.strictEqual(errorMock.mock.callCount(), 1);
      assert.strictEqual(errorMock.mock.calls[0].arguments[0], "Search error:");
      assert.match(errorMock.mock.calls[0].arguments[1].message, /upstream failure/);

      await client.close();
      await srv.close();
    });
  });
});
