#!/bin/bash

# Chaos Testing Script for Money Machine Pipeline
# Tests pipeline resilience by introducing controlled failures

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REDIS_CLI=${REDIS_CLI:-redis-cli}
LOG_FILE="build/logs/chaos-test-$(date +%Y%m%d-%H%M%S).log"

echo -e "${BLUE}🌪️  Money Machine Chaos Testing${NC}"
echo -e "${BLUE}================================${NC}"
echo "Testing pipeline resilience with controlled failures"
echo "Log file: $LOG_FILE"
echo ""

# Create log directory
mkdir -p build/logs

# Function to log with timestamp
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Function to run test and capture result
run_test() {
    local test_name=$1
    local test_command=$2
    
    echo -e "\n${YELLOW}🧪 Test: $test_name${NC}"
    log "Starting test: $test_name"
    
    if eval "$test_command" >> "$LOG_FILE" 2>&1; then
        echo -e "${GREEN}✅ PASSED${NC}"
        log "Test passed: $test_name"
        return 0
    else
        echo -e "${RED}❌ FAILED${NC}"
        log "Test failed: $test_name"
        return 1
    fi
}

# Test 1: Redis Buffer Chaos
test_redis_chaos() {
    log "Clearing Redis topic buffer to force duplicate processing"
    
    # Clear the topic buffer
    $REDIS_CLI DEL "ebook:topics:processed" >> "$LOG_FILE" 2>&1 || true
    
    # Run pipeline twice with same topic
    log "Running pipeline with cleared buffer..."
    
    # First run
    npm run money:dry-run >> "$LOG_FILE" 2>&1 || return 1
    
    # Second run - should find different topic
    sleep 2
    npm run money:dry-run >> "$LOG_FILE" 2>&1 || return 1
    
    # Check if different topics were selected
    grep -q "No new topics found" "$LOG_FILE" && return 1
    
    return 0
}

# Test 2: Worker Freeze Simulation
test_worker_freeze() {
    log "Simulating frozen worker process"
    
    # Start pipeline in background
    npm run money:dry-run &
    PIPELINE_PID=$!
    
    # Wait for it to start processing
    sleep 5
    
    # Freeze the process
    log "Freezing process $PIPELINE_PID"
    kill -STOP $PIPELINE_PID
    
    # Keep it frozen for 10 seconds
    sleep 10
    
    # Unfreeze
    log "Unfreezing process $PIPELINE_PID"
    kill -CONT $PIPELINE_PID
    
    # Wait for completion
    wait $PIPELINE_PID
    local result=$?
    
    # Check if pipeline recovered
    [ $result -eq 0 ] && return 0 || return 1
}

# Test 3: API Rate Limit Simulation
test_rate_limit_recovery() {
    log "Simulating API rate limit scenario"
    
    # Set artificially low rate limit
    export OPENAI_RATE_LIMIT_TEST=1
    
    # Run pipeline - should handle rate limits gracefully
    npm run money:dry-run >> "$LOG_FILE" 2>&1
    local result=$?
    
    unset OPENAI_RATE_LIMIT_TEST
    
    # Check for rate limit handling
    grep -q "Rate limit" "$LOG_FILE" && grep -q "Retrying" "$LOG_FILE"
    return $?
}

# Test 4: Disk Space Simulation
test_disk_space() {
    log "Simulating low disk space"
    
    # Create a large file to consume space (100MB)
    dd if=/dev/zero of=build/chaos-test-large.tmp bs=1M count=100 >> "$LOG_FILE" 2>&1
    
    # Run pipeline
    npm run money:dry-run >> "$LOG_FILE" 2>&1
    local result=$?
    
    # Cleanup
    rm -f build/chaos-test-large.tmp
    
    return $result
}

