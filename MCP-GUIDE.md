# MCP Servers for Book Automation

## Installed MCPs

### Core MCPs (Always Active)

1. **filesystem** - File management
   - Read/write chapters
   - Manage book structure
   - Access templates

2. **memory** - Context persistence
   - Remember book details across sessions
   - Track writing progress
   - Store character/plot information

3. **github** - Version control
   - Create PRs for book releases
   - Track issues/feedback
   - Manage versions

4. **redis** - Queue management
   - Monitor pipeline jobs
   - Track processing status
   - Cache frequent data

5. **anthropic** - AI text generation
   - Generate chapters
   - Rewrite content
   - Analyze text quality

### Utility MCPs

6. **sqlite** - Book metadata
   - Store book information
   - Track sales/downloads
   - Manage author details

7. **fetch** - Web research
   - Research topics
   - Gather reference material
   - Check facts

8. **time** - Scheduling
   - Schedule pipeline runs
   - Track deadlines
   - Time-based automation

9. **puppeteer** - PDF generation
   - Convert HTML to PDF
   - Screenshot previews
   - Browser automation

10. **sequentialthinking** - Planning
    - Break down complex tasks
    - Create structured outlines
    - Step-by-step reasoning

## Usage Examples

### Creating a new book
```
1. Use memory MCP to store book concept
2. Use sequentialthinking to plan chapters
3. Use filesystem to create chapter files
4. Use anthropic to generate content
5. Use github to version control
```

### Researching topics
```
1. Use fetch MCP to gather web content
2. Use anthropic to analyze and summarize
3. Use memory to store key findings
4. Use sqlite to track sources
```

### Publishing workflow
```
1. Use filesystem to read final chapters
2. Use puppeteer to generate PDF
3. Use github to create release
4. Use sqlite to update book status
```

## Configuration

All MCPs are configured in Claude Desktop settings.
API keys are loaded from the project's .env file.

To add new MCPs:
1. Install via npm
2. Run `node mcp-config/migrate-and-setup-mcps.js`
3. Restart Claude Desktop
