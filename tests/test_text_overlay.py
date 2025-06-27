#!/usr/bin/env python3
"""
Unit tests for text overlay feature
"""
import pytest
import re
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from agents.image_prompt_agent import ImagePromptAgent

# Define TAG_PATTERN inline for testing
TAG_PATTERN = r'!\[AI-IMAGE:\s*(.+?)(?:\s+text="(.+?)")?\s*\]\(\)'


class TestTextOverlay:
    """Test suite for text overlay in image generation"""
    
    @pytest.fixture
    def agent(self):
        """Create a fresh agent instance for each test"""
        return ImagePromptAgent()
    
    def test_tag_pattern_with_text(self):
        """Test that TAG_PATTERN correctly captures text attribute"""
        test_cases = [
            ('![AI-IMAGE: space scene text="INVEST NOW"]()', 
             ('space scene', 'INVEST NOW')),
            ('![AI-IMAGE: galaxy backdrop text="SPACE ETF 14%"]()', 
             ('galaxy backdrop', 'SPACE ETF 14%')),
            ('![AI-IMAGE: peaceful lake]()', 
             ('peaceful lake', None)),
            ('![AI-IMAGE: brand logo text="BUY TODAY"]()', 
             ('brand logo', 'BUY TODAY')),
        ]
        
        for tag, expected in test_cases:
            match = re.match(TAG_PATTERN, tag)
            assert match is not None
            
            description = match.group(1).strip()
            text = match.group(2).strip() if match.group(2) else None
            
            assert description == expected[0]
            assert text == expected[1]
    
    def test_prompt_with_text_overlay(self, agent):
        """Test that text overlay is properly injected into prompt"""
        desc = "futuristic city"
        text = "FUTURE NOW"
        
        result = agent.build_prompt(desc, text)
        prompt = result['prompt']
        
        # Check that HEADLINE TEXT is at the beginning
        assert prompt.startswith('HEADLINE TEXT: "FUTURE NOW"')
        assert "bold, centered" in prompt
        assert "contrasting background" in prompt
        assert "futuristic city" in prompt
    
    def test_prompt_without_text_overlay(self, agent):
        """Test that prompts work normally without text"""
        desc = "peaceful forest"
        
        result = agent.build_prompt(desc)
        prompt = result['prompt']
        
        # Should not contain HEADLINE TEXT
        assert "HEADLINE TEXT:" not in prompt
        assert "peaceful forest" in prompt
    
    def test_text_color_mapping(self, agent):
        """Test that emotions map to appropriate text colors"""
        test_cases = [
            ("peaceful scene", "RELAX", '#1A237E'),    # Dark blue on light
            ("energetic dance", "MOVE", '#FFFFFF'),    # White on orange
            ("romantic dinner", "LOVE", '#FFFFFF'),    # White on pink
            ("brand logo", "BUY", '#FFFFFF'),          # White on brand
        ]
        
        for desc, text, expected_color in test_cases:
            result = agent.build_prompt(desc, text)
            metadata = result['emotion_metadata']
            
            assert 'text_color' in metadata
            assert metadata['text_color'] == expected_color
    
    def test_metadata_includes_text_info(self, agent):
        """Test that emotion metadata includes text color when overlay present"""
        desc = "mysterious forest"
        text = "EXPLORE"
        
        result = agent.build_prompt(desc, text)
        metadata = result['emotion_metadata']
        
        assert 'text_color' in metadata
        assert metadata['text_color'] in ['#E3F2FD', '#FFFFFF']  # Valid colors for mysterious
    
    def test_special_characters_in_text(self, agent):
        """Test handling of special characters in text overlay"""
        test_cases = [
            ("chart", "14% GROWTH"),
            ("graph", "USD $1,000"),
            ("stats", "Q4 2025"),
            ("report", "TOP 10"),
        ]
        
        for desc, text in test_cases:
            result = agent.build_prompt(desc, text)
            prompt = result['prompt']
            
            assert f'HEADLINE TEXT: "{text}"' in prompt
    
    def test_text_length_limits(self, agent):
        """Test that text overlay handles various lengths"""
        test_cases = [
            ("scene", "BUY"),                          # 3 chars
            ("scene", "INVEST NOW"),                   # 10 chars
            ("scene", "SPACE ECONOMY FUTURE 2030"),    # 24 chars
            ("scene", "THE NEXT BIG INVESTMENT OPPORTUNITY IS HERE"),  # 40+ chars
        ]
        
        for desc, text in test_cases:
            result = agent.build_prompt(desc, text)
            prompt = result['prompt']
            
            # All should be included, though longer text may be distorted by Ideogram
            assert f'HEADLINE TEXT: "{text}"' in prompt


if __name__ == "__main__":
    pytest.main([__file__, "-v"])