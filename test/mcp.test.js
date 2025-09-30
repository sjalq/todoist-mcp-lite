import { test } from "node:test";
import assert from "node:assert";
import { spawn } from "node:child_process";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const serverPath = join(__dirname, "..", "index.js");

const token = process.env.TODOIST_API_TOKEN;
const skipIfNoToken = token ? test : test.skip;

const createMcpClient = async () => {
  const serverProcess = spawn("node", [serverPath, "--token", token], {
    stdio: ["pipe", "pipe", "pipe"]
  });

  const transport = new StdioClientTransport({
    command: "node",
    args: [serverPath, "--token", token]
  });

  const client = new Client(
    { name: "test-client", version: "1.0.0" },
    { capabilities: {} }
  );

  await client.connect(transport);
  return { client, transport, serverProcess };
};

skipIfNoToken("MCP server lists todoist_api tool", async () => {
  const { client, transport, serverProcess } = await createMcpClient();

  try {
    const tools = await client.listTools();

    assert.ok(tools.tools, "Should return tools list");
    assert.strictEqual(tools.tools.length, 1, "Should have exactly one tool");
    assert.strictEqual(tools.tools[0].name, "todoist_api", "Tool should be named todoist_api");
    assert.ok(tools.tools[0].description.includes("Todoist"), "Description should mention Todoist");
    assert.ok(tools.tools[0].inputSchema, "Tool should have input schema");
    assert.ok(tools.tools[0].inputSchema.properties.endpoint, "Schema should have endpoint property");
    assert.ok(tools.tools[0].inputSchema.properties.method, "Schema should have method property");
  } finally {
    await client.close();
    await transport.close();
    serverProcess.kill();
  }
});

skipIfNoToken("MCP server calls todoist_api tool to GET /projects", async () => {
  const { client, transport, serverProcess } = await createMcpClient();

  try {
    const result = await client.callTool({
      name: "todoist_api",
      arguments: {
        endpoint: "/projects",
        method: "GET"
      }
    });

    assert.ok(result.content, "Should return content");
    assert.strictEqual(result.content.length, 1, "Should have one content item");
    assert.strictEqual(result.content[0].type, "text", "Content should be text type");

    const parsed = JSON.parse(result.content[0].text);
    assert.strictEqual(parsed.ok, true, "API call should succeed");
    assert.strictEqual(parsed.status, 200, "Should return 200 status");
    assert.ok(Array.isArray(parsed.data), "Data should be an array");
  } finally {
    await client.close();
    await transport.close();
    serverProcess.kill();
  }
});

skipIfNoToken("MCP server calls todoist_api tool to POST task", async () => {
  const { client, transport, serverProcess } = await createMcpClient();

  try {
    const createResult = await client.callTool({
      name: "todoist_api",
      arguments: {
        endpoint: "/tasks",
        method: "POST",
        body: {
          content: "MCP protocol test task",
          due_string: "tomorrow"
        }
      }
    });

    assert.ok(createResult.content, "Should return content");
    const parsed = JSON.parse(createResult.content[0].text);
    assert.strictEqual(parsed.ok, true, "Task creation should succeed");
    assert.strictEqual(parsed.status, 200, "Should return 200 status");
    assert.ok(parsed.data.id, "Should return task ID");
    assert.strictEqual(parsed.data.content, "MCP protocol test task", "Content should match");

    const taskId = parsed.data.id;

    const deleteResult = await client.callTool({
      name: "todoist_api",
      arguments: {
        endpoint: `/tasks/${taskId}`,
        method: "DELETE"
      }
    });

    const deleteParsed = JSON.parse(deleteResult.content[0].text);
    assert.strictEqual(deleteParsed.ok, true, "Task deletion should succeed");
    assert.strictEqual(deleteParsed.status, 204, "Should return 204 status");
  } finally {
    await client.close();
    await transport.close();
    serverProcess.kill();
  }
});

skipIfNoToken("MCP server handles API errors properly", async () => {
  const { client, transport, serverProcess } = await createMcpClient();

  try {
    const result = await client.callTool({
      name: "todoist_api",
      arguments: {
        endpoint: "/nonexistent-endpoint",
        method: "GET"
      }
    });

    const parsed = JSON.parse(result.content[0].text);
    assert.strictEqual(parsed.ok, false, "Should indicate failure");
    assert.strictEqual(parsed.status, 404, "Should return 404 status");
  } finally {
    await client.close();
    await transport.close();
    serverProcess.kill();
  }
});