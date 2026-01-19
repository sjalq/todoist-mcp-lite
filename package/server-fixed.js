#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

class CollabMCP {
  constructor(apiUrl, apiKey) {
    this.apiUrl = apiUrl;
    this.apiKey = apiKey;
    this.server = new Server({ name: 'lamdera-collab-mcp', version: '1.0.0' }, { capabilities: { tools: {} } });
  }

  async callRPC(endpoint, params = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    
    try {
      // Log the exact request being made
      const url = `${this.apiUrl}/_r/${endpoint}/`;
      const body = JSON.stringify(params);
      
      console.error(`[DEBUG] Calling: ${url}`);
      console.error(`[DEBUG] Headers: x-api-key=${this.apiKey.substring(0,10)}...`);
      console.error(`[DEBUG] Body: ${body}`);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 
          'x-api-key': this.apiKey, 
          'Content-Type': 'application/json',
          'User-Agent': 'lamdera-collab-mcp/1.0.0'
        },
        body: body,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      const text = await response.text();
      console.error(`[DEBUG] Response status: ${response.status}`);
      console.error(`[DEBUG] Response text: ${text.substring(0, 200)}`);
      
      if (!response.ok) {
        let errorMsg = `${response.status}: ${response.statusText}`;
        if (text.trim()) {
          try {
            const errorBody = JSON.parse(text);
            errorMsg = errorBody.error || errorBody.message || errorBody.details || errorMsg;
          } catch {
            // Check if it's Cloudflare HTML
            if (text.includes('<!DOCTYPE html>') || text.includes('Just a moment')) {
              errorMsg = `Cloudflare protection page returned. This usually means the endpoint path is incorrect. Used: ${url}`;
            } else {
              errorMsg = text.substring(0, 200);
            }
          }
        }
        throw new Error(errorMsg);
      }
      
      if (!text.trim()) return { success: true, message: 'Operation completed' };
      
      try {
        return JSON.parse(text);
      } catch {
        if (text.includes('timeout')) throw new Error('Backend timeout - server may be restarting');
        throw new Error(`Invalid response format: ${text.substring(0, 100)}`);
      }
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') throw new Error('Request timeout - backend may be restarting');
      throw error;
    }
  }

  setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, () => ({ tools: [
      // Projects
      { name: 'list_projects', description: 'List projects', inputSchema: { type: 'object', properties: { active_only: { type: 'boolean', default: true }, limit: { type: 'number', default: 20 } } } },
      { name: 'get_project', description: 'Get project by ID', inputSchema: { type: 'object', required: ['project_id'], properties: { project_id: { type: 'number' } } } },
      { name: 'create_project', description: 'Create project', inputSchema: { type: 'object', required: ['name'], properties: { name: { type: 'string' }, description: { type: 'string' }, tags: { type: 'array', items: { type: 'string' } }, worker_type: { type: 'string', enum: ['dev', 'pm', 'reviewer'] }, worker_name: { type: 'string' } } } },
      
      // Tasks  
      { name: 'list_tasks', description: 'List tasks', inputSchema: { type: 'object', properties: { project_id: { type: 'number' }, status: { type: 'array', items: { type: 'string' } }, limit: { type: 'number', default: 50 } } } },
      { name: 'list_epics', description: 'List epics', inputSchema: { type: 'object', properties: { project_id: { type: 'number' }, limit: { type: 'number', default: 20 } } } },
      { name: 'get_task', description: 'Get task by ID', inputSchema: { type: 'object', required: ['task_id'], properties: { task_id: { type: 'number' } } } },
      { name: 'create_task', description: 'Create task', inputSchema: { type: 'object', required: ['project_id', 'title', 'task_type'], properties: { project_id: { type: 'number' }, title: { type: 'string' }, description: { type: 'string' }, task_type: { type: 'string', enum: ['epic', 'story', 'task', 'bug', 'component'] }, status: { type: 'string', enum: ['todo', 'in_progress', 'review', 'done', 'blocked'], default: 'todo' }, priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'], default: 'medium' }, tags: { type: 'array', items: { type: 'string' } }, worker_type: { type: 'string', enum: ['dev', 'pm', 'reviewer'] }, worker_name: { type: 'string' } } } },
      { name: 'update_task', description: 'Update task', inputSchema: { type: 'object', required: ['task_id'], properties: { task_id: { type: 'number' }, title: { type: 'string' }, description: { type: 'string' }, status: { type: 'string', enum: ['todo', 'in_progress', 'review', 'done', 'blocked'] }, priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] }, worker_type: { type: 'string', enum: ['dev', 'pm', 'reviewer'] }, worker_name: { type: 'string' } } } },

      // Documents
      { name: 'search_documents', description: 'Search documents', inputSchema: { type: 'object', required: ['query'], properties: { query: { type: 'string' }, project_id: { type: 'number' }, limit: { type: 'number', default: 20 } } } },
      { name: 'get_document', description: 'Get document by ID', inputSchema: { type: 'object', required: ['document_id'], properties: { document_id: { type: 'number' } } } },
      { name: 'create_document', description: 'Create document', inputSchema: { type: 'object', required: ['title', 'type', 'project_id'], properties: { title: { type: 'string' }, content: { type: 'string' }, type: { type: 'string', enum: ['plan', 'specification', 'notes', 'code', 'other'] }, project_id: { type: 'number' }, worker_type: { type: 'string', enum: ['dev', 'pm', 'reviewer'] }, worker_name: { type: 'string' } } } },
      { name: 'update_document', description: 'Update document', inputSchema: { type: 'object', required: ['document_id', 'title', 'content', 'type'], properties: { document_id: { type: 'number' }, title: { type: 'string' }, content: { type: 'string' }, type: { type: 'string', enum: ['plan', 'specification', 'notes', 'code', 'other'] }, worker_type: { type: 'string', enum: ['dev', 'pm', 'reviewer'] }, worker_name: { type: 'string' } } } },

      // Comments
      { name: 'list_task_comments', description: 'List task comments', inputSchema: { type: 'object', required: ['task_id'], properties: { task_id: { type: 'number' }, limit: { type: 'number', default: 20 }, page: { type: 'number', default: 1 } } } },
      { name: 'create_comment', description: 'Create comment', inputSchema: { type: 'object', required: ['task_id', 'content'], properties: { task_id: { type: 'number' }, content: { type: 'string' }, parent_comment_id: { type: 'number' }, worker_type: { type: 'string', enum: ['dev', 'pm', 'reviewer'] }, worker_name: { type: 'string' } } } },
      { name: 'update_comment', description: 'Update comment', inputSchema: { type: 'object', required: ['comment_id', 'content'], properties: { comment_id: { type: 'number' }, content: { type: 'string' } } } },

      // Activity
      { name: 'get_recent_activity', description: 'Get recent activity', inputSchema: { type: 'object', properties: {} } },
      { name: 'get_comment', description: 'Get comment by ID', inputSchema: { type: 'object', required: ['comment_id'], properties: { comment_id: { type: 'number' } } } },
      { name: 'delete_comment', description: 'Delete comment', inputSchema: { type: 'object', required: ['comment_id'], properties: { comment_id: { type: 'number' } } } }
    ]}));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      console.error(`[DEBUG] Tool called: ${name}`);
      console.error(`[DEBUG] Arguments: ${JSON.stringify(args)}`);
      
      try {
        let params = {};
        let workerData = {};

        // Format worker info if provided
        if (args.worker_type && args.worker_name) {
          workerData = { worker_type: args.worker_type, name: args.worker_name };
        }

        switch (name) {
          case 'list_projects':
            params = { active_only: args.active_only ?? true, limit: args.limit ?? 20 };
            break;
          case 'get_project':
            params = { project_id: args.project_id };
            break;
          case 'create_project':
            params = { name: args.name, description: args.description || '', tags: args.tags || [] };
            if (Object.keys(workerData).length > 0) params.created_by_worker = workerData;
            break;
          case 'list_tasks':
            params = { project_id: args.project_id, status: args.status, limit: args.limit ?? 50 };
            break;
          case 'list_epics':
            params = { project_id: args.project_id, limit: args.limit ?? 20 };
            break;
          case 'get_task':
            params = { task_id: args.task_id };
            break;
          case 'create_task':
            params = { project_id: args.project_id, title: args.title, description: args.description || '', task_type: args.task_type, status: args.status || 'todo', priority: args.priority || 'medium', tags: args.tags || [] };
            if (Object.keys(workerData).length > 0) params.created_by_worker = workerData;
            break;
          case 'update_task':
            params = { 
              task_id: args.task_id, 
              title: args.title || '', 
              description: args.description || '', 
              status: args.status || 'todo', 
              priority: args.priority || 'medium' 
            };
            if (Object.keys(workerData).length > 0) params.last_modified_by_worker = workerData;
            break;
          case 'search_documents':
            params = { query: args.query, project_id: args.project_id, limit: args.limit ?? 20 };
            break;
          case 'get_document':
            params = { document_id: args.document_id };
            break;
          case 'create_document':
            params = { 
              title: args.title, 
              content: args.content || '', 
              document_type: args.type,  // Transform 'type' to 'document_type'
              project_id: args.project_id 
            };
            if (Object.keys(workerData).length > 0) params.created_by_worker = workerData;
            console.error(`[DEBUG] Transformed params: ${JSON.stringify(params)}`);
            break;
          case 'update_document':
            params = { document_id: args.document_id, title: args.title, content: args.content, document_type: args.type };
            if (Object.keys(workerData).length > 0) params.last_modified_by_worker = workerData;
            break;
          case 'list_task_comments':
            params = { task_id: args.task_id, limit: args.limit ?? 20, page: args.page ?? 1 };
            break;
          case 'create_comment':
            params = { task_id: args.task_id, content: args.content, parent_comment_id: args.parent_comment_id };
            if (Object.keys(workerData).length > 0) params.created_by_worker = workerData;
            break;
          case 'update_comment':
            params = { comment_id: args.comment_id, content: args.content };
            break;
          case 'get_recent_activity':
            params = {};
            break;
          case 'get_comment':
            params = { comment_id: args.comment_id };
            break;
          case 'delete_comment':
            params = { comment_id: args.comment_id };
            break;
          default:
            throw new Error(`Unknown tool: ${name}`);
        }

        const endpoint = name.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
        console.error(`[DEBUG] Calling endpoint: ${endpoint}`);
        
        const result = await this.callRPC(endpoint, params);
        
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
        };
      } catch (error) {
        console.error(`[DEBUG] Error: ${error.message}`);
        return {
          content: [{ type: 'text', text: `Error: ${error.message}` }]
        };
      }
    });
  }

  async start() {
    this.setupHandlers();
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('[DEBUG] MCP Server started');
  }
}

// CLI
const args = process.argv.slice(2);
let apiUrl = 'http://localhost:8000';
let apiKey = '';

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--url' && i + 1 < args.length) {
    apiUrl = args[i + 1];
    i++;
  } else if (args[i] === '--key' && i + 1 < args.length) {
    apiKey = args[i + 1];
    i++;
  }
}

if (!apiKey) {
  console.error('[ERROR] API key is required. Use --key <api-key>');
  process.exit(1);
}

console.error(`[DEBUG] Starting with URL: ${apiUrl}, Key: ${apiKey.substring(0,10)}...`);

const mcp = new CollabMCP(apiUrl, apiKey);
mcp.start().catch(console.error);