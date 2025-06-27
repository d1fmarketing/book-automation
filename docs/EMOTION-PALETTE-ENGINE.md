# EmotionPaletteEngine Documentation

## Overview

The EmotionPaletteEngine is a rule-based emotion detection system that analyzes image descriptions and automatically applies appropriate color palettes to enhance visual storytelling in your ebook. Version 0.9.1 adds text overlay support for creating ads and infographics.

## Features

### 1. Emotion Detection
- **Rule-based analysis** using keyword matching
- **10 emotion profiles**: peaceful, energetic, mysterious, romantic, tense, joyful, melancholic, natural, luxurious, ethereal
- **Brand detection** with priority override
- **Neutral fallback** for unmatched content

### 2. Color Palette Generation
- Each emotion maps to a carefully chosen 3-color palette
- Colors are injected into Ideogram prompts as `color:#HEX` directives
- Brand colors take precedence when "brand" is mentioned

### 3. Integration with Image Pipeline
- Seamless integration with existing `generate-images.py` script
- Emotion metadata stored in `image-manifest.json`
- Full logging of detected emotions and applied palettes

### 4. Text Overlay (v0.9.1)
- Embed text directly in images for ads and infographics
- Automatic text color selection for optimal contrast
- Native Ideogram rendering or Pillow post-processing
- Support for special characters (%, $, numbers)

## Usage

### Basic Command
```bash
python scripts/generate-images.py
```

### With Options
```bash
# Generate image with text overlay
# In markdown: ![AI-IMAGE: space economy chart text="14% GROWTH"]()
python scripts/generate-images.py

# Force Pillow text overlay (more reliable for graphs)
python scripts/generate-images.py --text-overlay post

# Skip existing images
python scripts/generate-images.py --skip-existing

# Enable post-processing (future enhancement)
python scripts/generate-images.py --enhance-images
```

### Text Overlay Examples

```markdown
# For ads
![AI-IMAGE: futuristic city skyline text="INVEST NOW"]()

# For infographics  
![AI-IMAGE: clean chart showing growth text="14% YEARLY"]()

# For brand messaging
![AI-IMAGE: company headquarters text="JOIN US"]()
```

## Emotion Profiles

| Emotion | Keywords | Palette Colors | Mood |
|---------|----------|----------------|------|
| peaceful | calm, serene, tranquil, quiet | Soft blues (#E3F2FD, #90CAF9, #1E88E5) | contemplative |
| energetic | vibrant, dynamic, active, powerful | Warm oranges (#FFF3E0, #FFB74D, #F57C00) | uplifting |
| mysterious | dark, shadow, enigmatic, secret | Deep grays (#263238, #455A64, #607D8B) | intriguing |
| romantic | love, tender, intimate, warm | Soft pinks (#FCE4EC, #F48FB1, #C2185B) | intimate |
| tense | anxious, fear, danger, threatening | Alert reds (#FFEBEE, #EF5350, #B71C1C) | suspenseful |
| joyful | happy, cheerful, bright, sunny | Bright yellows (#FFF9C4, #FFD54F, #F9A825) | celebratory |
| melancholic | sad, lonely, nostalgic, wistful | Muted blue-grays (#ECEFF1, #78909C, #37474F) | reflective |
| natural | forest, garden, earth, organic | Fresh greens (#E8F5E9, #81C784, #2E7D32) | grounding |
| luxurious | elegant, sophisticated, opulent | Royal purples (#F3E5F5, #BA68C8, #6A1B9A) | sophisticated |
| ethereal | dreamy, magical, fantastical | Soft lavenders (#F3E5F5, #E1BEE7, #9575CD) | dreamlike |

## Manifest Schema v2.0

The updated image manifest includes emotion metadata:

```json
{
  "schema_version": "2.0",
  "generated_images": {
    "peaceful_lake_a1b2c3d4": {
      "raw_desc": "A peaceful mountain lake at dawn",
      "final_prompt": "A peaceful mountain lake at dawn. color:#E3F2FD, color:#90CAF9, color:#1E88E5. vivid, ultra-detail",
      "emotion_detected": "peaceful",
      "palette_used": ["#E3F2FD", "#90CAF9", "#1E88E5"],
      "mood": "contemplative",
      "model": "ideogram-v3",
      "size": "1536x1536",
      "enhanced": false,
      "generated_at": "2024-01-20T10:30:00",
      "cost_usd": 0.08
    }
  },
  "total_cost_usd": 0.08,
  "last_updated": "2024-01-20T10:30:00"
}
```

## Testing

Run the emotion detection tests:
```bash
python -m pytest tests/test_emotion_palette_engine.py -v
```

## Logging

All emotion detection and palette applications are logged to:
- `logs/image-generation.log`

Example log entries:
```
2024-01-20 10:30:00 - ImageGenerator - INFO - Emotion detected for 'A peaceful mountain lake...': peaceful
2024-01-20 10:30:00 - ImageGenerator - INFO - Palette applied: ['#E3F2FD', '#90CAF9', '#1E88E5']
```

## Future Enhancements

1. **Machine Learning Integration**: Replace rule-based detection with a small sentiment analysis model
2. **Custom Palettes**: Allow user-defined emotion-palette mappings
3. **Palette Blending**: Mix colors from multiple detected emotions
4. **Image Enhancement**: Fully implement the `--enhance-images` flag with:
   - ESRGAN upscaling
   - LUT-based color grading
   - Film grain addition
5. **A/B Testing**: Generate multiple versions with different palettes