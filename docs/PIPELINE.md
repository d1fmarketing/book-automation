# 📚 Book Automation Pipeline v1.0

## Overview

The Book Automation Pipeline is a sophisticated multi-agent system that orchestrates AI-powered book writing, image generation, PDF/EPUB building, and quality assurance with MCP visual validation.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      ORCHESTRATOR (Pipeline)                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │ Writer Agent │  │ Image Agent  │  │ Build Agent  │           │
│  │   (Python)   │──│  (Ideogram)  │──│ (Puppeteer)  │           │
│  └──────────────┘  └──────────────┘  └──────────────┘           │
│         │                  │                  │                   │
│         ▼                  ▼                  ▼                   │
│    chapters/*.md     assets/*.png      build/dist/*.pdf          │
│                                              │                    │
│                                              ▼                    │
│                                    ┌──────────────────┐          │
│                                    │    QA Agent      │          │
│                                    │ (MCP Validation) │          │
│                                    └──────────────────┘          │
│                                              │                    │
│                                              ▼                    │
│                                    ┌──────────────────┐          │
│                                    │  Visual Loop     │          │
│                                    │ (max 3 retries) │          │
│                                    └──────────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

## Agents

### 1. **Writer Agent** (`src/ebook_pipeline/agents/ai_writer_agent.py`)
- **Purpose**: Generate book content using AI
- **Input**: Book configuration, outline
- **Output**: Markdown chapters in `chapters/` directory
- **Technologies**: GPT-4, Python

### 2. **Image Agent** (`src/ebook_pipeline/generators/generate_images.py`)
- **Purpose**: Generate AI images for chapters
- **Input**: Image prompts from markdown
- **Output**: PNG images in `assets/images/`
- **Technologies**: Ideogram API v3, Emotion Palette Engine

### 3. **Build Agent** (`scripts/generate-clean-pdf.js`)
- **Purpose**: Convert markdown to PDF/EPUB
- **Input**: Markdown chapters, images
- **Output**: PDF in `build/dist/`
- **Technologies**: Puppeteer, Marked.js, pdf-lib

### 4. **QA Agent** (`scripts/qa-agent.js`)
- **Purpose**: Validate PDF quality
- **Input**: Generated PDF
- **Output**: Quality report, pass/fail status
- **Technologies**: Puppeteer, Content Validator, MCP tools

### 5. **Orchestrator** (`scripts/build-pipeline.js`)
- **Purpose**: Coordinate all agents
- **Features**:
  - Sequential execution
  - Error handling
  - Retry logic (max 3)
  - State persistence
  - MCP visual loop

## MCP Visual Loop

The pipeline uses MCP (Model Context Protocol) browser tools for visual validation:

```javascript
// MCP commands used:
navigate("file:///path/to/pdf#page=1")
exists(".page[data-page-number='1'] canvas")
screenshot("page-1.png")
```

This enables:
- Direct PDF visualization
- Page-by-page validation
- Visual error detection
- Automated corrections

## Pipeline Flow

### 1. **Startup Phase**
```bash
npm run build:pipeline
```
- Check prerequisites (Node 20+, Python 3+)
- Load configuration
- Initialize agents

### 2. **Content Generation**
- Writer Agent creates chapters (if needed)
- Skip if chapters already exist

### 3. **Image Generation**
```bash
make generate-images
```
- Parse markdown for image placeholders
- Generate prompts with emotion palette
- Call Ideogram API
- Save optimized images

### 4. **Build Phase**
```bash
node scripts/generate-clean-pdf.js
```
- Convert markdown to HTML
- Apply styling (full-page, zero margins)
- Generate PDF with Puppeteer
- Optional: Generate EPUB

### 5. **QA Validation**
```bash
node scripts/qa-agent.js build/dist/ebook-clean.pdf
```
- Load PDF for inspection
- Check typography standards
- Validate spacing and layout
- Verify color contrast
- Content validation

### 6. **Visual Loop (if QA fails)**
- Retry up to 3 times
- Each retry:
  - Analyze failure reason
  - Adjust build parameters
  - Regenerate PDF
  - Re-run QA
- After 3 failures: `status: "needs-human"`

## Configuration

### Environment Variables
```bash
# .env file
IDEOGRAM_API_KEY=your_key_here
OPENAI_API_KEY=your_key_here
MCP_SERVER_PORT=3000
```

### Pipeline State
```json
{
  "status": "completed",
  "phases": {
    "writer": { "status": "completed" },
    "image": { "status": "completed" },
    "build": { "status": "completed" },
    "qa": { "status": "completed" }
  },
  "retries": 0,
  "duration": "5m 23s"
}
```

## Docker Support

### Build Image
```bash
docker build -t book-automation:v1.0 .
```

### Run Pipeline
```bash
docker run -v $(pwd)/build:/app/build book-automation:v1.0
```

### Docker Compose
```bash
docker-compose up        # Run full pipeline
docker-compose logs -f   # Watch logs
```

## Error Handling

### Common Issues

1. **Writer Agent Failures**
   - Check API keys
   - Verify outline format
   - Check network connectivity

2. **Image Generation Failures**
   - Verify Ideogram API key
   - Check prompt formatting
   - Monitor API rate limits

3. **Build Failures**
   - Ensure Puppeteer dependencies
   - Check markdown syntax
   - Verify image paths

4. **QA Failures**
   - Review typography settings
   - Check spacing configuration
   - Validate color schemes

## Extending the Pipeline

### Adding New Agents
1. Create agent in `src/ebook_pipeline/agents/`
2. Add to orchestrator initialization
3. Define phase in pipeline flow
4. Update state management

### Custom QA Criteria
Edit `QA_CRITERIA` in `scripts/qa-agent.js`:
```javascript
typography: {
  h1: { minSize: 28, maxSize: 36 },
  body: { minSize: 12, maxSize: 16 }
}
```

### Pipeline Hooks
- Pre-phase: Validation checks
- Post-phase: Cleanup, notifications
- On-failure: Error recovery
- On-success: Deployment, archival

## Monitoring

### Logs
- Pipeline state: `pipeline-state.json`
- Agent logs: Console output
- Error tracking: `pipelineState.errors[]`

### Metrics
- Phase duration
- Retry count
- Success rate
- Resource usage

## Version History

### v1.0 (2025-01-29)
- Initial stable release
- MCP visual loop integration
- Multi-agent orchestration
- Docker support
- Retry mechanism