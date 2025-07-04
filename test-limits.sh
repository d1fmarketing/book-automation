#!/bin/bash

# Test Rate Limiting and Cost Tracking
echo "🧪 Testing Rate Limiting and Cost Tracking"
echo "=========================================="

# Load environment variables
source .env

# Test 1: Check status
echo -e "\n1️⃣ Checking current status..."
node agents/writer-with-limits.js --status

# Test 2: Generate a small chapter
echo -e "\n2️⃣ Testing chapter generation with limits..."
node agents/writer-with-limits.js --outline test/outline.json --chapter 1 --output test/limited-output

# Test 3: Test orchestrator with limits
echo -e "\n3️⃣ Testing orchestrator with limits (3 chapters)..."
BOOK_BUDGET=1.00 node scripts/orchestrator-with-limits.js "Test Book" --chapters 3 --workdir test/orchestrator-limited

# Test 4: Show final costs
echo -e "\n4️⃣ Final cost report..."
node agents/writer-with-limits.js --status

echo -e "\n✅ Tests complete!"