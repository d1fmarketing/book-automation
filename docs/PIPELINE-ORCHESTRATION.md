# 🎭 Pipeline Orchestration Guide

## Overview

The Book Automation Pipeline v2.0 integrates all agents and tools into a unified system that ensures nothing is forgotten or disconnected. This guide explains how the orchestration works and how to use all available components.

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Pipeline Orchestrator                       │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │   Agent     │  │    Tool      │  │   Pipeline       │   │
│  │  Registry   │  │  Registry    │  │  Configuration   │   │
│  └─────────────┘  └──────────────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                               │
        ┌──────────────────────┴──────────────────────┐
        │                                              │
┌───────▼────────┐                           ┌────────▼────────┐
│  Python Agents │                           │ JavaScript Tools│
├────────────────┤                           ├─────────────────┤
│ • Orchestrator │                           │ • PDF Generator │
│ • Planner      │                           │ • EPUB Builder  │
│ • Writer       │                           │ • QA Agent      │
│ • Research     │                           │ • Visual Server │
│ • Image Gen    │                           │ • MCP Tools     │
│ • Emotion      │                           │                 │
│ • Landing Page │                           │                 │
│ • OmniCreator  │                           │                 │
└────────────────┘                           └─────────────────┘
```

## 🚀 Pipeline Modes

### Quick Mode ⚡
Minimal pipeline for fast book generation:
```bash
make pipeline-quick
```
- Plan book structure
- Write all chapters
- Generate basic PDF

### Standard Mode 🎯 (Default)
Full-featured pipeline with quality checks:
```bash
make pipeline-standard
```
- Plan & research
- Write chapters with context
- Analyze continuity
- Generate images with emotion analysis
- Build professional PDF/EPUB
- Run QA validation with retries

### Premium Mode 💎
Everything plus marketing materials:
```bash
make pipeline-premium
```
- All standard features
- Generate landing page
- Start preview server
- Create marketing materials

### Custom Mode 🔧
User-defined workflow:
```bash
# Edit pipeline-config.yaml to define custom workflow
make pipeline-status  # Check configuration
```

## 📋 Available Commands

### Pipeline Management
```bash
# Check pipeline and agent status
make pipeline-status

# List all available agents
make list-agents

# Run specific mode
make pipeline-quick
make pipeline-standard
make pipeline-premium
```

### Direct Agent Usage
```bash
# Planning
make ai-plan

# Writing
make ai-write N=1        # Write specific chapter
make ai-write-next       # Write next chapter
make ai-book-complete    # Run complete pipeline

# Research
make ai-research QUERY="blockchain technology"

# Context Management
make session-start       # Before writing session
make analyze            # Analyze chapters
make check-continuity   # Check story consistency
make session-end        # After writing session
```

## 🤖 Agent Integration

### Core Writing Agents

#### Master Orchestrator
- **Purpose**: Coordinates entire pipeline
- **Capabilities**: State management, workflow control
- **Integration**: Central hub for all agents

#### Book Planner
- **Purpose**: Creates book outline
- **Capabilities**: Structure planning, market analysis
- **Integration**: Called at start of pipeline

#### AI Writer
- **Purpose**: Writes chapters
- **Capabilities**: Content generation, style consistency
- **Integration**: Uses context from previous chapters

#### Research Agent
- **Purpose**: Gathers information
- **Capabilities**: Web research, fact checking
- **Integration**: Optional phase before writing

### Visual Agents

#### Image Prompt Agent
- **Purpose**: Generates image prompts
- **Capabilities**: Scene analysis, prompt creation
- **Integration**: Works with Ideogram API

#### Emotion Palette
- **Purpose**: Analyzes emotional tone
- **Capabilities**: Mood detection, color mapping
- **Integration**: Enhances image generation

### Build Agents

#### Book Builder
- **Purpose**: Creates final formats
- **Capabilities**: PDF/EPUB generation
- **Integration**: Multiple quality levels

#### Landing Page Builder
- **Purpose**: Creates marketing pages
- **Capabilities**: HTML generation, sales copy
- **Integration**: Premium mode only

### Advanced Agents

#### OmniCreator
- **Purpose**: Alternative all-in-one pipeline
- **Capabilities**: Autonomous creation
- **Integration**: Standalone option

## 🛠️ Tool Integration

### JavaScript Tools
- **PDF Generators**: Multiple quality levels
- **EPUB Builder**: Standard format
- **QA Agent**: Visual validation with MCP
- **Visual Server**: Live preview
- **Content Validator**: Quality checks

### Python Tools
- **Image Generator**: Ideogram integration
- **Context Analyzers**: Chapter analysis
- **Continuity Checker**: Story consistency
- **Character Tracker**: Character development

## 📝 Configuration

### pipeline-config.yaml
Central configuration defining:
- Available agents and capabilities
- Tool definitions and requirements
- Workflow definitions for each mode
- Quality gates and thresholds
- Error handling and retry logic

### book-project.yaml
Project-specific configuration:
- Book metadata
- Target audience
- Writing style
- Chapter structure

## 🔄 Workflow Example

Here's how Standard Mode works:

1. **Planning Phase**
   - Load project configuration
   - Generate book outline
   - Optional research

2. **Writing Phase**
   - Write chapters sequentially
   - Maintain context between chapters
   - Track progress in state file

3. **Analysis Phase**
   - Analyze all chapters
   - Check continuity
   - Track characters

4. **Visual Phase**
   - Analyze emotional tone
   - Generate image prompts
   - Create images via Ideogram

5. **Build Phase**
   - Generate professional PDF
   - Create EPUB
   - Optimize formats

6. **QA Phase**
   - Visual validation
   - Retry on failures
   - Generate reports

## 🚨 Error Handling

The pipeline includes robust error handling:
- Automatic retries for failed steps
- Fallback modes on critical failures
- State preservation for resume
- Detailed error reporting

## 💡 Best Practices

1. **Always start with status check**:
   ```bash
   make pipeline-status
   ```

2. **Use appropriate mode**:
   - Quick for drafts
   - Standard for production
   - Premium for commercial

3. **Monitor progress**:
   - Check `pipeline-state.json`
   - Review logs in `logs/`

4. **Handle failures**:
   - Pipeline saves state on error
   - Can resume from last good state
   - Check error reports for details

## 🔗 Integration Points

### MCP Browser Tools
- Visual PDF validation
- Screenshot capture
- Automated QA

### Docker Support
- Consistent environment
- All dependencies included
- Production-ready

### CI/CD Pipeline
- GitHub Actions integration
- Automated builds
- Quality gates

## 📊 Monitoring

Track pipeline execution:
```bash
# Check current status
cat pipeline-state.json

# View orchestrator state
cat orchestrator-state.json

# Check logs
tail -f logs/pipeline.log
```

## 🎯 Complete Example

Create a book from scratch:
```bash
# 1. Set up project
cp book-project.yaml.template book-project.yaml
vim book-project.yaml  # Edit your book details

# 2. Check everything is ready
make pipeline-status

# 3. Run complete pipeline
make pipeline-standard

# 4. Check results
ls -la build/dist/
```

The orchestration system ensures every agent and tool is properly integrated and utilized, preventing any component from being forgotten or disconnected.