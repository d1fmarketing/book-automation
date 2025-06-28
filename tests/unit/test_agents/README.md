# Agent Unit Tests

This directory contains comprehensive unit tests for all agents in the ebook pipeline.

## Test Coverage

### 1. **ImagePromptAgent** (`test_image_prompt_agent.py`)
- Text sanitization and validation
- Emoji and comma removal for overlays
- 8-word limit enforcement for Sora
- Emotion color injection
- Multi-line text handling
- Provider routing (Ideogram vs Sora)
- Style tag generation
- Brand color detection

### 2. **BookBuilder** (`test_book_builder.py`)
- Metadata creation
- Cover image generation with fallbacks
- EPUB creation via Pandoc
- PDF creation with Puppeteer fallback
- Error handling and logging
- Directory structure handling

### 3. **LandingPageBuilder** (`test_landing_page_builder.py`)
- Hero image selection logic
- CSS generation with custom palettes
- Page data structure creation
- HTML generation from templates
- Deployment (local and API)
- Dark mode support
- Responsive design

### 4. **EmotionPaletteEngine** (`test_emotion_palette_engine.py`)
- Emotion detection from keywords
- Color palette generation
- Brand color priority
- Intensity modifiers
- Keyword deduplication
- Emotional density calculation
- All emotion profiles coverage

### 5. **OmniCreator** (`test_omnicreator.py`)
- Configuration loading from environment
- Directory structure creation
- Chapter scanning
- Full pipeline orchestration
- Manifest generation and tracking
- Error recovery
- Component integration

## Running Tests

### Run all agent tests:
```bash
python3 run_agent_tests.py
```

### Run specific test file:
```bash
python3 run_agent_tests.py tests/unit/test_agents/test_image_prompt_agent.py
```

### Run with coverage:
```bash
python3 run_agent_tests.py --cov=src/ebook_pipeline/agents
```

### Run specific test:
```bash
python3 run_agent_tests.py -k test_validate_text_overlay
```

## Test Structure

Each test file follows a consistent pattern:
- Fixtures for common setup
- Mock external dependencies
- Test both success and failure cases
- Verify logging behavior
- Check edge cases

## Mocking Strategy

- **File I/O**: Use `mock_open()` or `patch('pathlib.Path.write_text')`
- **Subprocess**: Mock `subprocess.run` to avoid actual command execution
- **External modules**: Use `patch.dict('sys.modules')` for import mocking
- **Logging**: Patch module-level loggers

## Common Issues

1. **Import errors**: Ensure PYTHONPATH includes the src directory
2. **Path mocking**: Be careful with Path objects vs strings
3. **Logger mocking**: Patch at module level, not via getLogger
4. **Async operations**: Use appropriate async test decorators

## Adding New Tests

When adding tests for new agents:
1. Create a new test file in this directory
2. Follow the naming convention: `test_<agent_name>.py`
3. Include fixtures for common setup
4. Test all public methods
5. Mock external dependencies
6. Add edge case tests
7. Update this README