# Test 5: Network Interruption
test_network_chaos() {
    log "Simulating network interruptions"
    
    # This would require root access to actually interrupt network
    # For now, we'll test with invalid API endpoints
    
    # Save original env
    OLD_PERPLEXITY_API_KEY=$PERPLEXITY_API_KEY
    
    # Set invalid endpoint
    export PERPLEXITY_API_KEY="invalid-key-test"
    
    # Run pipeline - should handle API failures
    npm run money:dry-run >> "$LOG_FILE" 2>&1 || true
    
    # Restore
    export PERPLEXITY_API_KEY=$OLD_PERPLEXITY_API_KEY
    
    # Check if it handled the failure gracefully
    grep -q "research failed, continuing" "$LOG_FILE"
    return $?
}

# Test 6: Concurrent Pipeline Runs
test_concurrent_runs() {
    log "Testing concurrent pipeline executions"
    
    # Start 3 pipelines simultaneously
    npm run money:dry-run &
    PID1=$!
    
    npm run money:dry-run &
    PID2=$!
    
    npm run money:dry-run &
    PID3=$!
    
    # Wait for all to complete
    wait $PID1
    RESULT1=$?
    
    wait $PID2
    RESULT2=$?
    
    wait $PID3
    RESULT3=$?
    
    # At least 2 should succeed
    local success_count=0
    [ $RESULT1 -eq 0 ] && ((success_count++))
    [ $RESULT2 -eq 0 ] && ((success_count++))
    [ $RESULT3 -eq 0 ] && ((success_count++))
    
    [ $success_count -ge 2 ] && return 0 || return 1
}

# Test 7: Agent Failure Recovery
test_agent_failure() {
    log "Testing agent failure recovery"
    
    # Create a temporary broken agent
    mkdir -p agents/test-broken
    cat > agents/test-broken/broken.js << 'EOF'
#!/usr/bin/env node
throw new Error("Simulated agent failure");
EOF
    chmod +x agents/test-broken/broken.js
    
    # Run pipeline - should continue despite agent failure
    npm run money:dry-run >> "$LOG_FILE" 2>&1
    local result=$?
    
    # Cleanup
    rm -rf agents/test-broken
    
    # Check if pipeline continued
    grep -q "continuing" "$LOG_FILE"
    return $?
}

# Main execution
main() {
    local total_tests=0
    local passed_tests=0
    local failed_tests=0
    
    echo -e "\n${BLUE}Starting chaos tests...${NC}\n"
    
    # Run all tests
    tests=(
        "test_redis_chaos:Redis Buffer Chaos"
        "test_worker_freeze:Worker Freeze Recovery"
        "test_rate_limit_recovery:API Rate Limit Handling"
        "test_disk_space:Disk Space Constraints"
        "test_network_chaos:Network Interruption"
        "test_concurrent_runs:Concurrent Execution"
        "test_agent_failure:Agent Failure Recovery"
    )
    
    for test_spec in "${tests[@]}"; do
        IFS=':' read -r test_func test_name <<< "$test_spec"
        ((total_tests++))
        
        if run_test "$test_name" "$test_func"; then
            ((passed_tests++))
        else
            ((failed_tests++))
        fi
    done
    
    # Summary
    echo -e "\n${BLUE}===========================================${NC}"
    echo -e "${BLUE}Chaos Test Summary${NC}"
    echo -e "${BLUE}===========================================${NC}"
    echo -e "Total Tests: $total_tests"
    echo -e "${GREEN}Passed: $passed_tests${NC}"
    echo -e "${RED}Failed: $failed_tests${NC}"
    echo -e "\nLog file: $LOG_FILE"
    
    # Overall result
    if [ $failed_tests -eq 0 ]; then
        echo -e "\n${GREEN}🎉 All chaos tests passed! Pipeline is resilient.${NC}"
        exit 0
    else
        echo -e "\n${RED}⚠️  Some chaos tests failed. Review logs for details.${NC}"
        exit 1
    fi
}

# Run if not sourced
if [ "${BASH_SOURCE[0]}" == "${0}" ]; then
    main "$@"
fi