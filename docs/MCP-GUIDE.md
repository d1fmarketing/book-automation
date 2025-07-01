# MCP-GUIDE.md - Complete Model Context Protocol Guide

## 1. What is MCP? (Core Understanding)

**MCP (Model Context Protocol)** is the system that enables Claude to interact with external tools and services. These are Claude's internal capabilities, NOT command-line tools you can install or run directly.

### Key Points:
- ✅ MCP = Claude's tools (browser control, file operations, etc.)
- ❌ MCP ≠ A CLI command you can run
- ❌ MCP ≠ A package you can install with npm/pip

### How It Really Works:
When you ask Claude to "use MCP to view a PDF", Claude uses internal tools like:
- `puppeteer_navigate` - Navigate to URLs
- `puppeteer_screenshot` - Take screenshots
- `puppeteer_execute` - Execute JavaScript in browser
- File system tools for reading/writing files

## 2. How MCP Works in Practice

### Correct Usage Examples:

**✅ RIGHT: Ask Claude to use MCP**
```
"Claude, can you use MCP to check if the PDF at build/dist/ebook.pdf is rendering correctly?"
"Please use your browser tools to take a screenshot of the generated PDF"
```

**❌ WRONG: Try to run MCP commands**
```bash
# These commands DO NOT EXIST:
mcp start --browser      # ❌ NOT REAL
agentcli pdf view        # ❌ NOT REAL
mcp-puppeteer navigate   # ❌ NOT REAL
```

### Real Example from Actual Usage:
```javascript
// When Claude uses MCP, it might execute something like:
await page.goto('file:///path/to/pdf');
const screenshot = await page.screenshot();
// But YOU don't write this - Claude does it internally
```

## 3. MCP Tools Available

### 3.1 Puppeteer Tools (Browser Control)

Claude has access to these Puppeteer MCP tools:

- **puppeteer_navigate**: Navigate to any URL or local file
- **puppeteer_screenshot**: Capture screenshots of pages
- **puppeteer_click**: Click on elements
- **puppeteer_type**: Type text into inputs
- **puppeteer_execute**: Run JavaScript in the browser
- **puppeteer_evaluate**: Extract data from pages

#### PDF Viewing Example:
```
User: "Please check if the PDF at build/dist/ebook.pdf displays the cover image"

Claude will:
1. Use puppeteer_navigate to open the PDF
2. Use puppeteer_screenshot to capture what's visible
3. Analyze the screenshot to verify the cover
4. Report findings back to you
```

### 3.2 File System Tools

- **Read**: Read file contents
- **Write**: Create or overwrite files
- **Edit**: Modify existing files
- **MultiEdit**: Make multiple edits in one operation
- **Bash**: Execute shell commands

### 3.3 Other Core Tools

- **WebSearch**: Search the internet
- **WebFetch**: Fetch and analyze web content
- **TodoRead/TodoWrite**: Manage task lists
- **Task**: Launch specialized agents

## 4. Common Mistakes to Avoid

### Mistake #1: Trying to Install MCP
```bash
# WRONG - These packages don't exist:
npm install mcp-tools        # ❌
pip install agentcli         # ❌
brew install mcp             # ❌
```

### Mistake #2: Writing MCP Commands in Scripts
```bash
#!/bin/bash
# WRONG - This won't work:
mcp start --headless         # ❌
mcp pdf verify output.pdf    # ❌
```

### Mistake #3: Confusing MCP with Real CLIs
Real tools you CAN use:
- `puppeteer` (npm package)
- `playwright` (npm package)
- `selenium` (various packages)

These are NOT MCP - they're separate tools you install and use directly.

## 5. Integration Possibilities

### Current MCP Integrations in Claude:

1. **Browser Automation**: Full Puppeteer control
2. **File Operations**: Complete filesystem access
3. **Web Access**: Search and fetch capabilities
4. **Development Tools**: Code execution, testing

### Future Possibilities:

- **Database Access**: Query PostgreSQL, MongoDB
- **Cloud Services**: AWS, Google Cloud operations
- **API Integrations**: Direct API calls
- **DevOps Tools**: Docker, Kubernetes control

## 6. Practical Examples for This Project

### PDF Verification Workflow

1. **Generate PDF**:
   ```bash
   npm run build:pdf
   ```

2. **Ask Claude to Verify**:
   ```
   "Claude, please use MCP to verify the PDF at build/dist/ebook.pdf has:
   - The cover image on page 1
   - Correct 6x9 inch dimensions
   - All chapters rendering properly"
   ```

3. **Claude's Process**:
   - Opens PDF using browser tools
   - Takes screenshots of key pages
   - Analyzes layout and content
   - Reports issues found

### Visual QA Process

Instead of complex scripts, simply ask:
```
"Please run a visual QA check on the latest PDF build"
```

Claude will:
1. Locate the PDF file
2. Open it in a browser
3. Check each critical element
4. Provide detailed feedback

### Automated Checks

You can create scripts that prompt Claude:
```javascript
// scripts/request-mcp-check.js
console.log(`
Please use MCP to verify:
1. PDF exists at build/dist/ebook.pdf
2. Cover image is visible
3. Table of contents is present
4. All ${chapters.length} chapters are included
`);
```

## 7. Best Practices

### DO:
- ✅ Ask Claude to use MCP for tasks
- ✅ Provide clear file paths and expectations
- ✅ Use MCP for visual verification
- ✅ Combine MCP with your regular tools

### DON'T:
- ❌ Try to install MCP packages
- ❌ Write scripts that call MCP commands
- ❌ Confuse MCP with real CLI tools
- ❌ Expect MCP to work outside of Claude

## 8. Quick Reference

### For PDF Verification:
```
"Use MCP to check build/dist/ebook.pdf"
```

### For Visual QA:
```
"Run visual QA on the generated PDF using your browser tools"
```

### For File Checks:
```
"Use MCP to verify all images in assets/images/ are valid"
```

### For Process Automation:
```
"Use MCP to run the build process and verify the output"
```

## Remember

MCP is Claude's superpower - it's how Claude interacts with your system beyond just chatting. You don't install it, configure it, or run it directly. You simply ask Claude to use it, and Claude handles the rest.

Think of it like this:
- You are the director 🎬
- Claude is the actor 🎭
- MCP is Claude's set of tools 🛠️

You direct Claude to use the tools, but you don't use them yourself!