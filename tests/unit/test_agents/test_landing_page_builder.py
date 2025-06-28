#!/usr/bin/env python3
"""
Unit tests for LandingPageBuilder
"""
import pytest
from unittest.mock import Mock, patch, mock_open
from pathlib import Path
import sys
import os

# Add src to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', '..'))
from src.ebook_pipeline.agents.landing_page_builder import LandingPageBuilder


class TestLandingPageBuilder:
    """Test suite for LandingPageBuilder"""
    
    @pytest.fixture
    def mock_config(self):
        """Create a mock configuration object"""
        config = Mock()
        config.book_title = "Amazing Book"
        config.author_name = "Jane Doe"
        config.book_slug = "amazing-book"
        config.primary_palette = ["#1A237E", "#45B3E7", "#863DFF"]
        config.target_domain = "books.example.com"
        return config
    
    @pytest.fixture
    def builder(self, mock_config):
        """Create a LandingPageBuilder instance"""
        with patch.dict(os.environ, {'HOSTING_API_KEY': 'test-key'}):
            return LandingPageBuilder(mock_config)
    
    def test_init(self, mock_config):
        """Test LandingPageBuilder initialization"""
        # Test with API key
        with patch.dict(os.environ, {'HOSTING_API_KEY': 'test-key'}):
            builder = LandingPageBuilder(mock_config)
            assert builder.config == mock_config
            assert builder.api_key == 'test-key'
        
        # Test without API key
        with patch.dict(os.environ, {}, clear=True):
            builder = LandingPageBuilder(mock_config)
            assert builder.api_key == ''
    
    def test_get_hero_image_book_specific(self, builder):
        """Test hero image retrieval from book-specific directory"""
        with patch('pathlib.Path.exists') as mock_exists:
            with patch('pathlib.Path.glob') as mock_glob:
                # Book-specific directory exists
                mock_exists.return_value = True
                mock_glob.return_value = [Path("assets/images/amazing-book/hero.png")]
                
                image = builder.get_hero_image()
                assert image == "assets/images/amazing-book/hero.png"
    
    def test_get_hero_image_fallback(self, builder):
        """Test hero image retrieval fallback to general directory"""
        with patch('pathlib.Path.exists') as mock_exists:
            with patch('pathlib.Path.glob') as mock_glob:
                # Book-specific directory doesn't exist
                mock_exists.return_value = False
                
                # First glob for *hero* returns nothing
                # Second glob for *cover* returns a cover image
                mock_glob.side_effect = [
                    [],  # No hero images
                    [Path("assets/images/cover.png")]  # Found cover
                ]
                
                image = builder.get_hero_image()
                assert str(image) == "assets/images/cover.png"
    
    def test_get_hero_image_none(self, builder):
        """Test hero image retrieval when no images found"""
        with patch('pathlib.Path.exists', return_value=True):
            with patch('pathlib.Path.glob', return_value=[]):
                image = builder.get_hero_image()
                assert image is None
    
    def test_generate_css(self, builder):
        """Test CSS generation with custom colors"""
        css = builder.generate_css()
        
        # Check custom colors are used
        assert "--primary: #1A237E" in css
        assert "--secondary: #45B3E7" in css
        
        # Check essential CSS rules
        assert ":root" in css
        assert "[data-theme=\"dark\"]" in css
        assert ".hero" in css
        assert ".cta" in css
        assert ".container" in css
        assert "@media" in css
    
    def test_generate_css_default_colors(self, mock_config):
        """Test CSS generation with default colors when no palette provided"""
        mock_config.primary_palette = []
        builder = LandingPageBuilder(mock_config)
        
        css = builder.generate_css()
        assert "--primary: #1a1a1a" in css
        assert "--secondary: #007bff" in css
    
    def test_create_page(self, builder):
        """Test page data creation"""
        with patch.object(builder, 'get_hero_image', return_value="hero.png"):
            page_data = builder.create_page()
            
            # Check basic structure
            assert page_data['title'] == "Amazing Book - by Jane Doe"
            assert page_data['slug'] == "amazing-book"
            assert 'sections' in page_data
            assert 'styles' in page_data
            assert 'scripts' in page_data
            
            # Check sections
            sections = page_data['sections']
            assert len(sections) == 4
            
            # Check hero section
            hero = sections[0]
            assert hero['type'] == 'hero'
            assert hero['content']['headline'] == "Amazing Book"
            assert "Jane Doe" in hero['content']['subheadline']
            assert hero['content']['background_image'] == "hero.png"
            
            # Check benefits section
            benefits = sections[1]
            assert benefits['type'] == 'benefits'
            assert len(benefits['content']['items']) == 3
            
            # Check author section
            author = sections[2]
            assert author['type'] == 'author'
            assert "Jane Doe" in author['content']['headline']
            
            # Check CTA section
            cta = sections[3]
            assert cta['type'] == 'cta'
            assert "/dist/amazing-book.epub" in cta['content']['primary_link']
            assert "/dist/amazing-book.pdf" in cta['content']['secondary_link']
    
    def test_generate_html(self, builder):
        """Test HTML generation from page data"""
        page_data = {
            'title': 'Test Book',
            'styles': 'body { color: black; }',
            'scripts': 'console.log("test");',
            'sections': [
                {
                    'type': 'hero',
                    'content': {
                        'headline': 'Test Headline',
                        'subheadline': 'Test Sub',
                        'cta_text': 'Click Me',
                        'cta_link': '#test'
                    }
                },
                {
                    'type': 'benefits',
                    'content': {
                        'headline': 'Benefits',
                        'items': [
                            {
                                'title': 'Benefit 1',
                                'description': 'Description 1'
                            }
                        ]
                    }
                }
            ]
        }
        
        html = builder.generate_html(page_data)
        
        # Check HTML structure
        assert '<!DOCTYPE html>' in html
        assert '<html lang="en">' in html
        assert '<title>Test Book</title>' in html
        assert 'body { color: black; }' in html
        assert 'console.log("test");' in html
        
        # Check sections rendered
        assert 'Test Headline' in html
        assert 'Test Sub' in html
        assert 'Click Me' in html
        assert 'Benefits' in html
        assert 'Benefit 1' in html
        assert 'Description 1' in html
        
        # Check theme toggle
        assert 'theme-toggle' in html
    
    def test_deploy_no_domain(self, mock_config):
        """Test deployment when no target domain is specified"""
        mock_config.target_domain = ""
        builder = LandingPageBuilder(mock_config)
        
        page_data = {'test': 'data'}
        result = builder.deploy(page_data)
        
        assert result is None
    
    def test_deploy_local_save(self, builder):
        """Test local deployment saves HTML file"""
        page_data = {
            'title': 'Test',
            'styles': '',
            'scripts': '',
            'sections': []
        }
        
        with patch('pathlib.Path.write_text') as mock_write:
            with patch.object(builder, 'generate_html', return_value="<html>test</html>"):
                result = builder.deploy(page_data)
                
                # Check file was written
                mock_write.assert_called_once_with("<html>test</html>")
                
                # Check URL returned (should be simulated deployment URL)
                assert result == "https://books.example.com/amazing-book"
    
    def test_deploy_without_api_key(self, mock_config):
        """Test deployment without API key returns local file URL"""
        with patch.dict(os.environ, {}, clear=True):
            builder = LandingPageBuilder(mock_config)
            
            page_data = {
                'title': 'Test',
                'styles': '',
                'scripts': '',
                'sections': []
            }
            
            with patch('builtins.open', mock_open()):
                with patch.object(builder, 'generate_html', return_value="<html>test</html>"):
                    with patch('pathlib.Path.absolute', return_value=Path("/absolute/path/to/file.html")):
                        result = builder.deploy(page_data)
                        
                        assert result == "file:///absolute/path/to/file.html"
    
    def test_deploy_exception_handling(self, builder):
        """Test deployment exception handling"""
        page_data = {'test': 'data'}
        
        with patch.object(builder, 'generate_html', side_effect=Exception("Generation failed")):
            result = builder.deploy(page_data)
            
            assert result is None
    
    def test_logging(self, builder):
        """Test that appropriate logging occurs"""
        with patch('src.ebook_pipeline.agents.landing_page_builder.logger') as mock_log:
            # Test warning when no domain
            builder.config.target_domain = ""
            builder.deploy({'test': 'data'})
            mock_log.warning.assert_called()
            
            # Test info logging on successful save
            builder.config.target_domain = "example.com"
            with patch('pathlib.Path.write_text'):
                with patch.object(builder, 'generate_html', return_value="<html></html>"):
                    builder.deploy({'test': 'data'})
                    assert mock_log.info.called
            
            # Test error logging on exception
            with patch.object(builder, 'generate_html', side_effect=Exception("Error")):
                builder.deploy({'test': 'data'})
                mock_log.error.assert_called()