import { test } from "node:test";
import assert from "node:assert";
import { callTodoist } from "../index.js";

const token = process.env.TODOIST_API_TOKEN;
const skipIfNoToken = token ? test : test.skip;

skipIfNoToken("GET /projects returns projects list", async () => {
  const apiCall = callTodoist(token);
  const result = await apiCall("/projects", "GET");

  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.status, 200);
  assert.ok(Array.isArray(result.data));
});

skipIfNoToken("GET /tasks returns tasks list", async () => {
  const apiCall = callTodoist(token);
  const result = await apiCall("/tasks", "GET");

  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.status, 200);
  assert.ok(Array.isArray(result.data));
});

skipIfNoToken("POST /tasks creates a task and DELETE removes it", async () => {
  const apiCall = callTodoist(token);

  const createResult = await apiCall("/tasks", "POST", {
    content: "Test task from MCP integration test",
    due_string: "tomorrow"
  });

  assert.strictEqual(createResult.ok, true);
  assert.strictEqual(createResult.status, 200);
  assert.ok(createResult.data.id);
  assert.strictEqual(createResult.data.content, "Test task from MCP integration test");

  const taskId = createResult.data.id;
  const deleteResult = await apiCall(`/tasks/${taskId}`, "DELETE");

  assert.strictEqual(deleteResult.ok, true);
  assert.strictEqual(deleteResult.status, 204);
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

skipIfNoToken("POST /tasks creates a task for today (no teardown)", async () => {
  const apiCall = callTodoist(token);

  const createResult = await apiCall("/tasks", "POST", {
    content: "MCP Lite integration test - created today",
    due_string: "today"
  });

  assert.strictEqual(createResult.ok, true);
  assert.strictEqual(createResult.status, 200);
  assert.ok(createResult.data.id);
  assert.strictEqual(createResult.data.content, "MCP Lite integration test - created today");

  console.log(`Created task with ID: ${createResult.data.id}`);
});