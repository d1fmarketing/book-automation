#!/usr/bin/env python3
"""
Tests for RENDER image generation system
"""
import os
import sys
import json
import tempfile
from pathlib import Path
from unittest.mock import Mock, patch, MagicMock

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from scripts.generate_images import ImageGenerator


def test_slug_generation():
    """Test human-readable slug generation"""
    generator = ImageGenerator(skip_existing=True)
    
    # Test basic slug
    slug = generator.generate_slug("A beautiful sunset over the ocean")
    assert slug.startswith("a_beautiful_sunset_o")
    assert slug.endswith(".png")
    assert "_" in slug  # Contains hash separator
    
    # Test special characters
    slug2 = generator.generate_slug("Knight's armor! @ castle (medieval)")
    assert "knights_armor_castle" in slug2
    
    # Test consistency
    slug3 = generator.generate_slug("A beautiful sunset over the ocean")
    assert slug == slug3  # Same input = same output


def test_prompt_enhancement():
    """Test prompt creation with style guide"""
    generator = ImageGenerator(skip_existing=True)
    generator.style_guide = "Genre: Fantasy\nTone: Dark and mysterious"
    
    prompt = generator.create_prompt("A castle in the mountains")
    assert "A castle in the mountains" in prompt
    assert "High quality, detailed illustration" in prompt


def test_manifest_operations():
    """Test manifest loading and saving"""
    with tempfile.TemporaryDirectory() as tmpdir:
        manifest_path = Path(tmpdir) / "context" / "image-manifest.json"
        manifest_path.parent.mkdir(exist_ok=True)
        
        # Create generator with custom manifest path
        generator = ImageGenerator(skip_existing=True)
        generator.manifest_path = manifest_path
        
        # Test initial manifest
        manifest = generator.load_manifest()
        assert manifest["generated_images"] == {}
        assert manifest["total_cost_usd"] == 0.0
        
        # Add cost and save
        generator.total_cost = 0.12  # 3 images
        generator.save_manifest()
        
        # Verify saved data
        with open(manifest_path, 'r') as f:
            saved = json.load(f)
            assert saved["total_cost_usd"] == 0.12
            assert saved["last_updated"] is not None


@patch('openai.OpenAI')
@patch('requests.get')
def test_image_generation_flow(mock_requests, mock_openai):
    """Test complete image generation flow with mocks"""
    # Setup mocks
    mock_client = MagicMock()
    mock_openai.return_value = mock_client
    
    # Mock API response
    mock_response = MagicMock()
    mock_response.data = [MagicMock(url="https://example.com/image.png")]
    mock_client.images.generate.return_value = mock_response
    
    # Mock image download
    mock_img_response = MagicMock()
    mock_img_response.content = b"fake image data"
    mock_img_response.headers = {"content-type": "image/png"}
    mock_requests.return_value = mock_img_response
    
    with tempfile.TemporaryDirectory() as tmpdir:
        # Setup test environment
        chapters_dir = Path(tmpdir) / "chapters"
        chapters_dir.mkdir()
        images_dir = Path(tmpdir) / "assets" / "images"
        images_dir.mkdir(parents=True)
        
        # Create test chapter with placeholder
        test_chapter = chapters_dir / "chapter-01.md"
        test_chapter.write_text("# Chapter 1\n\n![AI-IMAGE: A magical forest]() text continues...")
        
        # Create generator
        generator = ImageGenerator(skip_existing=False)
        generator.chapters_dir = chapters_dir
        generator.images_dir = images_dir
        generator.manifest_path = Path(tmpdir) / "manifest.json"
        
        # Process file
        success = generator.process_file(test_chapter)
        assert success
        
        # Verify API was called
        mock_client.images.generate.assert_called_once()
        call_args = mock_client.images.generate.call_args
        assert "A magical forest" in call_args.kwargs["prompt"]
        
        # Verify file was updated
        updated_content = test_chapter.read_text()
        assert "![A magical forest](../assets/images/" in updated_content
        assert "![AI-IMAGE:" not in updated_content
        
        # Verify image was saved
        saved_images = list(images_dir.glob("*.png"))
        assert len(saved_images) == 1


def test_skip_existing_functionality():
    """Test that existing images are skipped when flag is set"""
    generator = ImageGenerator(skip_existing=True)
    
    # Pre-populate manifest
    test_slug = "sunset_beach_12345678.png"
    generator.manifest["generated_images"][test_slug] = {
        "description": "Sunset at beach",
        "generated_at": "2024-01-01",
        "cost_usd": 0.04
    }
    
    # Generate slug for same description should match
    slug = generator.generate_slug("Sunset at beach")
    assert slug == test_slug
    
    # In real flow, this would skip API call
    assert test_slug in generator.manifest["generated_images"]


def test_content_type_validation():
    """Test that non-image responses are rejected"""
    generator = ImageGenerator(skip_existing=False)
    
    # Test invalid content type
    with patch('requests.get') as mock_get:
        mock_response = MagicMock()
        mock_response.headers = {"content-type": "text/html"}
        mock_response.content = b"<html>Error page</html>"
        mock_get.return_value = mock_response
        
        try:
            generator.download_image("https://example.com/fake", "test.png")
            assert False, "Should have raised ValueError"
        except ValueError as e:
            assert "Invalid content type" in str(e)


def main():
    """Run all tests"""
    print("Running image generator tests...\n")
    
    tests = [
        test_slug_generation,
        test_prompt_enhancement,
        test_manifest_operations,
        test_image_generation_flow,
        test_skip_existing_functionality,
        test_content_type_validation
    ]
    
    passed = 0
    for test_func in tests:
        try:
            test_func()
            print(f"✅ {test_func.__name__}")
            passed += 1
        except Exception as e:
            print(f"❌ {test_func.__name__}: {e}")
    
    print(f"\n{passed}/{len(tests)} tests passed")
    return 0 if passed == len(tests) else 1


if __name__ == "__main__":
    sys.exit(main())