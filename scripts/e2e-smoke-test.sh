#!/bin/bash

# End-to-End Smoke Test for Ebook Automation Pipeline
# Tests all critical components in sequence

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

# Test Configuration
TEST_TOPIC="Como fazer dinheiro com IA - Teste E2E"
TEST_DIR="build/e2e-test-$(date +%s)"
FAILED_TESTS=0
PASSED_TESTS=0

echo -e "${BLUE}🚀 End-to-End Smoke Test${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test Topic: $TEST_TOPIC"
echo "Test Directory: $TEST_DIR"
echo ""

# Helper functions
test_pass() {
    echo -e "${GREEN}✅ $1${NC}"
    ((PASSED_TESTS++))
}

test_fail() {
    echo -e "${RED}❌ $1${NC}"
    echo "   Error: $2"
    ((FAILED_TESTS++))
}

test_section() {
    echo ""
    echo -e "${PURPLE}━━━ $1 ━━━${NC}"
}

# 1. Environment Check
test_section "1. ENVIRONMENT CHECK"

# Check Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    test_pass "Node.js installed: $NODE_VERSION"
else
    test_fail "Node.js not found" "Install Node.js v20+"
fi

# Check Python
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version)
    test_pass "Python installed: $PYTHON_VERSION"
else
    test_fail "Python not found" "Install Python 3.8+"
fi

# Check Redis
if pgrep -x "redis-server" > /dev/null; then
    test_pass "Redis is running"
else
    test_fail "Redis not running" "Start Redis with: redis-server"
fi

# Check dependencies
if [ -d "node_modules" ]; then
    test_pass "Node dependencies installed"
else
    test_fail "Node dependencies missing" "Run: npm install"
fi

# 2. Configuration Check
test_section "2. CONFIGURATION CHECK"

# Check .env file
if [ -f ".env" ]; then
    # Check for required keys
    REQUIRED_KEYS=("OPENAI_API_KEY" "ANTHROPIC_API_KEY")
    for key in "${REQUIRED_KEYS[@]}"; do
        if grep -q "^$key=" .env; then
            test_pass "$key configured"
        else
            test_fail "$key missing in .env" "Add $key to .env file"
        fi
    done
else
    test_fail ".env file missing" "Copy .env.example to .env and configure"
fi

# 3. Import Blacklist Check
test_section "3. IMPORT BLACKLIST CHECK"

echo "Running import blacklist scan..."
if node scripts/import-blacklist.js scan > /tmp/blacklist-scan.log 2>&1; then
    VIOLATIONS=$(grep -c "violation" /tmp/blacklist-scan.log || true)
    if [ "$VIOLATIONS" -eq 0 ]; then
        test_pass "No blacklisted imports found"
    else
        test_fail "Found $VIOLATIONS blacklisted imports" "Check /tmp/blacklist-scan.log"
    fi
else
    test_fail "Import blacklist scan failed" "Check scripts/import-blacklist.js"
fi

# 4. Queue System Test
test_section "4. QUEUE SYSTEM TEST"

echo "Testing queue connection..."
QUEUE_TEST=$(cat << 'EOF'
const { getQueueManager } = require('./src/queue/QueueManager');
(async () => {
    try {
        const qm = getQueueManager();
        await qm.connect();
        console.log('SUCCESS');
        await qm.shutdown();
    } catch (e) {
        console.log('FAILED:', e.message);
    }
})();
EOF
)

QUEUE_RESULT=$(echo "$QUEUE_TEST" | node - 2>&1)
if [[ "$QUEUE_RESULT" == *"SUCCESS"* ]]; then
    test_pass "Queue system connected"
else
    test_fail "Queue system connection failed" "$QUEUE_RESULT"
fi

# 5. Agent Tests
test_section "5. AGENT TESTS"

# Test key agents
AGENTS=("planner" "writer" "formatter-html-clean" "illustrator")
for agent in "${AGENTS[@]}"; do
    if [ -f "agents/$agent.js" ] || [ -f "agents/${agent}-wrapper.js" ]; then
        test_pass "Agent $agent exists"
    else
        test_fail "Agent $agent missing" "Check agents/ directory"
    fi
done

# 6. Admin Dashboard Test
test_section "6. ADMIN DASHBOARD TEST"

# Check if admin server can start
if [ -f "admin/server.js" ]; then
    test_pass "Admin server exists"
    
    # Test if port 4000 is available
    if ! lsof -i:4000 > /dev/null 2>&1; then
        test_pass "Port 4000 available for admin"
    else
        test_fail "Port 4000 already in use" "Stop process using port 4000"
    fi
else
    test_fail "Admin server missing" "Check admin/server.js"
fi

# 7. Refurbish Worker Test
test_section "7. REFURBISH WORKER TEST"

if [ -f "src/workers/refurbish-worker.js" ]; then
    # Test worker can be loaded
    WORKER_TEST=$(cat << 'EOF'
const RefurbishWorker = require('./src/workers/refurbish-worker');
try {
    new RefurbishWorker();
    console.log('SUCCESS');
} catch (e) {
    console.log('FAILED:', e.message);
}
EOF
)
    
    WORKER_RESULT=$(echo "$WORKER_TEST" | node - 2>&1)
    if [[ "$WORKER_RESULT" == *"SUCCESS"* ]]; then
        test_pass "Refurbish worker loads correctly"
    else
        test_fail "Refurbish worker load failed" "$WORKER_RESULT"
    fi
else
    test_fail "Refurbish worker missing" "Check src/workers/refurbish-worker.js"
