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

  describe("always present", () => {
    it("spec.openapi === '3.0.3'", () => {
      const spec = buildOpenapiSpec(minimal);
      assert.equal(spec.openapi, "3.0.3");
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
