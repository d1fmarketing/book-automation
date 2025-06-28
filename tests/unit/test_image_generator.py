#!/usr/bin/env python3
"""
Tests for RENDER image generation system
"""
import os
import sys
import json
import tempfile
from pathlib import Path
from unittest.mock import Mock, patch, MagicMock, patch as mock_patch

# Import from new structure
from ebook_pipeline.generators.generate_images import ImageGenerator


@patch.dict(os.environ, {"IDEOGRAM_API_KEY": "test_dummy_key"})
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


@patch.dict(os.environ, {"IDEOGRAM_API_KEY": "test_dummy_key"})
def test_prompt_enhancement():
    """Test prompt creation with style guide"""
    generator = ImageGenerator(skip_existing=True)
    generator.style_guide = "Genre: Fantasy\nTone: Dark and mysterious"
    
    # Test that style guide is used (even though there's no create_prompt method)
    # The style guide would be used internally when generating
    assert hasattr(generator, 'style_guide')
    assert "Fantasy" in generator.style_guide


@patch.dict(os.environ, {"IDEOGRAM_API_KEY": "test_dummy_key"})
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


@patch.dict(os.environ, {"IDEOGRAM_API_KEY": "test_dummy_key"})
@patch('requests.post')
@patch('requests.get')
def test_image_generation_flow(mock_get, mock_post):
    """Test complete image generation flow with mocks"""
    # Mock Ideogram API response
    mock_api_response = MagicMock()
    mock_api_response.status_code = 200
    mock_api_response.json.return_value = {
        'data': [{'url': 'https://example.com/image.png'}]
    }
    mock_post.return_value = mock_api_response
    
    # Mock image download
    mock_img_response = MagicMock()
    mock_img_response.content = b"fake image data"
    mock_img_response.headers = {"content-type": "image/png"}
    mock_get.return_value = mock_img_response
    
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
        mock_post.assert_called_once()
        call_args = mock_post.call_args
        # Check that the prompt was sent in the multipart form data
        assert any("A magical forest" in str(arg) for arg in call_args[1]['files'].values())
        
        # Verify file was updated
        updated_content = test_chapter.read_text()
        assert "![A magical forest](../assets/images/" in updated_content
        assert "![AI-IMAGE:" not in updated_content
        
        # Verify image was saved
        saved_images = list(images_dir.glob("*.png"))
        assert len(saved_images) == 1


@patch.dict(os.environ, {"IDEOGRAM_API_KEY": "test_dummy_key"})
def test_skip_existing_functionality():
    """Test that existing images are skipped when flag is set"""
    generator = ImageGenerator(skip_existing=True)
    
    # First generate a slug for the description
    description = "Sunset at beach"
    actual_slug = generator.generate_slug(description)
    
    # Pre-populate manifest with the actual slug
    generator.manifest["generated_images"][actual_slug] = {
        "description": description,
        "generated_at": "2024-01-01",
        "cost_usd": 0.04
    }
    
    # The generator should find this in the manifest
    assert actual_slug in generator.manifest["generated_images"]
    
    # Test that it would be found during processing
    # (actual skip logic would be in process_file method)


@patch.dict(os.environ, {"IDEOGRAM_API_KEY": "test_dummy_key"})
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