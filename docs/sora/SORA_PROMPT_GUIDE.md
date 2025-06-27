# Sora/gpt-image-1 Prompt Optimization Guide

## Overview

This pipeline has been optimized for Sora (gpt-image-1) following the June 2025 guidelines.

## Key Features

### 1. **Text Overlay Optimization**
- Automatically converts text to UPPERCASE for clarity
- Removes emojis and special characters
- Strips commas to avoid parsing issues
- Limits to 8 words maximum per line
- Supports multi-line text with pipe separator (`|`)

### 2. **Prompt Template Structure**

```python
# Example Sora-optimized prompt:
HEADLINE TEXT: "EXCLUSIVE OFFER" | bold, uppercase, centered, color #1A237E, sans-serif.
SUBHEADLINE TEXT: "LIMITED TIME ONLY" | regular, centered, color #1A237E, sans-serif.
Close-up of luxury business card on marble surface, minimalist design.
photo, ultra-sharp.
palette #E8F5E9,#81C784,#2E7D32.
```

### 3. **Style Tags**
The system automatically selects appropriate style tags:
- `photo` - For realistic mockups
- `vector` - For logos and minimalist designs
- `neon` - For cyberpunk/glow effects
- `isometric` - For 3D dimensional views
- `illustration` - Default for artistic renders

### 4. **Quality Settings**
- `standard` - For draft/preview images
- `hd` - For final high-quality renders (default)

### 5. **Supported Sizes**
- `1024x1024` - Square format
- `1024x1792` - Portrait
- `1792x1024` - Landscape
- `1536x1536` - Large square

## Usage Examples

### Basic Text Overlay
```markdown
![AI-IMAGE: Premium tech banner text="INNOVATION 2025"]()
```

### Multi-line Text
```markdown
![AI-IMAGE: Fashion ad text="SUMMER SALE|Up to 50% Off"]()
```

### Without Text
```markdown
![AI-IMAGE: Minimalist product mockup on white background]()
```

## Emotion-Based Palettes

The system automatically detects emotions and applies appropriate color palettes:

| Emotion | Text Color | Background Palette |
|---------|------------|-------------------|
| Peaceful | Dark Blue | Light blues |
| Energetic | White | Oranges/reds |
| Luxurious | White | Purples/golds |
| Natural | White | Greens |
| Neutral | Dark Blue | Grays |

## API Configuration

```bash
# Use Sora instead of Ideogram
export IMAGE_PROVIDER=openai
export OPENAI_API_KEY="your-key"

# Generate with optimized prompts
python scripts/generate-images.py
```

## Content Policy

Avoid:
- Trademarked brands (e.g., "Coca-Cola")
- Violence or gore
- Sexual content
- Defamatory content
- Real person likenesses

## Testing

Run Sora-specific tests:
```bash
python -m pytest tests/test_sora_prompts.py -v
```

## Benefits

1. **Better Text Clarity**: Uppercase, limited words, proper contrast
2. **Consistent Results**: Structured prompts reduce variability
3. **Fewer Errors**: Validated inputs prevent API rejections
4. **Cost Efficient**: $0.04 per image (50% less than Ideogram)