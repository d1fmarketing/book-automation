"""
ImagePromptAgent ▸ Gera prompts para Ideogram-3.0 e Sora/gpt-image-1

Regras Ideogram:
• Campos: style, lighting, camera, color:<hex>, negative_prompt
• Qualidade: TURBO | DEFAULT | QUALITY
• Resoluções: 1024x1024, 2048x2048, 1024x1792, 1792x1024

Regras Sora/gpt-image-1 (Jun 2025):
• Texto: HEADLINE TEXT: "texto" | bold, uppercase, centered, color #hex, sans-serif
• Paleta: palette #hex1,#hex2,#hex3
• Estilos: illustration, photo, vector, sprite, isometric, neon, flat color
• Qualidade API: standard | hd
• Tamanhos: 1024x1024, 1024x1792, 1792x1024, 1536x1536
"""

from dataclasses import dataclass
import re
from typing import Optional, List, Dict, Tuple
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from agents.emotion_palette_engine import EmotionPaletteEngine

BRAND_COLORS = ["#1A237E", "#45B3E7", "#863DFF"]

@dataclass
class ImagePromptAgent:
    default_style: str = "vivid, ultra-detail"
    default_quality: str = "QUALITY"
    default_resolution: str = "1024x1024"  # Valid Ideogram resolution
    brand_colors: Optional[List[str]] = None
    
    def __post_init__(self):
        """Initialize emotion engine after dataclass init"""
        self.emotion_engine = EmotionPaletteEngine()

    def sanitize(self, text: str) -> str:
        """Remove double spaces, trailing dots"""
        return re.sub(r"\s{2,}", " ", text.strip()).rstrip(".")
    
    def validate_text_overlay(self, text: str) -> str:
        """Validate and clean text for Sora overlay (≤8 words, no commas, no emojis)"""
        # Remove emojis
        emoji_pattern = re.compile("["
            u"\U0001F600-\U0001F64F"  # emoticons
            u"\U0001F300-\U0001F5FF"  # symbols & pictographs
            u"\U0001F680-\U0001F6FF"  # transport & map symbols
            u"\U0001F1E0-\U0001F1FF"  # flags
            u"\U00002702-\U000027B0"
            u"\U000024C2-\U0001F251"
            "]+", flags=re.UNICODE)
        text = emoji_pattern.sub('', text)
        
        # Remove commas
        text = text.replace(',', '')
        
        # Limit to 8 words
        words = text.split()
        if len(words) > 8:
            text = ' '.join(words[:8])
        
        return text.strip().upper()  # Uppercase for better readability

    def inject_emotion_colors(self, desc: str) -> Tuple[str, Dict[str, any]]:
        """Detect emotion and inject appropriate color palette"""
        # Analyze emotion from description
        emotion_analysis = self.emotion_engine.analyze_text_emotions(desc)
        
        # If we have a palette, inject it
        if emotion_analysis['palette_formatted']:
            enhanced_desc = f"{desc}. {emotion_analysis['palette_formatted']}"
        else:
            enhanced_desc = desc
            
        return enhanced_desc, emotion_analysis
    
    def get_text_color_for_emotion(self, emotion: str) -> str:
        """Get appropriate text color for the detected emotion to ensure contrast"""
        # Map emotions to text colors that contrast well with their palettes
        text_color_map = {
            'peaceful': '#1A237E',    # Dark blue on light blue background
            'energetic': '#FFFFFF',   # White on orange background
            'mysterious': '#E3F2FD',  # Light blue on dark gray
            'romantic': '#FFFFFF',    # White on pink
            'tense': '#FFFFFF',       # White on red
            'joyful': '#1A237E',      # Dark blue on yellow
            'melancholic': '#FFFFFF', # White on blue-gray
            'natural': '#FFFFFF',     # White on green
            'luxurious': '#FFFFFF',   # White on purple
            'ethereal': '#1A237E',    # Dark blue on lavender
            'brand': '#FFFFFF',       # White on brand blues
            'neutral': '#1A237E'      # Dark blue on neutral gray
        }
        return text_color_map.get(emotion, '#FFFFFF')
    
    def format_palette_for_sora(self, palette: List[str]) -> str:
        """Format palette for Sora: palette #hex1,#hex2,#hex3"""
        if not palette:
            return ""
        return f"palette {','.join(palette)}"
    
    def get_sora_style_tags(self, desc: str) -> str:
        """Determine appropriate Sora style tags based on description"""
        desc_lower = desc.lower()
        
        # Default style tags
        tags = []
        
        # Determine primary style
        if any(word in desc_lower for word in ['logo', 'icon', 'geometric', 'minimalist']):
            tags.append('vector')
        elif any(word in desc_lower for word in ['neon', 'cyberpunk', 'glow']):
            tags.append('neon')
        elif any(word in desc_lower for word in ['isometric', '3d', 'dimensional']):
            tags.append('isometric')
        elif any(word in desc_lower for word in ['photo', 'realistic', 'mockup']):
            tags.append('photo')
        else:
            tags.append('illustration')
        
        # Add sharpness
        tags.append('ultra-sharp')
        
        return ', '.join(tags)

    def build_prompt_for_sora(self, raw_desc: str, overlay_text: Optional[str] = None, res: Optional[str] = None) -> Dict[str, any]:
        """Build Sora-optimized prompt following June 2025 guidelines"""
        res = res or self.default_resolution
        scene_desc = self.sanitize(raw_desc)
        
        # Analyze emotion
        emotion_analysis = self.emotion_engine.analyze_text_emotions(scene_desc)
        
        prompt_parts = []
        
        # 1. Handle text overlay with multi-line support
        if overlay_text:
            # Check for multi-line text (pipe separator)
            text_lines = overlay_text.split('|')
            
            # Validate and clean first line
            headline = self.validate_text_overlay(text_lines[0])
            text_color = self.get_text_color_for_emotion(emotion_analysis['primary_emotion'])
            emotion_analysis['text_color'] = text_color
            
            # Build HEADLINE TEXT
            prompt_parts.append(
                f'HEADLINE TEXT: "{headline}" | bold, uppercase, centered, '
                f'color {text_color}, sans-serif.'
            )
            
            # Add SUBHEADLINE if present
            if len(text_lines) > 1 and text_lines[1].strip():
                subheadline = self.validate_text_overlay(text_lines[1])
                prompt_parts.append(
                    f'SUBHEADLINE TEXT: "{subheadline}" | regular, centered, '
                    f'color {text_color}, sans-serif.'
                )
        
        # 2. Scene description (max 2 sentences, clear nouns + style adjectives)
        # Ensure concise description
        sentences = scene_desc.split('.')
        if len(sentences) > 2:
            scene_desc = '. '.join(sentences[:2]) + '.'
        prompt_parts.append(scene_desc)
        
        # 3. Style tags
        style_tags = self.get_sora_style_tags(raw_desc)
        prompt_parts.append(style_tags)
        
        # 4. Palette in Sora format
        if emotion_analysis['palette']:
            palette_str = self.format_palette_for_sora(emotion_analysis['palette'])
            prompt_parts.append(palette_str)
        
        # Combine all parts
        final_prompt = ' '.join(filter(None, prompt_parts))
        
        return {
            "prompt": final_prompt,
            "resolution": res,
            "rendering_speed": self.default_quality,
            "emotion_metadata": emotion_analysis,
            "provider": "sora"
        }
    
    def build_prompt(self, raw_desc: str, overlay_text: Optional[str] = None, res: Optional[str] = None, provider: str = "ideogram") -> Dict[str, any]:
        """Build prompt for specified provider (ideogram or sora)"""
        if provider == "sora" or provider == "openai":
            return self.build_prompt_for_sora(raw_desc, overlay_text, res)
        
        # Original Ideogram logic
        res = res or self.default_resolution
        desc = self.sanitize(raw_desc)
        
        # Detect emotion and inject colors
        desc, emotion_metadata = self.inject_emotion_colors(desc)
        
        # Add text overlay instruction if present
        if overlay_text:
            # Get appropriate text color based on emotion
            text_color = self.get_text_color_for_emotion(emotion_metadata['primary_emotion'])
            emotion_metadata['text_color'] = text_color
            
            # Inject HEADLINE TEXT at the beginning of prompt
            desc = f'HEADLINE TEXT: "{overlay_text}" | bold, centered, {text_color} on contrasting background.\n{desc}'
        
        # Add default style if not present
        if "vivid" not in desc.lower() and "ultra" not in desc.lower():
            desc = f"{desc}. {self.default_style}"
            
        return {
            "prompt": desc,
            "resolution": res,
            "rendering_speed": self.default_quality,
            "emotion_metadata": emotion_metadata,
            "provider": "ideogram"
        }


