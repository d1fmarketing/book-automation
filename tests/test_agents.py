"""
Sanity checks for the core agents.
Run: PYTHONPATH=src pytest -q tests/test_agents.py
"""
import os
import json
from pathlib import Path
from unittest.mock import Mock, patch, MagicMock
import pytest
from dataclasses import dataclass, field

# Import agents
from ebook_pipeline.agents.book_builder import BookBuilder
from ebook_pipeline.agents.landing_page_builder import LandingPageBuilder
from ebook_pipeline.agents.image_prompt_agent import ImagePromptAgent
from ebook_pipeline.agents.emotion_palette import EmotionPaletteEngine
from ebook_pipeline.agents.omnicreator import OmniCreator, BookConfig

TMP = Path(__file__).parent / "__tmp__"
TMP.mkdir(exist_ok=True)

# Mock config for testing
@dataclass
class MockConfig:
    book_title: str = "Test Book"
    author_name: str = "Test Author" 
    language: str = "en"
    isbn: str = "978-0-000000-00-0"
    book_slug: str = "test-book"
    chapters_dir: str = "chapters"
    provider: str = "ideogram"
    api_key: str = "test_key"
    output_dir: str = str(TMP)
    hero_image: str = "hero.jpg"
    enable_text_overlay: bool = True
    enhance_images: bool = False
    target_domain: str = "test.domain.com"
    primary_palette: list = field(default_factory=lambda: ["#1A237E", "#45B3E7", "#863DFF"])
    source_dir: str = "chapters"


class TestImagePromptAgent:
    """Test the ImagePromptAgent for prompt building"""
    
    def test_ideogram_prompt_basic(self):
        """Test basic Ideogram prompt building"""
        agent = ImagePromptAgent()
        prompt = agent.build_prompt(
            raw_desc="A peaceful mountain lake at sunset",
            provider="ideogram"
        )
        
        assert "A peaceful mountain lake at sunset" in prompt["prompt"]
        assert prompt["provider"] == "ideogram"
        assert prompt["resolution"] == "1024x1024"
    
    def test_text_overlay_validation(self):
        """Test text overlay word limit and emoji removal"""
        agent = ImagePromptAgent()
        
        # Test emoji removal
        emoji_text = "Hello 👋 World 🌍!"
        cleaned_text = agent.validate_text_overlay(emoji_text)
        assert "👋" not in cleaned_text
        assert "🌍" not in cleaned_text
        assert "HELLO" in cleaned_text  # validate_text_overlay converts to uppercase
        assert "WORLD" in cleaned_text
        
        # Test word limit
        long_text = " ".join(["word"] * 20)
        cleaned_long = agent.validate_text_overlay(long_text)
        assert len(cleaned_long.split()) <= 8
    
    def test_sora_prompt_formatting(self):
        """Test Sora prompt formatting"""
        agent = ImagePromptAgent()
        prompt = agent.build_prompt_for_sora(
            raw_desc="Mountain scene",
            overlay_text="Line One|Line Two"
        )
        
        assert "Mountain scene" in prompt["prompt"]
        assert "HEADLINE TEXT:" in prompt["prompt"]
        assert "SUBHEADLINE TEXT:" in prompt["prompt"]
        assert prompt["provider"] == "sora"


class TestBookBuilder:
    """Test the BookBuilder agent"""
    
    def test_metadata_creation(self):
        """Test metadata structure creation"""
        config = MockConfig()
        builder = BookBuilder(config)
        metadata = builder.create_metadata()
        
        assert metadata["title"] == "Test Book"
        assert metadata["author"] == "Test Author"
        assert metadata["language"] == "en"
        assert metadata["identifier"] == "isbn:978-0-000000-00-0"
    
    @patch('pathlib.Path.glob')
    def test_generate_cover(self, mock_glob):
        """Test cover generation"""
        config = MockConfig()
        builder = BookBuilder(config)
        
        # Mock finding an image
        mock_glob.return_value = [Path("test_image.png")]
        
        cover = builder.generate_cover()
        assert cover is not None
        assert str(cover).endswith(".png")
    
    @patch('subprocess.run')
    def test_epub_creation(self, mock_run):
        """Test EPUB creation with mocked subprocess"""
        mock_run.return_value = Mock(returncode=0, stdout="Success", stderr="")
        
        config = MockConfig()
        builder = BookBuilder(config)
        
        chapters = [Path("chapter1.md"), Path("chapter2.md")]
        result = builder.create_epub(chapters)
        
        # Should return path to created EPUB
        assert result is not None
        mock_run.assert_called_once()


