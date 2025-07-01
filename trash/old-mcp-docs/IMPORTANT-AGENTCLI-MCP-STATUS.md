# IMPORTANT: Agent CLI and MCP Tool Status

## Current Situation

After extensive testing across multiple package managers:
- ❌ `agentcli` - NOT available on npm, pipx, or Homebrew
- ❌ `mcp` (Model Context Protocol) - NOT available on npm, pipx, or Homebrew

These tools appear to be **conceptual/theoretical** components referenced in the project architecture but not yet implemented as real, installable software.

## What This Means

1. **The Pipeline Architecture is Sound** - The design using remote AI APIs and browser automation is valid
2. **Mock Implementation Works** - The mock scripts demonstrate the expected flow
3. **Real Tools Need Development** - To run the actual pipeline, these tools would need to be created

## Options for Moving Forward

### Option 1: Use Existing Tools
Replace the conceptual tools with real alternatives:
- Instead of `agentcli` → Use OpenAI/Anthropic Python SDKs directly
- Instead of `mcp` → Use Puppeteer/Playwright for browser automation

### Option 2: Build the Tools
Create the actual CLI tools as described:
- `agentcli` - A CLI wrapper around AI APIs
- `mcp` - A browser automation protocol implementation

### Option 3: Continue with Mocks
The mock implementation in `scripts/mock/` demonstrates the full flow and can be enhanced to simulate more realistic outputs.

## The Mock Pipeline Still Works

```bash
# Add mocks back to PATH
export PATH="/Users/d1f/Desktop/Ebooks/book-automation/scripts/mock:$PATH"

# Run the mock pipeline
make pipeline
```

This will generate placeholder files and demonstrate the complete workflow.

## Conclusion

The project documentation describes an idealized architecture using tools (`agentcli` and `mcp`) that don't exist as public packages. This is common in system design where the architecture is defined before implementation. The mock scripts successfully demonstrate how these tools would work if they existed.