if __name__ == "__main__":
    # Test the agent with both providers
    agent = ImagePromptAgent()
    
    print("=" * 80)
    print("SORA PROMPT TESTS")
    print("=" * 80)
    
    sora_tests = [
        ("Luxury business card mockup on marble surface", "EXCLUSIVE OFFER"),
        ("Premium tech product launch banner with neon glow", "INNOVATION 2025|The Future is Now"),
        ("Minimalist motivational poster with geometric shapes", "THINK DIFFERENT"),
        ("Futuristic cyberpunk cityscape at night", "FUTURE IS NOW"),
    ]
    
    for desc, text in sora_tests:
        result = agent.build_prompt(desc, text, provider="sora")
        print(f"\nInput: {desc}")
        print(f"Text: {text}")
        print(f"Output: {result['prompt']}")
        print(f"Emotion: {result['emotion_metadata']['primary_emotion']}")
        print(f"Palette: {result['emotion_metadata']['palette']}")
        print("-" * 40)
    
    print("\n" + "=" * 80)
    print("IDEOGRAM PROMPT TESTS")
    print("=" * 80)
    
    ideogram_tests = [
        ("brand neon phoenix logo", "INVEST NOW"),
        ("mystical forest with glowing mushrooms", None),
    ]
    
    for desc, text in ideogram_tests:
        result = agent.build_prompt(desc, text, provider="ideogram")
        print(f"\nInput: {desc}")
        if text:
            print(f"Text: {text}")
        print(f"Output: {result['prompt'][:100]}...")
        print(f"Emotion: {result['emotion_metadata']['primary_emotion']}")