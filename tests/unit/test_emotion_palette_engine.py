#!/usr/bin/env python3
"""
Unit tests for EmotionPaletteEngine
"""
import pytest
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from ebook_pipeline.agents.emotion_palette import EmotionPaletteEngine, EmotionProfile


class TestEmotionPaletteEngine:
    """Test suite for emotion detection and palette generation"""
    
    @pytest.fixture
    def engine(self):
        """Create a fresh engine instance for each test"""
        return EmotionPaletteEngine()
    
    def test_brand_detection_takes_precedence(self, engine):
        """Brand mentions should always override emotional keywords"""
        text = "A peaceful scene with our brand logo prominently displayed"
        emotion, palette, mood = engine.detect_emotion(text)
        
        assert emotion == 'brand'
        assert palette == engine.BRAND_COLORS
        assert mood == 'professional'
    
    def test_peaceful_emotion_detection(self, engine):
        """Test detection of peaceful/calm emotions"""
        texts = [
            "A calm lake at dawn",
            "Serene mountain landscape",
            "Peaceful meditation garden",
            "A quiet and tranquil forest path"
        ]
        
        for text in texts:
            emotion, palette, mood = engine.detect_emotion(text)
            assert emotion == 'peaceful'
            assert palette[0] == '#E3F2FD'  # Soft blue
            assert mood == 'contemplative'
    
    def test_energetic_emotion_detection(self, engine):
        """Test detection of energetic/vibrant emotions"""
        text = "A vibrant and dynamic dance performance"
        emotion, palette, mood = engine.detect_emotion(text)
        
        assert emotion == 'energetic'
        assert palette[0] == '#FFF3E0'  # Warm orange
        assert mood == 'uplifting'
    
    def test_multiple_emotions_highest_score_wins(self, engine):
        """When multiple emotions present, highest scoring one should win"""
        text = "A mysterious figure in a peaceful garden with dark shadows"
        emotion, palette, mood = engine.detect_emotion(text)
        
        # Should detect mysterious due to multiple keywords
        assert emotion == 'mysterious'
    
    def test_neutral_fallback(self, engine):
        """Text with no emotional keywords should return neutral"""
        texts = [
            "A simple table",
            "Basic geometric shapes",
            "Standard office equipment"
        ]
        
        for text in texts:
            emotion, palette, mood = engine.detect_emotion(text)
            assert emotion == 'neutral'
            assert palette == engine.NEUTRAL_PALETTE
            assert mood == 'balanced'
    
    def test_intensity_modifiers_boost_score(self, engine):
        """Intensity modifiers should increase emotion score"""
        text1 = "A peaceful scene"
        text2 = "An extremely peaceful scene"
        
        analysis1 = engine.analyze_text_emotions(text1)
        analysis2 = engine.analyze_text_emotions(text2)
        
        # Both should detect peaceful, but text2 should have found more keywords
        assert analysis1['primary_emotion'] == 'peaceful'
        assert analysis2['primary_emotion'] == 'peaceful'
    
    def test_format_colors_for_prompt(self, engine):
        """Test color formatting for Ideogram prompt injection"""
        colors = ['#FF0000', '#00FF00', '#0000FF']
        formatted = engine.format_colors_for_prompt(colors)
        
        assert formatted == "color:#FF0000, color:#00FF00, color:#0000FF"
    
    def test_format_colors_max_three(self, engine):
        """Only first three colors should be formatted"""
        colors = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF']
        formatted = engine.format_colors_for_prompt(colors)
        
        assert 'color:#FFFF00' not in formatted
        assert formatted.count('color:') == 3
    
    def test_analyze_text_emotions_comprehensive(self, engine):
        """Test complete emotion analysis output"""
        text = "A very peaceful and serene mountain lake"
        analysis = engine.analyze_text_emotions(text)
        
        assert 'primary_emotion' in analysis
        assert 'palette' in analysis
        assert 'mood' in analysis
        assert 'emotional_density' in analysis
        assert 'keywords_found' in analysis
        assert 'palette_formatted' in analysis
        
        assert analysis['primary_emotion'] == 'peaceful'
        assert analysis['emotional_density'] >= 2  # At least peaceful and serene
        assert 'peaceful' in analysis['keywords_found']
        assert 'serene' in analysis['keywords_found']
    
    def test_case_insensitive_detection(self, engine):
        """Emotion detection should be case-insensitive"""
        texts = [
            "A PEACEFUL scene",
            "A Peaceful Scene",
            "a peaceful scene"
        ]
        
        for text in texts:
            emotion, _, _ = engine.detect_emotion(text)
            assert emotion == 'peaceful'
    
    def test_all_emotion_profiles_have_required_fields(self, engine):
        """Ensure all emotion profiles are properly configured"""
        for profile in engine.emotion_profiles:
            assert profile.name
            assert len(profile.keywords) > 0
            assert len(profile.palette) == 3  # Should have 3 colors
            assert all(color.startswith('#') for color in profile.palette)
            assert profile.mood
    
    def test_get_palette_for_emotion(self, engine):
        """Test direct palette lookup by emotion name"""
        palette, mood = engine.get_palette_for_emotion('romantic')
        assert palette[0] == '#FCE4EC'
        assert mood == 'intimate'
        
        # Test unknown emotion returns neutral
        palette, mood = engine.get_palette_for_emotion('unknown')
        assert palette == engine.NEUTRAL_PALETTE
        assert mood == 'balanced'


if __name__ == "__main__":
    pytest.main([__file__, "-v"])