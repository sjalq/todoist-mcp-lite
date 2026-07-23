#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { pathToFileURL } from "node:url";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import fetch from "node-fetch";
import AbortController from "abort-controller";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pkg = JSON.parse(readFileSync(join(__dirname, "package.json"), "utf-8"));

const getToken = (args) => {
  const tokenIdx = args.indexOf("--token");
  return tokenIdx !== -1 ? args[tokenIdx + 1] : process.env.TODOIST_API_TOKEN;
};

const parseJson = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

const safeResponse = (res) =>
  res.text()
    .then(text => ({ status: res.status, ok: res.ok, data: text ? parseJson(text) : null }))
    .catch(error => ({ status: res.status, ok: false, data: { error: error.message, type: "ResponseParseError" } }));

const safeFetch = (url, options) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  return fetch(url, { ...options, signal: controller.signal })
    .then(res => {
      clearTimeout(timeout);
      return safeResponse(res);
    })
    .catch(error => {
      clearTimeout(timeout);
      const type = error.name === "AbortError" ? "TimeoutError" : "NetworkError";
      return { status: 0, ok: false, data: { error: error.message, type } };
    });
};

const BASE_URL = "https://api.todoist.com/api/v1";

const callTodoist = (token) => (endpoint, method, body) => {
  const normalizedMethod = method.toUpperCase();
  const hasBody = body && Object.keys(body).length > 0;

  return safeFetch(`${BASE_URL}${endpoint}`, {
    method: normalizedMethod,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": `todoist-mcp-lite/${pkg.version}`
    },
    body: hasBody ? JSON.stringify(body) : undefined
  });
};

const createServer = (apiCall) => {
  const server = new Server(
    { name: "todoist-mcp-lite", version: pkg.version },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, () => ({
    tools: [{
      name: "todoist_api",
      description: `PURE API PASSTHROUGH to Todoist API v1 (unified API).
Base URL is https://api.todoist.com/api/v1 — pass paths only (e.g. /tasks, /projects).

LIST RESPONSE ENVELOPE: Paginated list endpoints return
  { results: [...], next_cursor: string|null }
NOT a bare array. Use data.results for items. Pass next_cursor as ?cursor=... for the next page.
IDs are opaque strings (not numeric).

FILTERING TASKS: Do NOT use /tasks?filter=... (removed). Use:
  GET /tasks/filter?query=today
  GET /tasks/filter?query=overdue
(query supports Todoist filter syntax; lang= optional)

PAGINATION: ?limit=50&cursor=<next_cursor from previous response>

Common uses:
1. GET /tasks - List tasks (optional: project_id, label_id, ids, limit, cursor) → {results, next_cursor}
2. GET /tasks/filter?query=today - Filter tasks by Todoist query → {results, next_cursor}
3. POST /tasks - Create task (required: content; optional: due_string, project_id, priority 1-4, labels)
4. POST /tasks/:id/close - Complete task
5. DELETE /tasks/:id - Delete task
6. GET /projects - List projects → {results, next_cursor}

⚠️ RESPONSE SIZE: Large responses may exceed token limits. Prefer filters, project_id, limit, or specific ids.

MCP wrapper response: {status: number, ok: boolean, data: <API body or error>}
Full docs: https://developer.todoist.com/api/v1/`,
      inputSchema: {
        type: "object",
        properties: {
          endpoint: { type: "string", description: "API path under /api/v1 (e.g., /tasks, /tasks/filter?query=today, /projects)" },
          method: { type: "string", enum: ["GET", "POST", "PUT", "PATCH", "DELETE"] },
          body: { type: "object", description: "Request body (optional)" }
        },
        required: ["endpoint", "method"]
      }
    }]
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (request.params.name !== "todoist_api") {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({ error: "Unknown tool", requested: request.params.name }, null, 2)
        }],
        isError: true
      };
    }
    const { endpoint, method, body } = request.params.arguments;
    const result = await apiCall(endpoint, method, body);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });

  return server;
};

const main = () => {
  const token = getToken(process.argv);
  if (!token) {
    console.error("Error: TODOIST_API_TOKEN required via env or --token flag");
    process.exit(1);
  }
  const server = createServer(callTodoist(token));
  const transport = new StdioServerTransport();
  server.connect(transport).catch((error) => {
    console.error("Fatal error connecting MCP server:", error);
    process.exit(1);
  });
};

main();

export { callTodoist, createServer, getToken };