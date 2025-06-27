# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.9.1] - 2024-01-27

### Added
- **Text Overlay Support**: Generate images with embedded text for ads and infographics
  - New syntax: `![AI-IMAGE: description text="YOUR TEXT"]()`
  - Automatic text color selection based on emotion for optimal contrast
  - "HEADLINE TEXT:" injection for Ideogram v3.0 native text rendering
  - Pillow fallback option with `--text-overlay post` flag
- Text overlay tests (7 test cases)
- Font detection for multiple operating systems

### Changed
- Image manifest schema updated to v2.1
  - Added fields: `overlay_text`, `text_color`, `text_method`
- ImagePromptAgent now accepts optional text parameter
- Extended emotion metadata with text color mapping

### Fixed
- Default resolution reverted to 1024x1024 (valid Ideogram size)

## [0.9.0] - 2024-01-27

### Added
- **EmotionPaletteEngine**: Rule-based emotion detection for AI image generation
  - 10 emotion profiles with custom color palettes
  - Automatic color injection into Ideogram prompts
  - Brand color priority override
- Enhanced image generation pipeline
  - Default resolution increased to 1536x1536
  - `--size` flag for custom resolutions
  - `--enhance-images` flag for future post-processing
- Comprehensive logging with rotation (10MB cap)
- Unit tests for emotion detection (12 test cases)
- Documentation for EmotionPaletteEngine

### Changed
- **BREAKING**: Image manifest schema updated to v2.0
  - Added `schema_version` field
  - Added `emotion_detected`, `palette_used`, and `mood` fields
  - Added `enhanced` boolean flag
- ImagePromptAgent now includes emotion metadata in responses
- Updated README with new features

### Fixed
- Log file size management with RotatingFileHandler
- Manifest now always includes schema version

### Security
- No security changes in this release

## [0.8.0] - Previous Release
- Initial ebook pipeline implementation
- Context Guardian system
- AI image generation with Ideogram