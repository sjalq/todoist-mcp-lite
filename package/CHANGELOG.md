# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-09-30

### Added
- Initial release
- Single `todoist_api` tool with direct Todoist REST API v2 passthrough
- Support for all HTTP methods (GET, POST, PUT, PATCH, DELETE)
- CLI `--token` flag and environment variable authentication
- Pure functional error handling (no exceptions)
- 15-second request timeout
- User-agent header identification
- Comprehensive test suite:
  - 4 property-based tests
  - 6 integration tests
  - 4 MCP protocol tests
- Common use cases documented in tool description
- Automatic HTTP method uppercasing
- Empty body detection and handling
- Network error handling with proper error types
- Response parsing with fallback to text

### Technical Details
- Pure functional JavaScript with no mocks
- Version read from package.json
- Windows/NPX-compatible module detection
- Graceful error handling for all failure modes
- Minimal token usage in LLM context