"""
Test suite for Sora/gpt-image-1 prompt generation
Following June 2025 guidelines
"""

import pytest
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from agents.image_prompt_agent import ImagePromptAgent


class TestSoraPrompts:
    """Test Sora-specific prompt generation"""
    
    def setup_method(self):
        """Set up test fixtures"""
        self.agent = ImagePromptAgent()
    
    def test_text_validation(self):
        """Test text overlay validation rules"""
        # Test emoji removal
        result = self.agent.validate_text_overlay("🚀 Launch Now! 🎯")
        assert result == "LAUNCH NOW!"
        
        # Test comma removal
        result = self.agent.validate_text_overlay("Save 50%, Limited Time")
        assert result == "SAVE 50% LIMITED TIME"
        
        # Test 8-word limit
        result = self.agent.validate_text_overlay("This is a very long text that exceeds eight words limit")
        assert result == "THIS IS A VERY LONG TEXT THAT EXCEEDS"
        assert len(result.split()) == 8
        
        # Test uppercase conversion
        result = self.agent.validate_text_overlay("exclusive offer")
        assert result == "EXCLUSIVE OFFER"
    
    def test_sora_prompt_structure(self):
        """Test Sora prompt follows the correct template"""
        result = self.agent.build_prompt(
            "Luxury business card on marble",
            "EXCLUSIVE OFFER",
            provider="sora"
        )
        
        prompt = result['prompt']
        
        # Check HEADLINE TEXT format
        assert 'HEADLINE TEXT: "EXCLUSIVE OFFER"' in prompt
        assert "bold, uppercase, centered" in prompt
        assert "sans-serif" in prompt
        assert "color #" in prompt
        
        # Check scene description
        assert "Luxury business card on marble" in prompt
        
        # Check style tags
        assert "photo" in prompt or "illustration" in prompt
        assert "ultra-sharp" in prompt
        
        # Check palette format
        assert "palette #" in prompt
    
    def test_multi_line_text(self):
        """Test HEADLINE and SUBHEADLINE support"""
        result = self.agent.build_prompt(
            "Tech banner",
            "INNOVATION 2025|The Future is Now",
            provider="sora"
        )
        
        prompt = result['prompt']
        
        # Check both lines are present
        assert 'HEADLINE TEXT: "INNOVATION 2025"' in prompt
        assert 'SUBHEADLINE TEXT: "THE FUTURE IS NOW"' in prompt
        
        # Check formatting differences
        assert prompt.count("bold, uppercase") == 1  # Only headline
        assert prompt.count("regular, centered") == 1  # Only subheadline
    
    def test_style_tag_selection(self):
        """Test appropriate style tag selection"""
        # Vector style
        result = self.agent.build_prompt("minimalist logo design", provider="sora")
        assert "vector" in result['prompt']
        
        # Neon style
        result = self.agent.build_prompt("cyberpunk city", provider="sora")
        assert "neon" in result['prompt']
        
        # Photo style
        result = self.agent.build_prompt("realistic product mockup", provider="sora")
        assert "photo" in result['prompt']
        
        # Isometric style
        result = self.agent.build_prompt("3d isometric room", provider="sora")
        assert "isometric" in result['prompt']
        
        # Default illustration
        result = self.agent.build_prompt("fantasy landscape", provider="sora")
        assert "illustration" in result['prompt']
    
    def test_palette_format(self):
        """Test palette formatting for Sora"""
        result = self.agent.build_prompt(
            "peaceful zen garden",
            provider="sora"
        )
        
        prompt = result['prompt']
        
        # Check palette format (no "color:" prefix)
        assert "palette #" in prompt
        assert "color:#" not in prompt  # Sora doesn't use color: prefix
        
        # Check comma separation
        import re
        palette_match = re.search(r'palette (#[A-F0-9]{6},#[A-F0-9]{6},#[A-F0-9]{6})', prompt)
        assert palette_match is not None
    
    def test_scene_description_limit(self):
        """Test scene description is limited to 2 sentences"""
        long_desc = (
            "A beautiful landscape with mountains. "
            "The sun is setting behind the peaks. "
            "Birds are flying in the sky. "
            "A river flows through the valley."
        )
        
        result = self.agent.build_prompt(long_desc, provider="sora")
        prompt = result['prompt']
        
        # Count periods in the scene part (excluding style tags)
        scene_part = prompt.split("illustration")[0].split("photo")[0].split("vector")[0]
        period_count = scene_part.count('.')
        assert period_count <= 2
    
    def test_quality_mapping(self):
        """Test quality parameter mapping"""
        # QUALITY should map to 'hd'
        result = self.agent.build_prompt("test image", provider="sora")
        assert result['rendering_speed'] == "QUALITY"
        
        # This would be used by generate-images.py to set quality='hd'
    
    def test_emotion_text_color_mapping(self):
        """Test emotion-based text color selection"""
        test_cases = [
            ("peaceful mountain lake", "#1A237E"),  # Dark blue on light
            ("energetic sports event", "#FFFFFF"),   # White on orange
            ("mysterious dark forest", "#E3F2FD"),   # Light on dark
            ("romantic sunset dinner", "#FFFFFF"),   # White on pink
        ]
        
        for desc, expected_color in test_cases:
            result = self.agent.build_prompt(desc, "TEST TEXT", provider="sora")
            assert result['emotion_metadata']['text_color'] == expected_color


if __name__ == "__main__":
    pytest.main([__file__, "-v"])