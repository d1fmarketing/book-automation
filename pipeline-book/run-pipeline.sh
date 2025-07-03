#!/bin/bash
# Run the complete pipeline with all agents connected

echo "🚀 Starting Complete Pipeline with All 5 Agents..."
echo "=================================================="

# Check if we're in the right directory
if [ ! -f "metadata.yaml" ]; then
    echo "❌ Error: metadata.yaml not found. Please run from the book project directory."
    exit 1
fi

# Activate virtual environment if it exists
if [ -d "../venv" ]; then
    source ../venv/bin/activate
fi

# Run the complete pipeline
cd .. && python -m ebook_pipeline.run_complete_pipeline pipeline-book "$@"

# Check exit code
if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Pipeline completed successfully!"
    echo ""
    echo "📄 Output files:"
    echo "  - pipeline-book/build/dist/ebook.pdf (standard PDF)"
    echo "  - pipeline-book/build/dist/ebook-clean.pdf (Adobe-compatible)"
    echo "  - pipeline-book/build/qa/visual-verification/report.html (Visual QA report)"
    echo "  - pipeline-book/build/pipeline-complete-report.json (Detailed report)"
else
    echo ""
    echo "❌ Pipeline failed. Check logs for details."
    exit 1
fi