class TestLandingPageBuilder:
    """Test the LandingPageBuilder agent"""
    
    def test_initialization(self):
        """Test LandingPageBuilder initialization"""
        config = MockConfig()
        builder = LandingPageBuilder(config)
        
        assert builder.config == config
        assert builder.api_key == ""  # From os.getenv('HOSTING_API_KEY', '')
    
    def test_css_generation(self):
        """Test CSS generation with default palette"""
        config = MockConfig()
        builder = LandingPageBuilder(config)
        
        css = builder.generate_css()
        
        assert ":root" in css
        assert "--primary" in css
        assert "font-family" in css
    
    def test_build_page_structure(self):
        """Test page data structure building"""
        config = MockConfig()
        builder = LandingPageBuilder(config)
        
        page_data = builder.create_page()
        
        assert "Test Book" in page_data["title"]
        assert "Test Author" in page_data["title"]
        assert "sections" in page_data
        assert "styles" in page_data
        assert "scripts" in page_data


class TestEmotionPaletteEngine:
    """Test the EmotionPaletteEngine"""
    
    def test_emotion_detection(self):
        """Test emotion detection from text"""
        engine = EmotionPaletteEngine()
        
        # Test joy detection
        emotion, palette, mood = engine.detect_emotion("A bright sunny day full of laughter and happiness")
        assert emotion == "joyful"
        assert len(palette) == 3
        assert "#FFF9C4" in palette  # From joyful profile
        
        # Test mysterious detection (has more keywords matching in the test text)
        emotion, palette, mood = engine.detect_emotion("Dark shadows creeping in the mysterious night")
        assert emotion == "mysterious"
        assert "#263238" in palette  # From mysterious profile
        
        # Test brand detection
        emotion, palette, mood = engine.detect_emotion("Our brand new corporate logo")
        assert emotion == "brand"
        assert palette == ["#1A237E", "#45B3E7", "#863DFF"]
    
    def test_emotion_analysis(self):
        """Test detailed emotion analysis"""
        engine = EmotionPaletteEngine()
        
        analysis = engine.analyze_text_emotions("Happy and excited about the new adventure")
        
        assert "primary_emotion" in analysis
        assert "emotional_density" in analysis
        assert "keywords_found" in analysis
        assert analysis["emotional_density"] > 0
        assert "palette_formatted" in analysis


class TestOmniCreator:
    """Test the OmniCreator orchestration agent"""
    
    def test_initialization(self):
        """Test OmniCreator initialization"""
        config = BookConfig(
            book_title="Test Book",
            book_slug="test-book",
            author_name="Test Author",
            source_dir=str(TMP),
            target_domain="test.domain.com",
            primary_palette=["#1A237E", "#45B3E7"]
        )
        creator = OmniCreator(config)
        
        assert creator.config == config
        assert creator.manifest.status == "pending"
    
    @patch('pathlib.Path.glob')
    @patch('pathlib.Path.exists')
    def test_scan_chapters(self, mock_exists, mock_glob):
        """Test chapter scanning"""
        config = BookConfig(
            book_title="Test Book",
            book_slug="test-book",
            author_name="Test Author",
            source_dir="chapters"
        )
        creator = OmniCreator(config)
        
        # Mock that source directory exists
        mock_exists.return_value = True
        
        # Mock finding chapter files
        mock_glob.return_value = [
            Path("chapter-01-intro.md"),
            Path("chapter-02-story.md")
        ]
        
        chapters = creator.scan_chapters()
        
        assert len(chapters) == 2
        assert all(isinstance(ch, Path) for ch in chapters)
    
    def test_manifest_structure(self):
        """Test manifest data structure"""
        config = BookConfig(
            book_title="Test Book",
            book_slug="test-book",
            author_name="Test Author"
        )
        creator = OmniCreator(config)
        
        # Test the manifest object itself
        manifest = creator.manifest
        
        assert hasattr(manifest, "status")
        assert hasattr(manifest, "started_at")
        assert hasattr(manifest, "images_generated")
        assert hasattr(manifest, "errors")
        assert isinstance(manifest.images_generated, dict)
        assert isinstance(manifest.errors, list)


def test_agent_integration():
    """Test basic integration between agents"""
    # Test that agents can work together
    emotion_engine = EmotionPaletteEngine()
    prompt_agent = ImagePromptAgent()
    
    # Emotion engine provides palette
    emotion, palette, mood = emotion_engine.detect_emotion("A peaceful serene garden")
    
    # Prompt agent uses the palette (it will detect emotion internally)
    prompt_data = prompt_agent.build_prompt(
        raw_desc="A peaceful serene garden",
        provider="ideogram"
    )
    
    assert "garden" in prompt_data["prompt"].lower()
    assert "color:" in prompt_data["prompt"]  # Color injection from emotion engine
    assert "prompt" in prompt_data


if __name__ == "__main__":
    pytest.main([__file__, "-v"])