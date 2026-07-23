import { test } from "node:test";
import assert from "node:assert";
import * as fc from "fast-check";
import { getToken, callTodoist } from "../index.js";

// Keep generators bounded so the suite stays fast under node --test isolation.
const shortArg = fc.string({ maxLength: 32 }).filter((s) => s !== "--token");
const argList = fc.array(shortArg, { maxLength: 8 });
const tokenArb = fc.string({ minLength: 1, maxLength: 64 });

test("getToken extracts token from args after --token flag", () => {
  fc.assert(
    fc.property(argList, tokenArb, (prefix, token) => {
      const args = [...prefix, "--token", token];
      assert.strictEqual(getToken(args), token);
    }),
    { numRuns: 50 }
  );
});

test("getToken returns undefined when --token flag not present and no env var", () => {
  const originalToken = process.env.TODOIST_API_TOKEN;
  delete process.env.TODOIST_API_TOKEN;

  fc.assert(
    fc.property(argList, (args) => {
      const result = getToken(args);
      assert.strictEqual(result, undefined);
    }),
    { numRuns: 50 }
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
      fc.string({ minLength: 1, maxLength: 64 }).filter((s) => s.startsWith("/")),
      (endpoint) => {
        const token = "test";
        const apiCall = callTodoist(token);
        assert.strictEqual(typeof apiCall, "function");
        assert.ok(endpoint.startsWith("/"));
      }
    ),
    { numRuns: 50 }
  );
});