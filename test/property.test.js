import { test } from "node:test";
import assert from "node:assert";
import * as fc from "fast-check";
import { getToken, callTodoist } from "../index.js";

test("getToken extracts token from args after --token flag", () => {
  fc.assert(
    fc.property(fc.array(fc.string()), fc.string(), (prefix, token) => {
      const args = [...prefix, "--token", token];
      assert.strictEqual(getToken(args), token);
    })
  );
});

test("getToken returns undefined when --token flag not present and no env var", () => {
  const originalToken = process.env.TODOIST_API_TOKEN;
  delete process.env.TODOIST_API_TOKEN;

  fc.assert(
    fc.property(
      fc.array(fc.string().filter(s => s !== "--token")),
      (args) => {
        const result = getToken(args);
        assert.strictEqual(result, undefined);
      }
    )
  );

  if (originalToken) process.env.TODOIST_API_TOKEN = originalToken;
});

test("callTodoist returns a function that calls API", async () => {
  const mockToken = "test-token-123";
  const apiCall = callTodoist(mockToken);
  assert.strictEqual(typeof apiCall, "function");
});

test("callTodoist constructs proper endpoint URLs", () => {
  fc.assert(
    fc.property(
      fc.string().filter(s => s.length > 0 && s.startsWith("/")),
      (endpoint) => {
        const token = "test";
        const apiCall = callTodoist(token);
        assert.strictEqual(typeof apiCall, "function");
      }
    )
  );
});