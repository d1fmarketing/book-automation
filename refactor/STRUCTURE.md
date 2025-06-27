# Proposed Repository Structure

## Overview

This document outlines the new directory structure for the FIRST_E-BOOK repository, designed to improve maintainability, scalability, and code organization.

## Directory Layout

```
.
├── src/                           # Main Python package
│   └── ebook_pipeline/
│       ├── __init__.py
│       ├── agents/               # AI agents for content generation
│       │   ├── __init__.py
│       │   ├── image_prompt_agent.py
│       │   ├── emotion_palette.py
│       │   ├── omnicreator.py
│       │   └── book_builder.py
│       ├── generators/           # Image and content generators
│       │   ├── __init__.py
│       │   ├── image_generator.py
│       │   └── pdf_generator.py
│       ├── context/              # Context management system
│       │   ├── __init__.py
│       │   ├── analyzer.py
│       │   ├── continuity_checker.py
│       │   ├── character_tracker.py
│       │   └── reference_finder.py
│       └── utils/                # Utility functions
│           ├── __init__.py
│           ├── wordcount.py
│           └── context_generator.py
│
├── tests/                        # Test suite
│   ├── __init__.py
│   ├── conftest.py
│   ├── unit/                    # Unit tests
│   │   ├── test_agents/
│   │   ├── test_generators/
│   │   └── test_utils/
│   ├── integration/             # Integration tests
│   │   └── test_pipeline.py
│   └── fixtures/                # Test data
│       └── sample_chapters/
│
├── scripts/                      # Standalone utility scripts
│   ├── build-epub.js
│   ├── generate-pdf-puppeteer.js
│   ├── migrate_structure.py     # One-time migration
│   └── setup_environment.sh
│
├── config/                       # Configuration files
│   ├── .env.example
│   ├── ideogram.yaml
│   ├── openai.yaml
│   └── build.yaml
│
├── assets/                       # Static assets
│   ├── images/                  # Generated and static images
│   │   └── generated/
│   ├── fonts/                   # Typography
│   └── css/                     # Stylesheets
│
├── chapters/                     # Book content (unchanged)
│   └── *.md
│
├── context/                      # Context files (unchanged)
│   ├── story-bible.yaml
│   ├── CONTEXT.md
│   └── WRITING-RULES.md
│
├── docs/                         # Documentation
│   ├── ARCHITECTURE.md
│   ├── API.md
│   ├── CONTRIBUTING.md
│   └── sora/                    # Provider-specific docs
│       ├── SORA_GUIDE.md
│       └── SORA_OPTIMIZATION.md
│
├── .github/                      # GitHub configuration
│   └── workflows/
│       └── build-ebook.yml
│
├── .husky/                       # Git hooks (unchanged)
│   ├── pre-commit
│   └── pre-push
│
├── build/                        # Build artifacts (git-ignored)
│   ├── dist/
│   ├── temp/
│   └── reports/
│
├── logs/                         # Application logs (git-ignored)
│
├── pyproject.toml               # Python project configuration
├── setup.py                     # Python package setup
├── requirements.txt             # Python dependencies
├── package.json                 # Node.js dependencies
├── Makefile                     # Build automation
├── metadata.yaml                # Book metadata
├── CLAUDE.md                    # AI instructions (root)
├── README.md                    # Project documentation
└── .gitignore                   # Git ignore rules
```

## Key Changes

### 1. **Python Package Structure**
- All Python code moves to `src/ebook_pipeline/`
- Proper package structure with `__init__.py` files
- Clear separation of concerns (agents, generators, utils)

### 2. **Test Organization**
- Separated unit and integration tests
- Test fixtures in dedicated directory
- Mirrors source code structure

### 3. **Configuration Management**
- All config files in `config/` directory
- Environment-specific configurations
- Example files for easy setup

### 4. **Documentation Consolidation**
- Technical docs in `docs/`
- Provider-specific docs in subdirectories
- CLAUDE.md remains at root for visibility

### 5. **Script Organization**
- Build scripts remain in `scripts/`
- One-time migration scripts clearly marked
- Utility scripts for development

## Migration Benefits

1. **Better Import Management**
   - Single package namespace
   - No relative import issues
   - Clear module boundaries

2. **Easier Testing**
   - Test discovery works out of the box
   - Fixtures organized logically
   - Integration tests separated

3. **Professional Structure**
   - Follows Python packaging standards
   - Ready for PyPI distribution
   - Clear for new contributors

4. **Maintainability**
   - Logical grouping of related code
   - Easy to find functionality
   - Reduced code duplication

## Unchanged Elements

- `chapters/` - Book content location
- `context/` - Context management files
- `assets/` - Static resources
- `build/` - Build output
- Core workflow remains the same