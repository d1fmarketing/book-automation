# 🔧 Money Machine Debugging Checklist - IMPLEMENTED

This document describes the comprehensive debugging system that has been implemented to ensure the Money Machine pipeline never skips an agent or MCP call without notification.

## ✅ Implementation Summary

All components from the debugging checklist have been successfully implemented:

### 1. **Agent Discovery Verification** ✅
- **File**: `scripts/check-env.js`
- **Features**:
  - Verifies all 16 required agents are discoverable with `agentcli list`
  - Checks MCP server registration with `claude mcp list`
  - Command line options: `--agents` and `--mcp` for specific checks
  - Exits with error code if any agent is missing

### 2. **Smoke Test Workflow** ✅
- **File**: `.github/workflows/smoke.yml`
- **Features**:
  - 10-minute workflow that tests each agent individually
  - Runs every 6 hours and on pull requests
  - Tests core agents sequentially
  - Generates smoke report with pass/fail status
  - Uploads test artifacts for debugging

### 3. **Workflow Manifest Generation** ✅
- **File**: `scripts/automation-pipeline.js`
- **Features**:
  - Tracks all agent calls with `trackAgent()` function
  - Records MCP calls with `trackMCP()` function
  - Generates `build/logs/workflow-manifest.json` after pipeline completion
  - Includes total agent count, errors, and detailed run log
  - Verifies required agents ran and warns if any are missing

### 4. **Debug Logging Infrastructure** ✅
- **Implementation**: Throughout `automation-pipeline.js`
- **Features**:
  - Each agent call is tracked with start/end times
  - Duration calculated for performance monitoring
  - Errors captured and logged separately
  - Can enable trace logging with `DEBUG=agent:*,mcp:*,workflow:*`

### 5. **Unit Tests for Agents** ✅
- **Files**: `tests/agents/*.test.js`
- **Coverage**:
  - `fact-checker.test.js` - Grammar and hallucination detection
  - `tone-polisher.test.js` - Brand voice consistency
  - `planner.test.js` - Book outline generation
  - `writer.test.js` - Content generation
- **Configuration**: `jest.config.js` with proper test setup

### 6. **Health Endpoint** ✅
- **File**: `agents/hostinger-deploy.js`
- **Features**:
  - Creates `/health.json` and `/health.html` endpoints
  - Returns:
    - `agentsRun` count from workflow manifest
    - `lighthouse` score from deployment metadata
    - `build` environment (blue/green)
    - `deploymentId` and `timestamp`
  - Auto-refreshing HTML health page

### 7. **CI Integration** ✅
- **File**: `qa/qa-html-mcp.js`
- **Features**:
  - BrowserStack integration when `process.env.CI` is set
  - Tests on iPhone 14 and Samsung Galaxy S23
  - Falls back gracefully if credentials missing
  - Clear error messages for missing API keys

### 8. **Chaos Testing Script** ✅
- **File**: `scripts/chaos-test.sh`
- **Tests**:
  - Redis buffer clearing
  - Worker process freezing
  - API rate limit simulation
  - Disk space constraints
  - Network interruptions
  - Concurrent pipeline runs
  - Agent failure recovery

## 🚀 Usage

### Pre-deployment Checks

```bash
# Check all agents are registered
node scripts/check-env.js --agents

# Run smoke tests locally
export DEBUG=agent:*,mcp:*,workflow:*
npm run test:agents

# Run chaos tests
./scripts/chaos-test.sh
```

### During Development

```bash
# Enable debug logging
export DEBUG=agent:*,mcp:*,workflow:*

# Run pipeline with manifest generation
npm run money:dry-run

# Check workflow manifest
cat build/logs/workflow-manifest.json
```

### CI/CD Pipeline

The smoke test workflow runs automatically:
- Every 6 hours via cron
- On every pull request
- Can be triggered manually via workflow_dispatch

### Production Monitoring

```bash
# Check health endpoint
curl https://ebooks.hostinger.com/health.json

# Response:
{
  "status": "healthy",
  "build": "green",
  "agentsRun": 16,
  "lighthouse": 0.93
}
```

## 🛡️ Safety Guarantees

1. **Static Guards**
   - `check-env.js` verifies all agents at build time
   - Smoke tests validate each agent works correctly
   - Unit tests ensure agent interfaces are stable

2. **Dynamic Guards**
   - Workflow manifest proves every call was executed
   - Health endpoints show real-time status
   - Debug logs capture full execution trace

3. **Failure Recovery**
   - Chaos tests verify pipeline resilience
   - Missing agents logged but don't crash pipeline
   - Work-steal runners handle frozen workers

## 📊 Expected Output

When everything is working correctly:

```
🔍 Checking Agent Discovery...
   Found 16 registered agents

✅ plan.outline
✅ research.perplexity
✅ write.chapter
✅ style.polish
✅ qa.fact
✅ affiliate.inject
... (10 more agents)

✅ All 16 required agents found

📋 Workflow manifest: 16 agents executed
```

## 🚨 Troubleshooting

### Missing Agent
```
❌ style.polish - NOT FOUND

To fix:
1. Check agent file exports correct name
2. Re-register: agentcli register agents/tone-polisher.js
3. Verify with: agentcli list
```

### Failed Smoke Test
```
Check artifacts in GitHub Actions:
- build/smoke-test/*.log
- build/smoke-test/smoke-report.json
```

### Low Agent Count in Health Check
```
{
  "agentsRun": 12,  // Should be 16
  "lighthouse": 0.85
}

Action: Check workflow-manifest.json for missing agents
```

## 🎯 Success Criteria

✅ All 16 agents discoverable  
✅ Smoke tests pass in < 10 minutes  
✅ Workflow manifest shows all agents ran  
✅ Health endpoint returns agentsRun >= 16  
✅ Chaos tests demonstrate resilience  

The Money Machine pipeline is now fully instrumented for debugging and monitoring!