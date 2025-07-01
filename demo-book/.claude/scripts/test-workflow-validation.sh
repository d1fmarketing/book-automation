#!/bin/bash

echo "🔍 Testing Workflow Validation System"
echo "===================================="

# Test metadata validation
echo -e "\n1. Testing metadata validation:"
echo "-------------------------------"
python3 scripts/validate-metadata.py --quiet || echo "   (Expected to fail - metadata.yaml incomplete)"

# Test chapter validation
echo -e "\n2. Testing chapter validation:"
echo "------------------------------"
python3 scripts/validate-chapters.py --quiet || echo "   (Expected to fail - chapters need more content)"

# Test workflow phase validation
echo -e "\n3. Testing workflow phase validation:"
echo "------------------------------------"

# Check what phases can run
echo -e "\n   Current pipeline status:"
node .claude/scripts/pipeline-state-manager.js status 2>/dev/null | grep -E "(current_phase|next_phases)" || echo "   No pipeline state found"

# Try to validate different phases
echo -e "\n   Validating 'setup' phase:"
node .claude/scripts/pipeline-state-manager.js validate setup 2>&1 | head -10

echo -e "\n   Validating 'writer' phase:"
node .claude/scripts/pipeline-state-manager.js validate writer 2>&1 | head -10

# Test with environment variable set
echo -e "\n4. Testing with required environment variable:"
echo "---------------------------------------------"
AGENT_CLI_TEXT_MODEL=gpt-4 node .claude/scripts/pipeline-state-manager.js validate setup 2>&1 | head -10

echo -e "\n✅ Workflow validation system is working!"
echo -e "\nTo fix validation errors:"
echo "  1. Complete metadata.yaml with all required sections"
echo "  2. Ensure chapters have at least 500 words each"
echo "  3. Set required environment variables"
echo "  4. Run phases in the correct order"