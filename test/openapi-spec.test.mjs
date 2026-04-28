import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildOpenapiSpec } from "../src/openapi-spec.mjs";

const minimal = { name: "test", version: "1.0.0", hasRefresh: false };

describe("buildOpenapiSpec", () => {
  describe("validation throws", () => {
    it("rejects openapi.openapi override", () => {
      assert.throws(
        () => buildOpenapiSpec({ ...minimal, openapi: { openapi: "3.1.0" } }),
        { message: /package-owned/ },
      );
    });

    it("rejects openapi.paths override", () => {
      assert.throws(
        () => buildOpenapiSpec({ ...minimal, openapi: { paths: { "/x": {} } } }),
        { message: /package-owned/ },
      );
    });

    for (const name of ["Document", "SearchResult", "SearchResponse", "Error"]) {
      it(`rejects reserved schema name "${name}"`, () => {
        assert.throws(
          () => buildOpenapiSpec({ ...minimal, openapi: { schemas: { [name]: {} } } }),
          { message: new RegExp(`"${name}" is reserved`) },
        );
      });
    }
  });

  describe("defaults", () => {
    it("Document.properties.text uses default text schema", () => {
      const spec = buildOpenapiSpec(minimal);
      assert.deepStrictEqual(
        spec.components.schemas.Document.properties.text,
        { type: "object", additionalProperties: true },
      );
    });

    it("Document.properties.metadata uses default metadata schema", () => {
      const spec = buildOpenapiSpec(minimal);
      assert.deepStrictEqual(
        spec.components.schemas.Document.properties.metadata,
        { type: "object", additionalProperties: true },
      );
    });
  });

  describe("consumer overrides", () => {
    it("openapi.info.description shows up in spec", () => {
      const spec = buildOpenapiSpec({
        ...minimal,
        openapi: { info: { description: "My API" } },
      });
      assert.equal(spec.info.description, "My API");
    });

    it("openapi.info.title overrides default (consumer wins)", () => {
      const spec = buildOpenapiSpec({
        ...minimal,
        openapi: { info: { title: "override" } },
      });
      assert.equal(spec.info.title, "override");
    });

    it("openapi.servers appears at spec.servers", () => {
      const servers = [{ url: "https://example.com" }];
      const spec = buildOpenapiSpec({
        ...minimal,
        openapi: { servers },
      });
      assert.deepStrictEqual(spec.servers, servers);
    });

    it("openapi.textSchema is inlined as Document.properties.text", () => {
      const textSchema = { type: "object", properties: { x: { type: "string" } } };
      const spec = buildOpenapiSpec({
        ...minimal,
        openapi: { textSchema },
      });
      assert.deepStrictEqual(spec.components.schemas.Document.properties.text, textSchema);
    });

    it("openapi.metadataSchema is inlined as Document.properties.metadata", () => {
      const metadataSchema = { type: "object", properties: { y: { type: "number" } } };
      const spec = buildOpenapiSpec({
        ...minimal,
        openapi: { metadataSchema },
      });
      assert.deepStrictEqual(spec.components.schemas.Document.properties.metadata, metadataSchema);
    });

    it("openapi.schemas merges consumer schemas while preserving reserved ones", () => {
      const spec = buildOpenapiSpec({
        ...minimal,
        openapi: { schemas: { Foo: { type: "object" } } },
      });
      assert.ok(spec.components.schemas.Foo, "consumer schema Foo present");
      assert.ok(spec.components.schemas.Document, "Document still present");
      assert.ok(spec.components.schemas.SearchResult, "SearchResult still present");
      assert.ok(spec.components.schemas.SearchResponse, "SearchResponse still present");
      assert.ok(spec.components.schemas.Error, "Error still present");
    });
  });

  describe("refresh conditional", () => {
    it("hasRefresh: false — no /api/v1/refresh path", () => {
      const spec = buildOpenapiSpec({ ...minimal, hasRefresh: false });
      assert.equal(spec.paths["/api/v1/refresh"], undefined);
    });

    it("hasRefresh: true — /api/v1/refresh path with POST", () => {
      const spec = buildOpenapiSpec({ ...minimal, hasRefresh: true });
      assert.ok(spec.paths["/api/v1/refresh"], "refresh path present");
      assert.ok(spec.paths["/api/v1/refresh"].post, "POST method present");
    });
  });

  describe("refresh schemas and 400 response", () => {
    const withRefresh = { ...minimal, hasRefresh: true };

    it("default refresh requestBody schema is { type: 'object' }", () => {
      const spec = buildOpenapiSpec(withRefresh);
      const schema = spec.paths["/api/v1/refresh"].post.requestBody.content["application/json"].schema;
      assert.deepStrictEqual(schema, { type: "object" });
    });

    it("default refresh 200 response schema is { type: 'object' }", () => {
      const spec = buildOpenapiSpec(withRefresh);
      const schema = spec.paths["/api/v1/refresh"].post.responses[200].content["application/json"].schema;
      assert.deepStrictEqual(schema, { type: "object" });
    });

    it("consumer refreshRequestSchema flows through to the spec", () => {
      const refreshRequestSchema = {
        type: "object",
        properties: { token: { type: "string" } },
        required: ["token"],
      };
      const spec = buildOpenapiSpec({ ...withRefresh, openapi: { refreshRequestSchema } });
      const schema = spec.paths["/api/v1/refresh"].post.requestBody.content["application/json"].schema;
      assert.deepStrictEqual(schema, refreshRequestSchema);
    });

    it("consumer refreshResponseSchema flows through to the spec", () => {
      const refreshResponseSchema = {
        type: "object",
        properties: { message: { type: "string" } },
        required: ["message"],
      };
      const spec = buildOpenapiSpec({ ...withRefresh, openapi: { refreshResponseSchema } });
      const schema = spec.paths["/api/v1/refresh"].post.responses[200].content["application/json"].schema;
      assert.deepStrictEqual(schema, refreshResponseSchema);
    });

    it("requestBody.required is true when refreshRequestSchema has non-empty required array", () => {
      const refreshRequestSchema = {
        type: "object",
        properties: { token: { type: "string" } },
        required: ["token"],
      };
      const spec = buildOpenapiSpec({ ...withRefresh, openapi: { refreshRequestSchema } });
      assert.equal(spec.paths["/api/v1/refresh"].post.requestBody.required, true);
    });

    it("requestBody.required is false when refreshRequestSchema has no required array", () => {
      const refreshRequestSchema = {
        type: "object",
        properties: { token: { type: "string" } },
      };
      const spec = buildOpenapiSpec({ ...withRefresh, openapi: { refreshRequestSchema } });
      assert.equal(spec.paths["/api/v1/refresh"].post.requestBody.required, false);
    });

    it("requestBody.required is false when refreshRequestSchema has empty required array", () => {
      const refreshRequestSchema = {
        type: "object",
        properties: { token: { type: "string" } },
        required: [],
      };
      const spec = buildOpenapiSpec({ ...withRefresh, openapi: { refreshRequestSchema } });
      assert.equal(spec.paths["/api/v1/refresh"].post.requestBody.required, false);
    });

    it("requestBody.required is false when no refreshRequestSchema is provided", () => {
      const spec = buildOpenapiSpec(withRefresh);
      assert.equal(spec.paths["/api/v1/refresh"].post.requestBody.required, false);
    });

    it("refresh path documents a 400 response referencing BadRequest", () => {
      const spec = buildOpenapiSpec(withRefresh);
      assert.deepStrictEqual(
        spec.paths["/api/v1/refresh"].post.responses[400],
        { $ref: "#/components/responses/BadRequest" },
      );
    });
  });

  describe("per-operation overrides", () => {
    const opSpecs = [
      { name: "search", path: "/api/v1/search", method: "get", defaultSummary: "Search for records" },
      { name: "fetch", path: "/api/v1/fetch", method: "get", defaultSummary: "Fetch a full record by ID" },
      { name: "refresh", path: "/api/v1/refresh", method: "post", defaultSummary: "Refresh the underlying data source" },
    ];

    for (const op of opSpecs) {
      const base = op.name === "refresh" ? { ...minimal, hasRefresh: true } : minimal;

      it(`${op.name}: default summary preserved`, () => {
        const spec = buildOpenapiSpec(base);
        assert.equal(spec.paths[op.path][op.method].summary, op.defaultSummary);
      });

      it(`${op.name}: default description not emitted`, () => {
        const spec = buildOpenapiSpec(base);
        assert.equal(spec.paths[op.path][op.method].description, undefined);
        assert.equal("description" in spec.paths[op.path][op.method], false);
      });

      it(`${op.name}: consumer summary flows through`, () => {
        const spec = buildOpenapiSpec({
          ...base,
          openapi: { operations: { [op.name]: { summary: "Custom summary" } } },
        });
        assert.equal(spec.paths[op.path][op.method].summary, "Custom summary");
      });

      it(`${op.name}: consumer description flows through`, () => {
        const spec = buildOpenapiSpec({
          ...base,
          openapi: { operations: { [op.name]: { description: "Custom description" } } },
        });
        assert.equal(spec.paths[op.path][op.method].description, "Custom description");
      });

      it(`${op.name}: both summary and description together`, () => {
        const spec = buildOpenapiSpec({
          ...base,
          openapi: { operations: { [op.name]: { summary: "S", description: "D" } } },
        });
        assert.equal(spec.paths[op.path][op.method].summary, "S");
        assert.equal(spec.paths[op.path][op.method].description, "D");
      });
    }

    it("all three operations with both summary and description", () => {
      const spec = buildOpenapiSpec({
        ...minimal,
        hasRefresh: true,
        openapi: {
          operations: {
            search: { summary: "S-search", description: "D-search" },
            fetch: { summary: "S-fetch", description: "D-fetch" },
            refresh: { summary: "S-refresh", description: "D-refresh" },
          },
        },
      });
      assert.equal(spec.paths["/api/v1/search"].get.summary, "S-search");
      assert.equal(spec.paths["/api/v1/search"].get.description, "D-search");
      assert.equal(spec.paths["/api/v1/fetch"].get.summary, "S-fetch");
      assert.equal(spec.paths["/api/v1/fetch"].get.description, "D-fetch");
      assert.equal(spec.paths["/api/v1/refresh"].post.summary, "S-refresh");
      assert.equal(spec.paths["/api/v1/refresh"].post.description, "D-refresh");
    });
  });

  describe("description length warnings", () => {
    it("no warning when descriptions are at exactly 280 chars", (t) => {
      t.mock.method(console, "warn", () => {});
      const desc = "x".repeat(280);
      buildOpenapiSpec({
        ...minimal,
        hasRefresh: true,
        openapi: {
          operations: {
            search: { description: desc },
            fetch: { description: desc },
            refresh: { description: desc },
          },
        },
      });
      assert.equal(console.warn.mock.calls.length, 0);
    });

    it("warns when a description exceeds 280 chars", (t) => {
      t.mock.method(console, "warn", () => {});
      const desc = "x".repeat(281);
      buildOpenapiSpec({
        ...minimal,
        openapi: { operations: { search: { description: desc } } },
      });
      assert.equal(console.warn.mock.calls.length, 1);
      const msg = console.warn.mock.calls[0].arguments[0];
      assert.ok(msg.includes("search"), "mentions search");
      assert.ok(msg.includes("281"), "mentions length");
    });

    it("warns independently for each over-limit description", (t) => {
      t.mock.method(console, "warn", () => {});
      buildOpenapiSpec({
        ...minimal,
        hasRefresh: true,
        openapi: {
          operations: {
            search: { description: "x".repeat(281) },
            refresh: { description: "x".repeat(350) },
          },
        },
      });
      assert.equal(console.warn.mock.calls.length, 2);
      const msgs = console.warn.mock.calls.map((c) => c.arguments[0]);
      assert.ok(msgs.some((m) => m.includes("search") && m.includes("281")));
      assert.ok(msgs.some((m) => m.includes("refresh") && m.includes("350")));
    });

    it("no warning when description is undefined", (t) => {
      t.mock.method(console, "warn", () => {});
      buildOpenapiSpec(minimal);
      assert.equal(console.warn.mock.calls.length, 0);
    });

    it("no warning when description is empty string", (t) => {
      t.mock.method(console, "warn", () => {});
      buildOpenapiSpec({
        ...minimal,
        openapi: { operations: { search: { description: "" } } },
      });
      assert.equal(console.warn.mock.calls.length, 0);
    });
  });

  describe("always present", () => {
    it("spec.openapi === '3.1.0'", () => {
      const spec = buildOpenapiSpec(minimal);
      assert.equal(spec.openapi, "3.1.0");
    });

    it("spec.paths has /api/v1/search and /api/v1/fetch", () => {
      const spec = buildOpenapiSpec(minimal);
      assert.ok(spec.paths["/api/v1/search"], "search path present");
      assert.ok(spec.paths["/api/v1/fetch"], "fetch path present");
    });

    it("components.schemas has Document, SearchResult, SearchResponse, Error", () => {
      const spec = buildOpenapiSpec(minimal);
      for (const name of ["Document", "SearchResult", "SearchResponse", "Error"]) {
        assert.ok(spec.components.schemas[name], `${name} schema present`);
      }
    });

    it("components.responses has BadRequest and ServerError", () => {
      const spec = buildOpenapiSpec(minimal);
      assert.ok(spec.components.responses.BadRequest, "BadRequest response present");
      assert.ok(spec.components.responses.ServerError, "ServerError response present");
    });
  });
});
