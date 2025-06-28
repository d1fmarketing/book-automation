#!/usr/bin/env python3
"""
Unit tests for BookBuilder
"""
import pytest
from unittest.mock import Mock, MagicMock, patch, mock_open
from pathlib import Path
import subprocess
import sys
import os

# Add src to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', '..'))
from src.ebook_pipeline.agents.book_builder import BookBuilder


class TestBookBuilder:
    """Test suite for BookBuilder"""
    
    @pytest.fixture
    def mock_config(self):
        """Create a mock configuration object"""
        config = Mock()
        config.book_title = "Test Book"
        config.author_name = "Test Author"
        config.language = "en"
        config.isbn = "978-0-123456-78-9"
        config.book_slug = "test-book"
        return config
    
    @pytest.fixture
    def builder(self, mock_config):
        """Create a BookBuilder instance with mocked config"""
        with patch('pathlib.Path.mkdir'):
            return BookBuilder(mock_config)
    
    def test_init(self, mock_config):
        """Test BookBuilder initialization"""
        with patch('pathlib.Path.mkdir') as mock_mkdir:
            builder = BookBuilder(mock_config)
            
            assert builder.config == mock_config
            assert builder.dist_dir == Path("dist")
            mock_mkdir.assert_called_once_with(exist_ok=True)
    
    def test_create_metadata(self, builder):
        """Test metadata creation"""
        metadata = builder.create_metadata()
        
        assert metadata['title'] == "Test Book"
        assert metadata['author'] == "Test Author"
        assert metadata['language'] == "en"
        assert metadata['identifier'] == "isbn:978-0-123456-78-9"
        assert metadata['publisher'] == "Test Author Publishing"
        assert metadata['date'] == "2025"
        assert "© 2025 Test Author" in metadata['rights']
    
    def test_generate_cover_with_book_specific_images(self, builder):
        """Test cover generation with book-specific image directory"""
        with patch('pathlib.Path.exists') as mock_exists:
            with patch('pathlib.Path.glob') as mock_glob:
                # Book-specific directory exists
                mock_exists.return_value = True
                mock_glob.return_value = [Path("assets/images/test-book/cover.png")]
                
                cover = builder.generate_cover()
                assert cover == Path("assets/images/test-book/cover.png")
    
    def test_generate_cover_fallback_to_general_images(self, builder):
        """Test cover generation fallback to general images directory"""
        with patch('pathlib.Path.exists') as mock_exists:
            with patch('pathlib.Path.glob') as mock_glob:
                # First call to exists (book-specific dir) returns False
                # Second call to exists (general dir) would return True but isn't checked
                mock_exists.side_effect = [False]
                
                # When book-specific doesn't exist, we check general images dir
                # Mock Path("assets/images").glob("*.png") to return an image
                mock_glob.return_value = [Path("assets/images/generic-cover.png")]
                
                cover = builder.generate_cover()
                assert cover == Path("assets/images/generic-cover.png")
    
    def test_generate_cover_no_images(self, builder):
        """Test cover generation when no images are found"""
        with patch('pathlib.Path.exists', return_value=True):
            with patch('pathlib.Path.glob', return_value=[]):
                cover = builder.generate_cover()
                assert cover is None
    
    def test_create_epub_success(self, builder):
        """Test successful EPUB creation"""
        chapters = [Path("chapter1.md"), Path("chapter2.md")]
        
        with patch('builtins.open', mock_open()) as mock_file:
            with patch('subprocess.run') as mock_run:
                with patch.object(builder, 'generate_cover', return_value=Path("cover.png")):
                    with patch('pathlib.Path.unlink'):
                        # Mock successful subprocess run
                        mock_run.return_value = Mock(returncode=0, stderr="")
                        
                        result = builder.create_epub(chapters)
                        
                        # Check metadata file was written
                        mock_file.assert_called()
                        
                        # Check pandoc was called with correct arguments
                        mock_run.assert_called_once()
                        call_args = mock_run.call_args[0][0]
                        
                        assert "pandoc" in call_args
                        assert "--from" in call_args
                        assert "markdown" in call_args
                        assert "--to" in call_args
                        assert "epub3" in call_args
                        assert "--epub-cover-image" in call_args
                        assert str(Path("dist/test-book.epub")) in call_args
                        
                        # Check chapters were added
                        assert "chapter1.md" in call_args
                        assert "chapter2.md" in call_args
                        
                        assert result == str(Path("dist/test-book.epub"))
    
    def test_create_epub_pandoc_failure(self, builder):
        """Test EPUB creation when pandoc fails"""
        chapters = [Path("chapter1.md")]
        
        with patch('builtins.open', mock_open()):
            with patch('subprocess.run') as mock_run:
                with patch('pathlib.Path.unlink'):
                    # Mock failed subprocess run
                    mock_run.return_value = Mock(returncode=1, stderr="Pandoc error")
                    
                    result = builder.create_epub(chapters)
                    
                    assert result is None
    
    def test_create_epub_exception_handling(self, builder):
        """Test EPUB creation exception handling"""
        chapters = [Path("chapter1.md")]
        
        with patch('builtins.open', side_effect=Exception("File error")):
            result = builder.create_epub(chapters)
            assert result is None
    
    def test_create_pdf_with_puppeteer(self, builder):
        """Test PDF creation using Puppeteer script"""
        chapters = [Path("chapter1.md"), Path("chapter2.md")]
        
        with patch('pathlib.Path.exists') as mock_exists:
            with patch('subprocess.run') as mock_run:
                # Mock that Puppeteer script exists and PDF is created
                mock_exists.side_effect = lambda: True
                
                # Mock successful subprocess run
                mock_run.return_value = Mock(returncode=0)
                
                result = builder.create_pdf(chapters)
                
                # Check node was called with the script
                mock_run.assert_called_once()
                call_args = mock_run.call_args[0][0]
                assert call_args == ["node", "scripts/generate-pdf-puppeteer.js"]
                
                assert result == str(Path("dist/test-book.pdf"))
    
    def test_create_pdf_fallback_to_pandoc(self, builder):
        """Test PDF creation fallback to pandoc when Puppeteer fails"""
        chapters = [Path("chapter1.md"), Path("chapter2.md")]
        
        with patch('pathlib.Path.exists', return_value=False):
            with patch('subprocess.run') as mock_run:
                # Mock successful pandoc run
                mock_run.return_value = Mock(returncode=0)
                
                result = builder.create_pdf(chapters)
                
                # Check pandoc was called
                mock_run.assert_called_once()
                call_args = mock_run.call_args[0][0]
                
                assert "pandoc" in call_args
                assert "--pdf-engine" in call_args
                assert "xelatex" in call_args
                assert str(Path("dist/test-book.pdf")) in call_args
                
                # Check metadata was added
                assert "-M" in call_args
                assert "title=Test Book" in call_args
                assert "author=Test Author" in call_args
                
                assert result == str(Path("dist/test-book.pdf"))
    
    def test_create_pdf_failure(self, builder):
        """Test PDF creation when both methods fail"""
        chapters = [Path("chapter1.md")]
        
        with patch('pathlib.Path.exists', return_value=False):
            with patch('subprocess.run') as mock_run:
                # Mock failed subprocess run
                mock_run.return_value = Mock(returncode=1, stderr="PDF generation failed")
                
                result = builder.create_pdf(chapters)
                
                assert result is None
    
    def test_create_pdf_exception_handling(self, builder):
        """Test PDF creation exception handling"""
        chapters = [Path("chapter1.md")]
        
        with patch('pathlib.Path.exists', side_effect=Exception("Path error")):
            result = builder.create_pdf(chapters)
            assert result is None
    
    def test_logging(self, builder):
        """Test that appropriate logging occurs"""
        with patch('src.ebook_pipeline.agents.book_builder.logger') as mock_log:
            # Test successful EPUB creation logging
            with patch('builtins.open', mock_open()):
                with patch('subprocess.run') as mock_run:
                    with patch('pathlib.Path.unlink'):
                        mock_run.return_value = Mock(returncode=0)
                        
                        builder.create_epub([Path("test.md")])
                        
                        # Check info logging occurred
                        assert mock_log.info.called
                        
                        # Test error logging
                        mock_run.return_value = Mock(returncode=1, stderr="Error")
                        builder.create_epub([Path("test.md")])
                        
                        assert mock_log.error.called