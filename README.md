# @sjalq/todoist-mcp-lite

Minimal Todoist MCP server with direct API passthrough. Built with pure functional principles and minimal code.

## Features

- Single tool with direct Todoist API v1 passthrough (`https://api.todoist.com/api/v1`)
- Supports all HTTP methods (GET, POST, PUT, PATCH, DELETE)
- CLI `--token` flag or environment variable authentication
- NPX-ready - no installation required
- Comprehensive test suite (property-based + integration + MCP protocol tests)
- Pure functional JavaScript - minimal dependencies
- Token-efficient tool descriptions

## Getting Your Todoist API Token

1. Log in to [Todoist](https://todoist.com)
2. Go to Settings → Integrations → Developer
3. Copy your API token from the "API token" section

## Usage

### Via NPX (recommended)

```bash
npx @sjalq/todoist-mcp-lite --token YOUR_TODOIST_TOKEN
```

Or with environment variable:

```bash
export TODOIST_API_TOKEN=YOUR_TODOIST_TOKEN
npx @sjalq/todoist-mcp-lite
```

### In Claude Desktop / Claude Code config

Add to your `~/.claude.json`:

```json
{
  "mcpServers": {
    "todoist": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@sjalq/todoist-mcp-lite"],
      "env": {
        "TODOIST_API_TOKEN": "your_token_here"
      }
    }
  }
}
```

Or with local checkout:

```json
{
  "mcpServers": {
    "todoist": {
      "type": "stdio",
      "command": "node",
      "args": ["/path/to/todoist-mcp-lite/index.js"],
      "env": {
        "TODOIST_API_TOKEN": "your_token_here"
      }
    }
  }
}
```

Or with `--token` flag:

```json
{
  "mcpServers": {
    "todoist": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@sjalq/todoist-mcp-lite", "--token", "your_token_here"]
    }
  }
}
```

## Tool

The server exposes a single tool: `todoist_api`

### Parameters

- `endpoint` (string, required): API path under `/api/v1` (e.g., `/tasks`, `/projects`, `/tasks/filter?query=today`)
- `method` (string, required): HTTP method (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`)
- `body` (object, optional): Request body for POST/PUT/PATCH requests

### Response

The MCP wrapper always returns:

- `status`: HTTP status code
- `ok`: boolean indicating success
- `data`: Response body from Todoist (or error object)

### List endpoints (v1 envelope)

Paginated list endpoints (e.g. `GET /projects`, `GET /tasks`) return:

```json
{
  "results": [ /* items */ ],
  "next_cursor": "opaque-cursor-or-null"
}
```

Not a bare array. Read items from `data.results`. For the next page, pass `?cursor=<next_cursor>&limit=50`.

IDs are opaque strings.

### Filtering tasks (v1 change)

REST v2 used `GET /tasks?filter=today`. That was removed.

Use:

```
GET /tasks/filter?query=today
GET /tasks/filter?query=overdue
```

### Example

```json
{
  "endpoint": "/tasks",
  "method": "POST",
  "body": {
    "content": "Buy milk",
    "due_string": "tomorrow"
  }
}
```

## API Documentation

Full Todoist API v1 docs: https://developer.todoist.com/api/v1/

Migration notes (REST v2 / Sync v9 → v1): pagination, opaque string IDs, `/tasks/filter?query=`, and other renames are covered under "Migrating from v9" in those docs.

## Development

### Clone and Install

```bash
git clone https://github.com/sjalq/todoist-mcp-lite.git
cd todoist-mcp-lite
npm install
```

### Running Tests

Property-based tests run without API token:

```bash
npm test
```

Integration and MCP protocol tests require a token:

```bash
export TODOIST_API_TOKEN=your_token
npm test
```

Test suite includes:
- 4 property-based tests (pure function validation)
- 6 integration tests (real API calls)
- 4 MCP protocol tests (full server/client interaction)

### Local Testing with MCP Inspector

```bash
npx @modelcontextprotocol/inspector node index.js --token YOUR_TOKEN
```

Then open http://localhost:6274 to interactively test the server.

## Architecture

Pure functional design with three core functions:

- `getToken(args)` - Extract token from CLI args or environment
- `callTodoist(token)` - Curried API caller returning async function
- `createServer(apiCall)` - MCP server factory with tool registration

Zero mocks, zero state, just functions.

## License

ISC - see [LICENSE](LICENSE) file for details.

## Contributing

Issues and PRs welcome at https://github.com/sjalq/todoist-mcp-lite
