#!/bin/bash

set -euo pipefail

echo "Starting script..."

# Function that returns
test_func() {
    echo "In function"
    return
}

echo "Before function call"
test_func
echo "After function call"

echo "Script finished"