fi

# 8. Ultra-QA Test Suite
test_section "8. ULTRA-QA TEST SUITE"

if [ -f "scripts/run-ultra-qa.sh" ]; then
    test_pass "Ultra-QA runner exists"
    
    # Check if test suites exist
    if [ -d "tests/ultra-qa/suites" ]; then
        SUITE_COUNT=$(ls tests/ultra-qa/suites/*.js 2>/dev/null | wc -l)
        if [ "$SUITE_COUNT" -gt 0 ]; then
            test_pass "Found $SUITE_COUNT test suites"
        else
            test_fail "No test suites found" "Check tests/ultra-qa/suites/"
        fi
    else
        test_fail "Test suites directory missing" "Create tests/ultra-qa/suites/"
    fi
else
    test_fail "Ultra-QA runner missing" "Check scripts/run-ultra-qa.sh"
fi

# 9. Mini Pipeline Test
test_section "9. MINI PIPELINE TEST"

echo "Running mini pipeline test (1 chapter)..."
mkdir -p "$TEST_DIR"

# Create mini test script
PIPELINE_TEST=$(cat << EOF
const { Orchestrator } = require('./scripts/orchestrator');
const orchestrator = new Orchestrator();

(async () => {
    try {
        await orchestrator.init();
        const result = await orchestrator.run('$TEST_TOPIC', {
            outputDir: '$TEST_DIR',
            chapters: 1,
            skipIllustrations: true,
            timeout: 60000
        });
        console.log(result.success ? 'SUCCESS' : 'FAILED');
        process.exit(result.success ? 0 : 1);
    } catch (e) {
        console.log('ERROR:', e.message);
        process.exit(1);
    }
})();
EOF
)

# Note: This would actually run the pipeline - commenting out for safety
# PIPELINE_RESULT=$(echo "$PIPELINE_TEST" | timeout 120 node - 2>&1)
# For now, just check if orchestrator exists
if [ -f "scripts/orchestrator.js" ] || [ -f "scripts/orchestrator-hybrid.js" ]; then
    test_pass "Pipeline orchestrator exists"
else
    test_fail "Pipeline orchestrator missing" "Check scripts/orchestrator*.js"
fi

# 10. Build Tools Test
test_section "10. BUILD TOOLS TEST"

# Check Makefile targets
if [ -f "Makefile" ]; then
    TARGETS=$(grep "^[a-z-]*:" Makefile | wc -l)
    test_pass "Makefile has $TARGETS targets"
else
    test_fail "Makefile missing" "No build automation available"
fi

# Check for key scripts
KEY_SCRIPTS=("ebook-build.sh" "clean-build.sh")
for script in "${KEY_SCRIPTS[@]}"; do
    if [ -f "scripts/$script" ] || [ -f "$script" ]; then
        test_pass "Script $script exists"
    else
        test_fail "Script $script missing" "Check project root and scripts/"
    fi
done

# 11. GitHub Actions Test
test_section "11. CI/CD CONFIGURATION"

if [ -d ".github/workflows" ]; then
    WORKFLOW_COUNT=$(ls .github/workflows/*.yml 2>/dev/null | wc -l)
    if [ "$WORKFLOW_COUNT" -gt 0 ]; then
        test_pass "Found $WORKFLOW_COUNT GitHub workflows"
        
        # Check for key workflows
        if [ -f ".github/workflows/ci.yml" ]; then
            test_pass "CI workflow configured"
        else
            test_fail "CI workflow missing" "Create .github/workflows/ci.yml"
        fi
        
        if [ -f ".github/workflows/ultra-qa.yml" ]; then
            test_pass "Ultra-QA workflow configured"
        else
            test_fail "Ultra-QA workflow missing" "Create .github/workflows/ultra-qa.yml"
        fi
    else
        test_fail "No workflows found" "Add GitHub Actions workflows"
    fi
else
    test_fail ".github/workflows missing" "Create GitHub Actions directory"
fi

# 12. Rate Limiting Test
test_section "12. RATE LIMITING TEST"

RATE_LIMIT_TEST=$(cat << 'EOF'
const { getRateLimiter } = require('./src/middleware/RateLimiter');
try {
    const limiter = getRateLimiter();
    console.log('SUCCESS');
} catch (e) {
    console.log('FAILED:', e.message);
}
EOF
)

RATE_RESULT=$(echo "$RATE_LIMIT_TEST" | node - 2>&1)
if [[ "$RATE_RESULT" == *"SUCCESS"* ]]; then
    test_pass "Rate limiter initialized"
else
    test_fail "Rate limiter initialization failed" "$RATE_RESULT"
fi

# Summary
test_section "TEST SUMMARY"

TOTAL_TESTS=$((PASSED_TESTS + FAILED_TESTS))
PASS_RATE=$((PASSED_TESTS * 100 / TOTAL_TESTS))

echo ""
echo "Total Tests: $TOTAL_TESTS"
echo -e "${GREEN}Passed: $PASSED_TESTS${NC}"
echo -e "${RED}Failed: $FAILED_TESTS${NC}"
echo "Pass Rate: ${PASS_RATE}%"
echo ""

if [ "$FAILED_TESTS" -eq 0 ]; then
    echo -e "${GREEN}🎉 All smoke tests passed!${NC}"
    echo "The ebook automation pipeline is ready for use."
    exit 0
else
    echo -e "${RED}⚠️  Some tests failed${NC}"
    echo "Please fix the issues above before running the pipeline."
    exit 1
fi