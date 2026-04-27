import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { HttpError } from "../src/http-error.mjs";

describe("HttpError", () => {
  it("sets status, message, and name", () => {
    const err = new HttpError(400, "Missing token");
    assert.equal(err.status, 400);
    assert.equal(err.message, "Missing token");
    assert.equal(err.name, "HttpError");
    assert.equal(err.body, undefined);
  });

  it("accepts an optional body envelope", () => {
    const body = { error: "Validation failed", fields: { token: "required" } };
    const err = new HttpError(422, "Validation failed", body);
    assert.equal(err.status, 422);
    assert.deepStrictEqual(err.body, body);
  });

  it("inherits from Error", () => {
    const err = new HttpError(500, "boom");
    assert.ok(err instanceof Error);
  });
});
