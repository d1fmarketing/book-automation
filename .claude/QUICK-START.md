# 🚀 Claude Elite Quick Start Guide

## Prerequisites

1. **Add API Keys** to `.env.local`:

   ```bash
   cp .env.local .env.local.backup  # If you have existing values
   nano .env.local  # Add your real API keys
   ```

2. **Install Node Dependencies**:

   ```bash
   npm install
   cd agents && npm install && cd ..
   ```

## 🎯 Core Commands

### Todo Management

```bash
./claude /todo                     # List all todos
./claude /todo add "Task" high     # Add high priority task
./claude /todo update abc status in_progress
./claude /todo complete abc
./claude /todo stats               # Show statistics
```

### MCP Management

```bash
./claude /mcp list                 # Show MCP status
./claude /mcp install brightdata   # Install specific MCP
./claude /mcp install-all          # Install all configured MCPs
./claude /mcp test puppeteer       # Test MCP connection
```

### Agent Operations

```bash
./claude /agent ProductOptimizer --dry-run    # Test run
./claude /agent ProductOptimizer --limit 5    # Process 5 products
```

### Cache Management

```bash
./claude /cache                    # Show cache statistics
node .claude/helpers/cache.js test # Test cache performance
```

### Emergency Procedures

```bash
./claude /fix                      # Interactive fix menu
./claude /rollback last-commit     # Undo last commit
```

## 🔌 Setting Up MCPs

1. **Add Credentials** to `.env.local`:

   ```env
   BRIGHTDATA_API_KEY=your-key-here
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_KEY=your-anon-key
   UPSTASH_REDIS_URL=redis://...
   UPSTASH_REDIS_TOKEN=your-token
   ```

2. **Install MCPs**:

   ```bash
   ./claude /mcp install-all
   ```

3. **Verify Installation**:

   ```bash
   ./claude /mcp list
   ```

## 🤖 Running Your First Agent

1. **Test with Mock Data**:

   ```bash
   ./claude /agent ProductOptimizer --dry-run
   ```

2. **Connect to Real Database**:

   ```bash
   # Ensure Supabase credentials are set
   ./claude /agent ProductOptimizer --limit 10
   ```

## 📊 Monitoring Performance

1. **Check Cache Stats**:

   ```bash
   ./claude /cache
   ```

2. **View Build Metrics** (if DataDog configured):

   ```bash
   npm run build:dd
   ```

## 🆘 Troubleshooting

### MCPs Not Installing

- Check API keys in `.env.local`
- Ensure Claude CLI is installed
- Run `./claude /mcp list` to see missing credentials

### Agent Fails to Run

- Check TypeScript compilation: `cd agents && npm run build`
- Verify environment variables are loaded
- Run with `--dry-run` first

### Cache Not Working

- Redis credentials might be missing
- Falls back to in-memory cache automatically
- Check with `./claude /cache`

## 🎉 Next Steps

1. **Explore More Commands**:

   ```bash
   ./claude --help
   ```

2. **Create Custom Agents**:
   - Add to `agents/src/`
   - Register in `.claude/scripts/agent-launcher.js`

3. **Extend the System**:
   - Add new slash commands
   - Create more performance helpers
   - Build custom MCPs
