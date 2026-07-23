import { test } from "node:test";
import assert from "node:assert";
import { callTodoist } from "../index.js";

const token = process.env.TODOIST_API_TOKEN;
const skipIfNoToken = token ? test : test.skip;

const isPaginatedList = (data) =>
  data &&
  typeof data === "object" &&
  Array.isArray(data.results) &&
  ("next_cursor" in data);

skipIfNoToken("GET /projects returns projects list envelope", async () => {
  const apiCall = callTodoist(token);
  const result = await apiCall("/projects", "GET");

  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.status, 200);
  assert.ok(isPaginatedList(result.data), "data should be {results, next_cursor}");
  assert.ok(result.data.results.length >= 0);
  if (result.data.results.length > 0) {
    assert.strictEqual(typeof result.data.results[0].id, "string");
  }
});

skipIfNoToken("GET /tasks returns tasks list envelope", async () => {
  const apiCall = callTodoist(token);
  const result = await apiCall("/tasks", "GET");

  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.status, 200);
  assert.ok(isPaginatedList(result.data), "data should be {results, next_cursor}");
});

skipIfNoToken("GET /tasks/filter?query=today returns filtered tasks", async () => {
  const apiCall = callTodoist(token);
  const result = await apiCall("/tasks/filter?query=today", "GET");

  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.status, 200);
  assert.ok(isPaginatedList(result.data), "data should be {results, next_cursor}");
});

skipIfNoToken("POST /tasks creates a task and DELETE removes it", async () => {
  const apiCall = callTodoist(token);

  const createResult = await apiCall("/tasks", "POST", {
    content: "Test task from MCP integration test",
    due_string: "tomorrow"
  });

  assert.strictEqual(createResult.ok, true);
  assert.ok([200, 201].includes(createResult.status), `unexpected create status ${createResult.status}`);
  assert.ok(createResult.data.id);
  assert.strictEqual(typeof createResult.data.id, "string");
  assert.strictEqual(createResult.data.content, "Test task from MCP integration test");

  const taskId = createResult.data.id;
  const deleteResult = await apiCall(`/tasks/${taskId}`, "DELETE");

  assert.strictEqual(deleteResult.ok, true);
  // v1 documents 200 with null body; accept 204 as well for compatibility
  assert.ok([200, 204].includes(deleteResult.status), `unexpected delete status ${deleteResult.status}`);
});

skipIfNoToken("Invalid token returns 401 error", async () => {
  const apiCall = callTodoist("invalid-token-12345");
  const result = await apiCall("/projects", "GET");

  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.status, 401);
});

skipIfNoToken("Invalid endpoint returns 404 error", async () => {
  const apiCall = callTodoist(token);
  const result = await apiCall("/nonexistent-endpoint", "GET");

  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.status, 404);
});
