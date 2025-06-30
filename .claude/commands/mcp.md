# MCP Management Command

Manage Model Context Protocol servers for Claude Elite.

## Usage:
```
claude /mcp [action] [args]
```

## Actions:

### List all MCPs
```
claude /mcp
claude /mcp list
```
Shows all currently connected MCPs with their status.

### Install Elite Stack
```
claude /mcp install-stack
```
Runs `.claude/scripts/install-complete-stack.sh` to install the complete MCP stack.

### Add individual MCP
```
claude /mcp add [name] [command] [args]
```
Example:
```
claude /mcp add brightdata "npx @brightdata/mcp-server" --api-key="KEY"
```

### Remove MCP
```
claude /mcp remove [name]
```

### Test MCP connection
```
claude /mcp test [name]
```
Tests if a specific MCP is responding correctly.

### Show MCP info
```
claude /mcp info [name]
```
Shows detailed information about a specific MCP.

## Elite Stack MCPs:

1. **brightdata** - Web scraping with proxies
2. **supabase** - Database operations
3. **puppeteer** - Browser automation
4. **upstash** - Redis caching
5. **shopify** - E-commerce (optional)
6. **sentry** - Error monitoring (optional)

## Examples:

Test web scraping:
```
Use brightdata to scrape https://example.com in markdown format
```

Test database:
```
Use supabase to run: SELECT current_timestamp
```

Test caching:
```
Use upstash to set key "test" with value "hello" and TTL 60 seconds
```