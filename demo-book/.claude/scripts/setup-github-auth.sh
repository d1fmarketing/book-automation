#!/bin/bash

# Setup GitHub authentication with token

TOKEN="${GITHUB_TOKEN:-}"  # Use environment variable

# Clear any existing GITHUB_TOKEN
unset GITHUB_TOKEN

# Configure git to use the token
git config --global credential.helper store
echo "https://d1fmarketing:${TOKEN}@github.com" > ~/.git-credentials

# Set git protocol to https
git config --global protocol.version 2
git config --global http.postBuffer 524288000

# Export token
export GITHUB_TOKEN="$TOKEN"

# Configure gh cli
echo "$TOKEN" | gh auth login --with-token --hostname github.com --git-protocol https

echo "GitHub authentication configured!"
gh auth status