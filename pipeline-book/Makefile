# Makefile for eBook Pipeline
# Run the complete 5-agent pipeline system

.PHONY: all clean pipeline pdf epub test help

# Default target
all: pipeline

# Run the complete pipeline with all 5 agents
pipeline:
	@echo "🚀 Running Complete Pipeline with All 5 Agents..."
	@cd .. && python -m ebook_pipeline.run_complete_pipeline pipeline-book

# Run MCP-integrated PDF generator with visual QA
pdf-mcp:
	@echo "📄 Generating PDF with MCP Visual QA..."
	@node scripts/generation/pdf-generator-with-mcp.js

# Generate Premium PDF with all visual features + MCP
pdf-premium:
	@echo "🎨 Generating Premium PDF with MCP Visual QA..."
	@node scripts/generation/generate-premium-mcp-pdf.js

# Start WebSocket server with dashboard
websocket:
	@echo "🌐 Starting WebSocket Server..."
	@./scripts/start-websocket-server.sh &
	@echo "Dashboard will be available at: file://$$(pwd)/dashboard.html"

# Generate clean PDF only (no gradients, Adobe-compatible)
pdf-clean:
	@echo "📄 Generating Clean PDF..."
	@node scripts/generation/generate-clean-pdf.js

# Run visual QA check
qa:
	@echo "📸 Running Visual QA Check..."
	@node scripts/quality/visual-qa-check.js build/dist/ebook-clean.pdf

# Clean build artifacts
clean:
	@echo "🧹 Cleaning build artifacts..."
	@rm -rf build/dist build/temp build/qa
	@rm -f pipeline.log

# Test the pipeline without publishing
test:
	@echo "🧪 Testing Pipeline..."
	@cd .. && python -m ebook_pipeline.run_complete_pipeline pipeline-book --platforms local

# Install dependencies
install:
	@echo "📦 Installing dependencies..."
	@npm install
	@cd .. && pip install -r requirements.txt

# Help
help:
	@echo "eBook Pipeline - Available Commands:"
	@echo ""
	@echo "  make pipeline   - Run complete pipeline with all 5 agents"
	@echo "  make pdf-clean  - Generate clean PDF (no gradients)"
	@echo "  make qa         - Run visual QA check"
	@echo "  make test       - Test pipeline without publishing"
	@echo "  make clean      - Clean build artifacts"
	@echo "  make install    - Install dependencies"
	@echo "  make help       - Show this help message"
	@echo ""
	@echo "Options:"
	@echo "  make pipeline ARGS='--no-websocket'  - Run without WebSocket"
	@echo "  make pipeline ARGS='--skip-images'   - Skip AI image generation"