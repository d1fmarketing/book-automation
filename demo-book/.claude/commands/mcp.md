# MCP Management Command

Manage Model Context Protocol servers for Claude Elite.

## Usage

```bash
claude /mcp [action] [args]
```bash

## Actions

### List all MCPs

```bash
claude /mcp
claude /mcp list
```bash

Shows all currently connected MCPs with their status.

### Install Elite Stack

```bash
claude /mcp install-stack
```bash

Runs `.claude/scripts/install-complete-stack.sh` to install the complete MCP stack.

### Add individual MCP

```bash
claude /mcp add [name] [command] [args]
```bash

Example:

```bash
claude /mcp add brightdata "npx @brightdata/mcp-server" --api-key="KEY"
```bash

### Remove MCP

```bash
claude /mcp remove [name]
```bash

### Test MCP connection

```bash
claude /mcp test [name]
```bash

Tests if a specific MCP is responding correctly.

### Show MCP info

```bash
claude /mcp info [name]
```bash

Shows detailed information about a specific MCP.

## Elite Stack MCPs

1. **brightdata** - Web scraping with proxies
2. **supabase** - Database operations
3. **puppeteer** - Browser automation
4. **upstash** - Redis caching
5. **shopify** - E-commerce (optional)
6. **sentry** - Error monitoring (optional)

## Examples

Test web scraping:

```bash
Use brightdata to scrape https://example.com in markdown format
```bash

Test database:

```bash
Use supabase to run: SELECT current_timestamp
```bash

Test caching:

```bash
Use upstash to set key "test" with value "hello" and TTL 60 seconds
```bash
