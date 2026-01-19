#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

class CollabMCP {
  constructor(apiUrl, apiKey, useMethodCall = true) {
    this.apiUrl = apiUrl;
    this.apiKey = apiKey;
    this.useMethodCall = useMethodCall;
    this.server = new Server(
      { name: "lamdera-collab-mcp", version: "1.1.2" },
      { capabilities: { tools: {} } }
    );
  }

  async callRPC(endpoint, params = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const actualEndpoint = this.useMethodCall ? "methodCall" : endpoint;
    const actualBody = this.useMethodCall 
      ? Buffer.from(JSON.stringify({ endpoint, payload: params })).toString('base64')
      : params;

    try {
      const response = await fetch(`${this.apiUrl}/_r/${actualEndpoint}/`, {
        method: "POST",
        headers: {
          "x-api-key": this.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(actualBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const text = await response.text();

      if (!response.ok) {
        let errorMsg = `${response.status}: ${response.statusText}`;
        if (text.trim()) {
          try {
            const errorBody = JSON.parse(text);
            errorMsg =
              errorBody.error ||
              errorBody.message ||
              errorBody.details ||
              errorMsg;
          } catch {
            errorMsg = text.substring(0, 200);
          }
        }
        throw new Error(errorMsg);
      }
      if (!text.trim())
        return { success: true, message: "Operation completed" };

      try {
        return JSON.parse(text);
      } catch {
        if (text.includes("timeout"))
          throw new Error("Backend timeout - server may be restarting");
        throw new Error(`Invalid response format: ${text.substring(0, 100)}`);
      }
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === "AbortError")
        throw new Error("Request timeout - backend may be restarting");
      throw error;
    }
  }

  setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, () => ({
      tools: [
        // Projects
        {
          name: "list_projects",
          description: "List projects. To find the project for the current git repository, first run 'git remote get-url origin' locally to get the remote URL, then use the git_remote_url parameter to filter projects by that URL.",
          inputSchema: {
            type: "object",
            properties: {
              active_only: { type: "boolean", default: true },
              limit: { type: "number", default: 20 },
              git_remote_url: { 
                type: "string",
                description: "Filter projects by git remote URL. Use 'git remote get-url origin' to get the current repo's remote URL." 
              },
            },
          },
        },
        {
          name: "get_project",
          description: "Get project by ID",
          inputSchema: {
            type: "object",
            required: ["project_id"],
            properties: { project_id: { type: "number" } },
          },
        },
        {
          name: "create_project",
          description: "Create project. Use git_remote_url to associate the project with a git repository.",
          inputSchema: {
            type: "object",
            required: ["name"],
            properties: {
              name: { type: "string" },
              description: { type: "string" },
              tags: { type: "array", items: { type: "string" } },
              git_remote_url: { 
                type: "string",
                description: "Git remote URL to associate with this project. Use 'git remote get-url origin' to get current repo's URL."
              },
              worker_type: { type: "string", enum: ["dev", "pm", "reviewer"] },
              worker_name: { type: "string" },
            },
          },
        },
        {
          name: "get_project_by_git_remote",
          description: "Find a project by its git remote URL. First run 'git remote get-url origin' locally to get the remote URL of your current repository, then use this tool to find the associated project.",
          inputSchema: {
            type: "object",
            required: ["git_remote_url"],
            properties: {
              git_remote_url: { 
                type: "string",
                description: "The git remote URL to search for. Get this by running 'git remote get-url origin' in your repository."
              },
            },
          },
        },
        {
          name: "update_project",
          description: "Update project",
          inputSchema: {
            type: "object",
            required: ["project_id", "name"],
            properties: {
              project_id: { type: "number" },
              name: { type: "string" },
              description: { type: "string" },
              tags: { type: "array", items: { type: "string" } },
              git_remote_url: { type: "string" },
            },
          },
        },

        // Tasks
        {
          name: "list_tasks",
          description: "List tasks in a project. Tasks are returned sorted by their order (priority). Lower order numbers = higher priority. Use take_next_task to automatically pick and start working on the highest priority Todo task.",
          inputSchema: {
            type: "object",
            properties: {
              project_id: { type: "number" },
              status: { type: "array", items: { type: "string" } },
              limit: { type: "number", default: 50 },
            },
          },
        },
        {
          name: "get_task",
          description: "Get task by ID",
          inputSchema: {
            type: "object",
            required: ["task_id"],
            properties: { task_id: { type: "number" } },
          },
        },
        {
          name: "create_task",
          description: "Create task",
          inputSchema: {
            type: "object",
            required: ["project_id", "title", "task_type"],
            properties: {
              project_id: { type: "number" },
              title: { type: "string" },
              description: { type: "string" },
              task_type: {
                type: "string",
                enum: ["epic", "story", "task", "bug", "component"],
              },
              status: {
                type: "string",
                enum: ["todo", "in_progress", "ready_for_review", "under_review", "done", "blocked", "abandoned"],
                default: "todo",
              },
              priority: {
                type: "string",
                enum: ["low", "medium", "high", "critical"],
                default: "medium",
              },
              tags: { type: "array", items: { type: "string" } },
              worker_type: { type: "string", enum: ["dev", "pm", "reviewer"] },
              worker_name: { type: "string" },
            },
          },
        },
        {
          name: "update_task",
          description: "Update task properties including status transitions. Common workflows: Mark work complete (InProgress → ReadyForReview), Approve review (UnderReview → Done), Block task (any status → Blocked), Abandon task (any status → Abandoned). Use take_next_task for Todo→InProgress, take_next_review_task for ReadyForReview→UnderReview, and task_reject_review for UnderReview→Todo.",
          inputSchema: {
            type: "object",
            required: ["task_id"],
            properties: {
              task_id: { type: "number" },
              title: { type: "string" },
              description: { type: "string" },
              status: {
                type: "string",
                enum: ["todo", "in_progress", "ready_for_review", "under_review", "done", "blocked", "abandoned"],
              },
              priority: {
                type: "string",
                enum: ["low", "medium", "high", "critical"],
              },
              worker_type: { type: "string", enum: ["dev", "pm", "reviewer"] },
              worker_name: { type: "string" },
            },
          },
        },

        // Documents
        {
          name: "search_documents",
          description: "Search documents",
          inputSchema: {
            type: "object",
            required: ["query"],
            properties: {
              query: { type: "string" },
              project_id: { type: "number" },
              limit: { type: "number", default: 20 },
            },
          },
        },
        {
          name: "get_document",
          description: "Get document by ID",
          inputSchema: {
            type: "object",
            required: ["document_id"],
            properties: { document_id: { type: "number" } },
          },
        },
        {
          name: "create_document",
          description: "Create document",
          inputSchema: {
            type: "object",
            required: ["title", "type", "project_id"],
            properties: {
              title: { type: "string" },
              content: { type: "string" },
              type: {
                type: "string",
                enum: ["plan", "specification", "notes", "code", "other"],
              },
              project_id: { type: "number" },
              worker_type: { type: "string", enum: ["dev", "pm", "reviewer"] },
              worker_name: { type: "string" },
            },
          },
        },
        {
          name: "update_document",
          description: "Update document",
          inputSchema: {
            type: "object",
            required: ["document_id", "title", "content", "type"],
            properties: {
              document_id: { type: "number" },
              title: { type: "string" },
              content: { type: "string" },
              type: {
                type: "string",
                enum: ["plan", "specification", "notes", "code", "other"],
              },
              worker_type: { type: "string", enum: ["dev", "pm", "reviewer"] },
              worker_name: { type: "string" },
            },
          },
        },

        // Comments
        {
          name: "list_task_comments",
          description: "List task comments",
          inputSchema: {
            type: "object",
            required: ["task_id"],
            properties: {
              task_id: { type: "number" },
              limit: { type: "number", default: 20 },
              page: { type: "number", default: 1 },
            },
          },
        },
        {
          name: "upsert_comment",
          description: "Create a new comment or update an existing one. If comment_id is provided, updates the existing comment. Otherwise creates a new comment on the specified task.",
          inputSchema: {
            type: "object",
            required: ["content"],
            properties: {
              comment_id: { 
                type: "number",
                description: "Optional - provide to update an existing comment" 
              },
              task_id: { 
                type: "number",
                description: "Required when creating a new comment (not needed for updates)" 
              },
              content: { type: "string" },
              parent_comment_id: { 
                type: "number",
                description: "Optional - for threaded comments (only for new comments)" 
              },
              worker_type: { type: "string", enum: ["dev", "pm", "reviewer"] },
              worker_name: { type: "string" },
            },
          },
        },

        // Activity
        {
          name: "get_recent_activity",
          description: "Get recent activity",
          inputSchema: { type: "object", properties: {} },
        },
        {
          name: "get_task_status_analytics",
          description: "Get task status analytics including counts per status and timing data for InProgress and Review tasks",
          inputSchema: { 
            type: "object", 
            properties: {
              project_id: { type: "number" }
            }
          },
        },
        {
          name: "take_next_task",
          description: "Get the next task to work on: Automatically selects the highest priority (lowest order number) Todo task in the project and marks it as InProgress. This is the primary way to pick which task to work on next. Returns the task with all its comments. The system will NOT let you pick new tickets if there are tasks InProgress OR UnderReview (use force=true to override).",
          inputSchema: {
            type: "object",
            required: ["project_id"],
            properties: {
              project_id: { type: "number" },
              force: { type: "boolean", default: false }
            }
          },
        },
        {
          name: "take_next_review_task",
          description: "Get the next task to review: Automatically selects the highest priority (lowest order number) task that's ReadyForReview and marks it as UnderReview for you to review. Use this when you want to review tasks rather than work on new ones. Returns the task with all its comments. Only one task can be UnderReview per project (use force=true to override).",
          inputSchema: {
            type: "object",
            required: ["project_id"],
            properties: {
              project_id: { type: "number" },
              force: { type: "boolean", default: false }
            }
          },
        },
        
        // Task ordering
        {
          name: "move_task_to_top_or_bottom",
          description: "Move a task to the top or bottom of the order within its project",
          inputSchema: {
            type: "object",
            required: ["task_id", "position"],
            properties: { 
              task_id: { 
                type: "number",
                description: "The ID of the task to move"
              },
              position: {
                type: "string",
                enum: ["top", "bottom"],
                description: "Where to move the task - 'top' for highest priority or 'bottom' for lowest priority"
              }
            },
          },
        },
        {
          name: "task_reject_review",
          description: "Reject a task that's UnderReview back to Todo with a comment explaining why. The task will be moved to the front of the Todo queue (highest priority). This creates a comment with the rejection reason for tracking purposes.",
          inputSchema: {
            type: "object",
            required: ["task_id", "reviewer_comment"],
            properties: { 
              task_id: { 
                type: "number",
                description: "The ID of the UnderReview task to reject back to Todo"
              },
              reviewer_comment: {
                type: "string",
                description: "The reason for rejecting the task - will be added as a comment"
              }
            },
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        let params = {};
        let workerData = {};

        // Format worker info if provided
        if (args.worker_type && args.worker_name) {
          workerData = {
            worker_type: args.worker_type,
            name: args.worker_name,
          };
        }

        switch (name) {
          case "list_projects":
            params = {
              active_only: args.active_only ?? true,
              limit: args.limit ?? 20,
            };
            if (args.git_remote_url) {
              params.git_remote_url = args.git_remote_url;
            }
            break;
          case "get_project":
            params = { project_id: args.project_id };
            break;
          case "create_project":
            params = {
              name: args.name,
              description: args.description || "",
              tags: args.tags || [],
            };
            if (args.git_remote_url) {
              params.git_remote_url = args.git_remote_url;
            }
            if (Object.keys(workerData).length > 0)
              params.created_by_worker = workerData;
            break;
          case "update_project":
            params = {
              project_id: args.project_id,
              name: args.name,
              description: args.description || "",
              tags: args.tags || [],
            };
            if (args.git_remote_url) {
              params.git_remote_url = args.git_remote_url;
            }
            if (Object.keys(workerData).length > 0)
              params.last_modified_by_worker = workerData;
            break;
          case "list_tasks":
            params = {
              project_id: args.project_id,
              status: args.status,
              limit: args.limit ?? 50,
            };
            break;
          case "get_task":
            params = { task_id: args.task_id };
            break;
          case "create_task":
            params = {
              project_id: args.project_id,
              title: args.title,
              description: args.description || "",
              task_type: args.task_type,
              status: args.status || "todo",
              priority: args.priority || "medium",
              tags: args.tags || [],
            };
            if (Object.keys(workerData).length > 0)
              params.created_by_worker = workerData;
            break;
          case "update_task":
            params = {
              task_id: args.task_id,
              title: args.title || "",
              description: args.description || "",
              status: args.status || "todo",
              priority: args.priority || "medium",
            };
            if (Object.keys(workerData).length > 0)
              params.last_modified_by_worker = workerData;
            break;
          case "search_documents":
            params = {
              query: args.query,
              project_id: args.project_id,
              limit: args.limit ?? 20,
            };
            break;
          case "get_document":
            params = { document_id: args.document_id };
            break;
          case "create_document":
            params = {
              title: args.title,
              content: args.content || "",
              document_type: args.type,
              project_id: args.project_id,
            };
            if (Object.keys(workerData).length > 0)
              params.created_by_worker = workerData;
            break;
          case "update_document":
            params = {
              document_id: args.document_id,
              title: args.title,
              content: args.content,
              document_type: args.type,
            };
            if (Object.keys(workerData).length > 0)
              params.last_modified_by_worker = workerData;
            break;
          case "list_task_comments":
            params = {
              task_id: args.task_id,
              limit: args.limit ?? 20,
              page: args.page ?? 1,
            };
            break;
          case "upsert_comment":
            if (args.comment_id) {
              // Update existing comment
              params = { comment_id: args.comment_id, content: args.content };
            } else {
              // Create new comment
              params = {
                task_id: args.task_id,
                content: args.content,
                parent_comment_id: args.parent_comment_id,
              };
              if (Object.keys(workerData).length > 0)
                params.created_by_worker = workerData;
            }
            break;
          case "get_recent_activity":
            params = {};
            break;
          case "get_task_status_analytics":
            params = { project_id: args.project_id };
            break;

          case "take_next_task":
            params = { project_id: args.project_id, force: args.force ?? false };
            break;

          case "take_next_review_task":
            params = { project_id: args.project_id, force: args.force ?? false };
            break;

            
          case "get_project_by_git_remote":
            // This will use list_projects internally with git_remote_url filter
            break;
            
          case "move_task_to_top_or_bottom":
            params = { task_id: args.task_id };
            break;
            
          case "task_reject_review":
            params = { 
              task_id: args.task_id,
              reviewer_comment: args.reviewer_comment 
            };
            break;
            
          default:
            throw new Error(`Unknown tool: ${name}`);
        }

        // Special handling for get_project_by_git_remote
        if (name === "get_project_by_git_remote") {
          const projects = await this.callRPC("listProjects", {
            git_remote_url: args.git_remote_url,
            active_only: true
          });
          
          if (projects.data && projects.data.length === 1) {
            return {
              content: [{ type: "text", text: JSON.stringify(projects.data[0], null, 2) }],
            };
          } else if (projects.data && projects.data.length > 1) {
            return {
              content: [{ 
                type: "text", 
                text: `Error: Multiple projects found with git remote URL ${args.git_remote_url}. Found ${projects.data.length} projects.`
              }],
            };
          } else {
            return {
              content: [{ 
                type: "text", 
                text: `Error: No project found with git remote URL ${args.git_remote_url}`
              }],
            };
          }
        }

        // Special handling for merged tools
        let endpoint;
        if (name === "move_task_to_top_or_bottom") {
          endpoint = args.position === "top" ? "moveTaskToTop" : "moveTaskToBottom";
        } else if (name === "upsert_comment") {
          endpoint = args.comment_id ? "updateComment" : "createComment";
        } else {
          endpoint = name.replace(/_([a-z])/g, (_, letter) =>
            letter.toUpperCase()
          );
        }
        
        const result = await this.callRPC(endpoint, params);

        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error: ${error.message}` }],
        };
      }
    });
  }

  async start() {
    this.setupHandlers();
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }
}

// CLI
const args = process.argv.slice(2);
let apiUrl = "http://localhost:8000";
let apiKey = "";
let useMethodCall = true;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--version" || args[i] === "-v") {
    console.log("1.0.3");
    process.exit(0);
  } else if (args[i] === "--url" && i + 1 < args.length) {
    apiUrl = args[i + 1];
    i++;
  } else if (args[i] === "--key" && i + 1 < args.length) {
    apiKey = args[i + 1];
    i++;
  } else if (args[i] === "--direct") {
    useMethodCall = false;
  }
}

if (!apiKey) {
  console.error("Error: API key required. Use --key <api-key>");
  console.error("Usage: node server.js --key <api-key> [--url <url>] [--direct] [--version]");
  process.exit(1);
}

const server = new CollabMCP(apiUrl, apiKey, useMethodCall);
server.start().catch(console.error);
