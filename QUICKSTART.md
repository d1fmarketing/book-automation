# 🚀 Quick Start Guide - Ebook Automation Pipeline

## 📋 Prerequisites

- Node.js 20+
- Redis
- API Keys (Anthropic or Google Gemini)

## 🔑 Setup API Keys

1. Copy your API keys to `.env`:
```bash
# For Anthropic Claude
ANTHROPIC_API_KEY=your_key_here

# For Google Gemini
GEMINI_API_KEY=your_key_here
```

## 🎯 One-Command Start

```bash
./start-pipeline.sh
```

This will:
- ✅ Load API keys from .env
- ✅ Start Redis (if not running)
- ✅ Start Workers
- ✅ Start Admin Dashboard
- ✅ Open http://localhost:3001

## 📚 Create Your First Book

### Option 1: Via Admin Dashboard (Recommended)

1. Open http://localhost:3001
2. Click "New Pipeline"
3. Enter your book topic
4. Configure chapters and style
5. Click "Start Pipeline"
6. Watch real-time progress!

### Option 2: Via Command Line

```bash
# Basic example
node scripts/orchestrator-hybrid.js "Your Book Topic" --chapters 10

# With options
node scripts/orchestrator-hybrid.js "AI Business Guide" \
  --chapters 15 \
  --style professional \
  --workdir build/my-book
```

## 🔧 Manual Control

### Start Services Individually

```bash
# 1. Start Redis
redis-server

# 2. Start Workers (choose one)
node scripts/start-workers-simple.js    # Uses Anthropic
node scripts/start-workers-gemini.js    # Uses Gemini

# 3. Start Admin
cd admin && npm start
```

### Monitor Logs

```bash
# Workers log
tail -f logs/workers.log

# Admin log
tail -f logs/admin.log

# Redis monitor
redis-cli monitor
```

## 🛑 Stop Everything

```bash
./stop-pipeline.sh
```

## 📊 Pipeline Status

Check pipeline status at any time:
- KPIs: http://localhost:3001 (left column)
- Terminal: Real-time logs (center column)
- Preview: HTML output (right column)

## 🚨 Troubleshooting

### API Key Issues
```bash
# Verify keys are loaded
env | grep API_KEY

# Test writer directly
export ANTHROPIC_API_KEY=your_key
node agents/writer-wrapper.js --outline test/outline.json --chapter 1
```

### Redis Connection
```bash
# Check Redis
redis-cli ping

# Start Redis manually
redis-server --daemonize yes
```

### Worker Issues
```bash
# Check if workers are running
ps aux | grep start-workers

# View worker logs
tail -100 logs/workers.log
```

## 📈 Performance Tips

1. **Use Real Planner**: For better outlines
   ```bash
   export USE_REAL_AGENTS=true
   ```

2. **Adjust Chapters**: Start small
   ```bash
   --chapters 5  # Test with 5 chapters first
   ```

3. **Monitor Costs**: Check API usage
   - Anthropic: ~$0.01-0.02 per chapter
   - Gemini: Check Google AI Studio

## 🎨 Customization

### Writing Styles
- `conversational` - Friendly, accessible
- `professional` - Business-focused
- `academic` - Scholarly tone
- `storytelling` - Narrative style

### Output Formats
- HTML - Always generated
- PDF - Coming soon
- EPUB - Coming soon

## 📝 Example Topics That Work Well

- "The Complete Guide to [Technology]"
- "Building [Business Type] from Scratch"
- "[Industry] Transformation with AI"
- "Mastering [Skill] in 30 Days"
- "The Future of [Topic]"

## 🔗 Next Steps

1. Read [Admin Dashboard Guide](admin/HOW-TO-USE.md)
2. Check [API Setup](docs/api-setup.md)
3. Join our Discord: [link]
4. Report issues: [GitHub Issues]

---

**Happy Writing! 🚀📚**