# 🔥 Engenheiro Bravo Pipeline

> Zero-tolerance, fool-proof ebook generation system

## Overview

The "Engenheiro Bravo" (Angry Engineer) pipeline is a strict, unforgiving automation system that ensures 100% quality in ebook generation. It will NOT let you skip steps, ignore errors, or produce substandard content.

## Key Features

### 1. **Mandatory Manifest Tracking**
Every agent execution is tracked in `build/run-manifest.json`:
```json
{
  "topic": "How to Make Money with AI",
  "steps": ["plan.outline", "research.perplexity", ...],
  "qa": { "lighthouse": 0.93, "devicesPass": 22 },
  "final": true
}
```

### 2. **FSM Orchestrator**
Finite State Machine ensures strict execution order:
- PLAN → RESEARCH → WRITE → POLISH → ILLUSTRATE → FORMAT → QA_FACT → AFFILIATE → QA_HTML → DONE
- Max 10 retries per state with exponential backoff
- Cannot skip or reorder steps

### 3. **Watchdog Service**
- Monitors pipeline every 30 seconds
- Kills & restarts if stuck > 15 minutes
- Tracks orchestrator PID
- Logs all activity

### 4. **CI/CD Gates**
- Manifest validation workflow
- Blocks deployment without complete manifest
- Requires Lighthouse score ≥ 90
- Zero PDF tolerance

## Quick Start

### Method 1: Easy Script
```bash
./start-bravo-pipeline.sh "Your Ebook Topic"
```

### Method 2: Direct Commands
```bash
# Start with orchestrator
EBOOK_TOPIC="Your Topic" node scripts/orchestrator.js

# With watchdog
EBOOK_TOPIC="Your Topic" node agents/watchdog.js
```

### Method 3: Make Commands
```bash
# Quick start
make bravo

# With PM2 (production)
make bravo-pm2

# Check status
make manifest
```

### Method 4: NPM Scripts
```bash
# Direct orchestrator
npm run money:bravo -- "Your Topic"

# With watchdog
npm run money:bravo:watch -- "Your Topic"

# Legacy mode with --bravo flag
npm run money:generate -- --bravo
```

## Architecture

```
┌─────────────────┐
│   Watchdog      │ ← Monitors every 30s
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Orchestrator   │ ← FSM state machine
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│     Agents      │ ← Required agents
├─────────────────┤
│ • plan.outline  │
│ • research      │
│ • write         │
│ • polish        │
│ • illustrate    │
│ • format        │
│ • qa.fact       │
│ • affiliate     │
│ • qa.html       │
└─────────────────┘
         │
         ▼
┌─────────────────┐
│    Manifest     │ ← Validation record
└─────────────────┘
```

## Required Agents

All agents MUST run and succeed:

1. **plan.outline** - Creates book structure
2. **research.perplexity** - Deep topic research
3. **write.chapter** - Content generation
4. **style.polish** - Brand voice consistency
5. **img.illustrate** - Ideogram images (verified!)
6. **format.html** - HTML ebook generation
7. **qa.fact** - Fact checking
8. **aff.inject** - Affiliate monetization
9. **qa.html** - Quality assurance (90+ score)

## Manifest Validation

The manifest is validated at multiple points:

### Local Validation
- Orchestrator saves after each step
- Watchdog monitors timestamp
- Final flag only when complete

### CI/CD Validation
```yaml
# .github/workflows/manifest-gate.yml
- Checks all 9 steps present
- Verifies lighthouse ≥ 0.9
- Ensures final: true
- Blocks PDF generation
```

## Error Handling

### Retry Logic
- Each state gets 10 attempts
- Exponential backoff (1s, 2s, 4s...)
- Max wait: 30 seconds
- Errors logged to manifest

### Watchdog Recovery
- Detects stuck pipelines (> 15 min)
- Kills orchestrator process
- Restarts from last completed state
- Max 5 total restarts

## Monitoring

### Real-time Logs
```bash
# Watch orchestrator
tail -f build/logs/orchestrator-out.log

# Watch watchdog
tail -f build/logs/watchdog.log

# Check manifest
cat build/run-manifest.json | jq .
```

### PM2 Monitoring
```bash
# Start with PM2
node agents/watchdog.js pm2-config
pm2 start ecosystem.config.js

# Monitor
pm2 monit
pm2 logs
```

## Quality Gates

### HTML Requirements
- Lighthouse Performance: 90+
- Lighthouse Accessibility: 90+
- Lighthouse Best Practices: 90+
- Lighthouse SEO: 90+
- All interactive features present
- Affiliate links compliant

### Content Requirements
- All chapters written
- Images generated for each chapter
- Fact checking passed
- Grammar validated
- Affiliate links injected

## Troubleshooting

### Pipeline Stuck
```bash
# Check manifest age
cat build/run-manifest.json | jq '.timestamp'

# Kill everything
pkill -f orchestrator
pkill -f watchdog

# Clean and restart
make clean
make bravo
```

### Missing Agents
```bash
# Verify agent files exist
ls -la agents/
ls -la scripts/

# Check imports in orchestrator.js
```

### QA Failures
```bash
# Run QA manually
npm run qa:html build/ebooks/*/html/index.html

# Check scores
cat build/run-manifest.json | jq '.qa'
```

## Production Deployment

### 1. Environment Setup
```bash
# .env
ENGENHEIRO_BRAVO=true
GENERATE_PDF=false
USE_ORCHESTRATOR=true
```

### 2. PM2 Setup
```bash
# Generate config
node agents/watchdog.js pm2-config

# Start services
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 3. CI/CD Integration
- Push to main branch
- Manifest gate validates
- Deployment only if passed

## Key Differences from Legacy Pipeline

| Feature | Legacy | Engenheiro Bravo |
|---------|---------|------------------|
| Error handling | Continue on error | Stop & retry |
| Step validation | Optional | Mandatory |
| Quality checks | Best effort | 90+ required |
| PDF generation | Included | REMOVED |
| Manifest | Optional | Required |
| Monitoring | Manual | Automated |

## Philosophy

This pipeline embodies the "angry engineer" who:
- 🚫 Won't accept "good enough"
- 🔁 Forces retries until perfect
- 📋 Documents everything
- 🎯 Hits quality targets
- ⏰ Never gives up (within limits)

## Emergency Kill Switch

If everything goes wrong:
```bash
# Nuclear option
pkill -9 -f node
rm -rf build/
make clean
```

---

Remember: The pipeline is angry so you don't have to be. Let it enforce quality while you focus on creativity.