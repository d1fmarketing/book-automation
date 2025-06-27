#!/usr/bin/env python3
"""
EmotionPaletteEngine: Rule-based emotion detection and color palette generation
Analyzes text to detect emotional tone and suggests appropriate color palettes
"""
import re
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass


@dataclass
class EmotionProfile:
    """Represents an emotion with its detection rules and color palette"""
    name: str
    keywords: List[str]
    palette: List[str]
    mood: str
    intensity_modifiers: List[str] = None


class EmotionPaletteEngine:
    """Rule-based emotion detection and color palette generation for AI image prompts"""
    
    def __init__(self):
        # Brand colors - always take precedence when "brand" mentioned
        self.BRAND_COLORS = ["#1A237E", "#45B3E7", "#863DFF"]
        
        # Define emotion profiles with keywords and color palettes
        self.emotion_profiles = [
            EmotionProfile(
                name='peaceful',
                keywords=['peaceful', 'calm', 'serene', 'tranquil', 'quiet', 'gentle', 
                         'soothing', 'relaxed', 'restful', 'placid', 'still'],
                palette=['#E3F2FD', '#90CAF9', '#1E88E5'],  # Soft blues
                mood='contemplative',
                intensity_modifiers=['very', 'extremely', 'deeply']
            ),
            EmotionProfile(
                name='energetic',
                keywords=['energetic', 'vibrant', 'dynamic', 'active', 'powerful', 
                         'intense', 'lively', 'spirited', 'vigorous', 'electric'],
                palette=['#FFF3E0', '#FFB74D', '#F57C00'],  # Warm oranges
                mood='uplifting'
            ),
            EmotionProfile(
                name='mysterious',
                keywords=['mysterious', 'dark', 'shadow', 'enigmatic', 'secret', 
                         'hidden', 'cryptic', 'obscure', 'mystical', 'arcane'],
                palette=['#263238', '#455A64', '#607D8B'],  # Deep grays
                mood='intriguing'
            ),
            EmotionProfile(
                name='romantic',
                keywords=['romantic', 'love', 'tender', 'intimate', 'warm', 
                         'passionate', 'affectionate', 'caring', 'devoted', 'amorous'],
                palette=['#FCE4EC', '#F48FB1', '#C2185B'],  # Soft pinks
                mood='intimate'
            ),
            EmotionProfile(
                name='tense',
                keywords=['tense', 'anxious', 'fear', 'danger', 'threatening', 
                         'ominous', 'foreboding', 'menacing', 'scary', 'dread'],
                palette=['#FFEBEE', '#EF5350', '#B71C1C'],  # Alert reds
                mood='suspenseful'
            ),
            EmotionProfile(
                name='joyful',
                keywords=['joyful', 'happy', 'cheerful', 'bright', 'sunny', 
                         'playful', 'delightful', 'merry', 'festive', 'jubilant'],
                palette=['#FFF9C4', '#FFD54F', '#F9A825'],  # Bright yellows
                mood='celebratory'
            ),
            EmotionProfile(
                name='melancholic',
                keywords=['melancholic', 'sad', 'lonely', 'nostalgic', 'wistful', 
                         'sorrowful', 'mournful', 'gloomy', 'dejected', 'forlorn'],
                palette=['#ECEFF1', '#78909C', '#37474F'],  # Muted blue-grays
                mood='reflective'
            ),
            EmotionProfile(
                name='natural',
                keywords=['natural', 'forest', 'garden', 'earth', 'organic', 
                         'botanical', 'verdant', 'lush', 'green', 'flora'],
                palette=['#E8F5E9', '#81C784', '#2E7D32'],  # Fresh greens
                mood='grounding'
            ),
            EmotionProfile(
                name='luxurious',
                keywords=['luxurious', 'elegant', 'sophisticated', 'opulent', 'rich', 
                         'lavish', 'refined', 'exclusive', 'premium', 'regal'],
                palette=['#F3E5F5', '#BA68C8', '#6A1B9A'],  # Royal purples
                mood='sophisticated'
            ),
            EmotionProfile(
                name='ethereal',
                keywords=['ethereal', 'dreamy', 'magical', 'fantastical', 'surreal', 
                         'otherworldly', 'celestial', 'transcendent', 'divine', 'mystical'],
                palette=['#F3E5F5', '#E1BEE7', '#9575CD'],  # Soft lavenders
                mood='dreamlike'
            )
        ]
        
        # Neutral fallback palette
        self.NEUTRAL_PALETTE = ['#FAFAFA', '#9E9E9E', '#424242']
    
    def detect_emotion(self, text: str) -> Tuple[str, List[str], str]:
        """
        Detect primary emotion from text and return appropriate palette
        
        Args:
            text: The text to analyze (usually image description)
            
        Returns:
            Tuple of (emotion_name, color_palette, mood)
        """
        # Convert to lowercase for matching
        text_lower = text.lower()
        
        # Check for brand mention first
        if 'brand' in text_lower or 'corporate' in text_lower or 'company' in text_lower:
            return ('brand', self.BRAND_COLORS, 'professional')
        
        # Score each emotion based on keyword matches
        emotion_scores = {}
        
        for profile in self.emotion_profiles:
            score = 0
            matched_keywords = []
            
            for keyword in profile.keywords:
                if keyword in text_lower:
                    # Base score for keyword match
                    score += 1
                    matched_keywords.append(keyword)
                    
                    # Bonus score for intensity modifiers
                    if profile.intensity_modifiers:
                        for modifier in profile.intensity_modifiers:
                            if f"{modifier} {keyword}" in text_lower:
                                score += 0.5
            
            if score > 0:
                emotion_scores[profile.name] = (score, matched_keywords, profile)
        
        # If no emotions detected, return neutral
        if not emotion_scores:
            return ('neutral', self.NEUTRAL_PALETTE, 'balanced')
        
        # Find the emotion with highest score
        best_emotion = max(emotion_scores.keys(), key=lambda name: emotion_scores[name][0])
        best_profile = emotion_scores[best_emotion][2]
        
        return (best_profile.name, best_profile.palette, best_profile.mood)
    
    def get_palette_for_emotion(self, emotion: str) -> Tuple[List[str], str]:
        """
        Get palette for a specific emotion name
        
        Args:
            emotion: Name of the emotion
            
        Returns:
            Tuple of (color_palette, mood)
        """
        if emotion == 'brand':
            return (self.BRAND_COLORS, 'professional')
        
        for profile in self.emotion_profiles:
            if profile.name == emotion:
                return (profile.palette, profile.mood)
        
        return (self.NEUTRAL_PALETTE, 'balanced')
    
    def format_colors_for_prompt(self, colors: List[str]) -> str:
        """
        Format color palette for injection into Ideogram prompt
        
        Args:
            colors: List of hex color codes
            
        Returns:
            Formatted string for prompt injection
        """
        if not colors:
            return ""
        
        # Format as comma-separated color codes
        color_specs = [f"color:{color}" for color in colors[:3]]  # Max 3 colors
        return ", ".join(color_specs)
    
    def analyze_text_emotions(self, text: str) -> Dict[str, any]:
        """
        Perform detailed emotion analysis on text
        
        Args:
            text: Text to analyze
            
        Returns:
            Dict with emotion analysis details
        """
        emotion, palette, mood = self.detect_emotion(text)
        
        # Count total emotional keywords found
        emotional_density = 0
        keywords_found = []
        
        text_lower = text.lower()
        for profile in self.emotion_profiles:
            for keyword in profile.keywords:
                if keyword in text_lower:
                    emotional_density += 1
                    keywords_found.append(keyword)
        
        return {
            'primary_emotion': emotion,
            'palette': palette,
            'mood': mood,
            'emotional_density': emotional_density,
            'keywords_found': list(set(keywords_found)),
            'palette_formatted': self.format_colors_for_prompt(palette)
        }


def main():
    """Test the emotion palette engine with sample descriptions"""
    engine = EmotionPaletteEngine()
    
    test_descriptions = [
        "A peaceful mountain lake at sunset with calm waters",
        "An energetic dance performance with vibrant costumes",
        "A mysterious figure in the shadows of an old mansion",
        "A romantic dinner setting with soft candlelight",
        "A tense standoff between two rivals in a dark alley",
        "Our brand's logo displayed prominently on a billboard",
        "A simple wooden chair in an empty room"
    ]
    
    print("EmotionPaletteEngine Test Results")
    print("=" * 50)
    
    for desc in test_descriptions:
        analysis = engine.analyze_text_emotions(desc)
        print(f"\nDescription: {desc}")
        print(f"Emotion: {analysis['primary_emotion']}")
        print(f"Mood: {analysis['mood']}")
        print(f"Palette: {analysis['palette']}")
        print(f"Prompt format: {analysis['palette_formatted']}")
        print(f"Keywords found: {', '.join(analysis['keywords_found']) if analysis['keywords_found'] else 'none'}")


if __name__ == "__main__":
    main()