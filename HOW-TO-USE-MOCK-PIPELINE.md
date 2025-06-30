# How to Use the Mock Pipeline Instead

Since `agentcli` and `mcp` don't exist as real tools, here's how to use the mock implementation that actually works:

## Step 1: Restore Mock Scripts

The mock scripts were already created in `scripts/mock/`. If they were deleted, recreate them:

```bash
# Recreate mock directory
mkdir -p scripts/mock

# Create mock agentcli
cat > scripts/mock/agentcli << 'EOF'
#!/bin/bash
echo "🤖 Mock Agent CLI v1.0 - Simulation Mode"
case "$2" in
    "ideogram")
        echo "🎨 Mock Ideogram - Creating placeholder cover..."
        mkdir -p assets/images
        touch assets/images/cover.jpg
        echo "✅ Mock cover.jpg created"
        ;;
    "builder")
        echo "🔨 Mock Builder - Creating placeholder PDF/EPUB..."
        mkdir -p build/dist build/tmp
        echo "Mock PDF" > build/dist/ebook.pdf
        echo "Mock EPUB" > build/dist/ebook.epub
        echo "<html><body>Mock Book</body></html>" > build/tmp/ebook.html
        echo "✅ Mock outputs created"
        ;;
    *)
        echo "✅ Mock $2 completed"
        ;;
esac
exit 0
EOF

# Create mock mcp
cat > scripts/mock/mcp << 'EOF'
#!/bin/bash
echo "🌐 Mock MCP - Simulation Mode"
case "$2" in
    "assert")
        echo "✅ Visual check passed: $3"
        ;;
    *)
        echo "✅ MCP $2 completed"
        ;;
esac
exit 0
EOF

# Make executable
chmod +x scripts/mock/agentcli scripts/mock/mcp
```

## Step 2: Add Mocks to PATH

```bash
export PATH="$PWD/scripts/mock:$PATH"

# Verify they work
which agentcli   # should show scripts/mock/agentcli
which mcp        # should show scripts/mock/mcp
```

## Step 3: Run the Mock Pipeline

```bash
# Set environment variable
export AGENT_CLI_TEXT_MODEL="claude-opus-4"

# Run the full pipeline
make pipeline
```

## What the Mock Pipeline Does

1. **Skips text generation** (chapters already exist)
2. **Creates placeholder cover.jpg** (simulates Ideogram)
3. **Generates mock PDF/EPUB files** (simulates builder)
4. **Passes all QA checks** (simulates MCP validation)
5. **Copies files to release/**

## Expected Output

```
release/
├── ebook.pdf    # Mock PDF file
└── ebook.epub   # Mock EPUB file

build/
├── dist/
│   ├── ebook.pdf
│   └── ebook.epub
└── tmp/
    └── ebook.html   # Mock HTML for QA

assets/images/
└── cover.jpg    # Empty placeholder
```

## To See the Full Workflow

```bash
# Clean everything first
rm -rf build/ release/ assets/images/* qa/*

# Run mock pipeline with verbose output
make pipeline 2>&1 | tee pipeline.log

# Check the results
ls -la release/
cat pipeline-state.json
```

## Limitations of Mock Pipeline

- ❌ No real AI-generated text
- ❌ No real AI-generated images
- ❌ No actual PDF/EPUB content
- ❌ No real visual validation

But it successfully demonstrates:
- ✅ The complete workflow
- ✅ All pipeline phases
- ✅ Error handling
- ✅ QA loop mechanics

## Why Use the Mock?

1. **Validates the architecture** without needing non-existent tools
2. **Tests the pipeline logic** and error handling
3. **Demonstrates the workflow** for documentation
4. **Provides a foundation** for building real implementations

The mock pipeline is your only option until someone builds the real `agentcli` and `mcp` tools.