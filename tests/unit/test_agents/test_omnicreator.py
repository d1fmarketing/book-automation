#!/usr/bin/env python3
"""
Unit tests for OmniCreator
"""
import pytest
from unittest.mock import Mock, MagicMock, patch, mock_open
from pathlib import Path
import json
import sys
import os
from datetime import datetime

# Add src to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', '..'))
from src.ebook_pipeline.agents.omnicreator import OmniCreator, BookConfig, BuildManifest


class TestBookConfig:
    """Test suite for BookConfig dataclass"""
    
    def test_init_with_defaults(self):
        """Test BookConfig initialization with defaults"""
        config = BookConfig(
            book_title="Test Book",
            book_slug="test-book",
            author_name="Test Author"
        )
        
        assert config.book_title == "Test Book"
        assert config.book_slug == "test-book"
        assert config.author_name == "Test Author"
        assert config.source_dir == "chapters/"
        assert config.target_domain == ""
        assert config.primary_palette == []
        assert config.isbn  # Should have a UUID
        assert config.language == "en"
    
    def test_from_env(self):
        """Test BookConfig loading from environment variables"""
        env_vars = {
            'BOOK_TITLE': 'Env Book',
            'BOOK_SLUG': 'env-book',
            'AUTHOR_NAME': 'Env Author',
            'SOURCE_DIR': 'custom/chapters/',
            'TARGET_DOMAIN': 'books.example.com',
            'PRIMARY_PALETTE': '["#FF0000", "#00FF00", "#0000FF"]'
        }
        
        with patch.dict(os.environ, env_vars):
            config = BookConfig.from_env()
            
            assert config.book_title == 'Env Book'
            assert config.book_slug == 'env-book'
            assert config.author_name == 'Env Author'
            assert config.source_dir == 'custom/chapters/'
            assert config.target_domain == 'books.example.com'
            assert config.primary_palette == ["#FF0000", "#00FF00", "#0000FF"]
    
    def test_from_env_defaults(self):
        """Test BookConfig.from_env with missing environment variables"""
        with patch.dict(os.environ, {}, clear=True):
            config = BookConfig.from_env()
            
            assert config.book_title == 'Untitled Book'
            assert config.book_slug == 'untitled-book'
            assert config.author_name == 'Anonymous'
            assert config.source_dir == 'chapters/'
            assert config.target_domain == ''
            assert config.primary_palette == []
    
    def test_from_env_invalid_json_palette(self):
        """Test BookConfig.from_env with invalid JSON palette"""
        with patch.dict(os.environ, {'PRIMARY_PALETTE': 'invalid json'}):
            config = BookConfig.from_env()
            assert config.primary_palette == []


class TestBuildManifest:
    """Test suite for BuildManifest dataclass"""
    
    def test_init_defaults(self):
        """Test BuildManifest initialization with defaults"""
        manifest = BuildManifest()
        
        assert manifest.status == "pending"
        assert manifest.started_at  # Should have ISO timestamp
        assert manifest.completed_at is None
        assert manifest.ebook_path is None
        assert manifest.pdf_path is None
        assert manifest.landing_page_url is None
        assert manifest.images_generated == {}
        assert manifest.errors == []
    
    def test_save(self):
        """Test BuildManifest save functionality"""
        manifest = BuildManifest(
            status="success",
            ebook_path="dist/book.epub",
            pdf_path="dist/book.pdf"
        )
        
        with patch('builtins.open', mock_open()) as mock_file:
            manifest.save("test_manifest.json")
            
            mock_file.assert_called_once_with("test_manifest.json", 'w')
            
            # Get what was written
            written_data = ''.join(
                call.args[0] for call in mock_file().write.call_args_list
            )
            
            # Verify it's valid JSON with correct data
            parsed = json.loads(written_data)
            assert parsed['status'] == "success"
            assert parsed['ebook_path'] == "dist/book.epub"
            assert parsed['pdf_path'] == "dist/book.pdf"


class TestOmniCreator:
    """Test suite for OmniCreator main class"""
    
    @pytest.fixture
    def config(self):
        """Create test configuration"""
        return BookConfig(
            book_title="Test Book",
            book_slug="test-book",
            author_name="Test Author",
            target_domain="books.example.com",
            primary_palette=["#FF0000", "#00FF00"]
        )
    
    @pytest.fixture
    def creator(self, config):
        """Create OmniCreator instance"""
        with patch('pathlib.Path.mkdir'):
            return OmniCreator(config)
    
    def test_init(self, config):
        """Test OmniCreator initialization"""
        with patch('pathlib.Path.mkdir') as mock_mkdir:
            creator = OmniCreator(config)
            
            assert creator.config == config
            assert isinstance(creator.manifest, BuildManifest)
            
            # Check directories were created
            assert mock_mkdir.call_count == 3  # dist, logs, assets/images/{slug}
    
    def test_ensure_directories(self, creator):
        """Test directory creation"""
        with patch('pathlib.Path.mkdir') as mock_mkdir:
            creator.ensure_directories()
            
            # Check that mkdir was called 3 times
            assert mock_mkdir.call_count == 3
    
    def test_scan_chapters_success(self, creator):
        """Test successful chapter scanning"""
        mock_chapters = [
            Path("chapters/chapter1.md"),
            Path("chapters/chapter2.md"),
            Path("chapters/chapter3.md")
        ]
        
        with patch('pathlib.Path.exists', return_value=True):
            with patch('pathlib.Path.glob', return_value=mock_chapters):
                chapters = creator.scan_chapters()
                
                assert len(chapters) == 3
                assert chapters == mock_chapters
    
    def test_scan_chapters_directory_not_found(self, creator):
        """Test chapter scanning when directory doesn't exist"""
        with patch('pathlib.Path.exists', return_value=False):
            with pytest.raises(FileNotFoundError, match="Source directory not found"):
                creator.scan_chapters()
    
    def test_process_images(self, creator):
        """Test image processing for chapters"""
        chapters = [Path("chapter1.md"), Path("chapter2.md")]
        
        # Mock the imports within the method
        mock_agent_module = Mock()
        mock_agent_module.ImagePromptAgent = Mock
        mock_gen_module = Mock()
        mock_gen_module.ImageGenerator = Mock
        
        with patch.dict('sys.modules', {
            'ebook_pipeline.agents.image_prompt_agent': mock_agent_module,
            'scripts.generate_images': mock_gen_module
        }):
            mock_gen_instance = Mock()
            mock_gen_module.ImageGenerator.return_value = mock_gen_instance
            
            result = creator.process_images(chapters)
            
            # Check generator was initialized
            mock_gen_module.ImageGenerator.assert_called_once_with(skip_existing=True)
            
            # Check each chapter was processed
            assert mock_gen_instance.process_file.call_count == 2
    
    def test_generate_ebook(self, creator):
        """Test ebook generation"""
        chapters = [Path("chapter1.md")]
        
        with patch('src.ebook_pipeline.agents.book_builder.BookBuilder') as mock_builder_class:
            mock_builder = Mock()
            mock_builder.create_epub.return_value = "dist/test-book.epub"
            mock_builder.create_pdf.return_value = "dist/test-book.pdf"
            mock_builder_class.return_value = mock_builder
            
            epub_path, pdf_path = creator.generate_ebook(chapters)
            
            assert epub_path == "dist/test-book.epub"
            assert pdf_path == "dist/test-book.pdf"
            
            mock_builder.create_epub.assert_called_once_with(chapters)
            mock_builder.create_pdf.assert_called_once_with(chapters)
    
    def test_create_landing_page(self, creator):
        """Test landing page creation"""
        with patch('src.ebook_pipeline.agents.landing_page_builder.LandingPageBuilder') as mock_builder_class:
            mock_builder = Mock()
            mock_builder.create_page.return_value = {'page': 'data'}
            mock_builder.deploy.return_value = "https://books.example.com/test-book"
            mock_builder_class.return_value = mock_builder
            
            url = creator.create_landing_page()
            
            assert url == "https://books.example.com/test-book"
            mock_builder.create_page.assert_called_once()
            mock_builder.deploy.assert_called_once_with({'page': 'data'})
    
    def test_run_success(self, creator):
        """Test successful pipeline run"""
        mock_chapters = [Path("chapter1.md")]
        
        with patch.object(creator, 'scan_chapters', return_value=mock_chapters):
            with patch.object(creator, 'process_images'):
                with patch.object(creator, 'generate_ebook', return_value=("book.epub", "book.pdf")):
                    with patch.object(creator, 'create_landing_page', return_value="https://example.com"):
                        with patch.object(creator.manifest, 'save'):
                            manifest = creator.run()
                            
                            assert manifest.status == "success"
                            assert manifest.ebook_path == "book.epub"
                            assert manifest.pdf_path == "book.pdf"
                            assert manifest.landing_page_url == "https://example.com"
                            assert manifest.completed_at is not None
                            creator.manifest.save.assert_called_once()
    
    def test_run_without_target_domain(self, creator):
        """Test pipeline run without target domain (no landing page)"""
        creator.config.target_domain = ""
        mock_chapters = [Path("chapter1.md")]
        
        with patch.object(creator, 'scan_chapters', return_value=mock_chapters):
            with patch.object(creator, 'process_images'):
                with patch.object(creator, 'generate_ebook', return_value=("book.epub", "book.pdf")):
                    with patch.object(creator, 'create_landing_page') as mock_landing:
                        with patch.object(creator.manifest, 'save'):
                            manifest = creator.run()
                            
                            # Landing page should not be created
                            mock_landing.assert_not_called()
                            assert manifest.landing_page_url is None
                            assert manifest.status == "success"
    
    def test_run_failure(self, creator):
        """Test pipeline run with failure"""
        with patch.object(creator, 'scan_chapters', side_effect=Exception("Scan failed")):
            with patch.object(creator.manifest, 'save'):
                manifest = creator.run()
                
                assert manifest.status == "error"
                assert len(manifest.errors) == 1
                assert "Scan failed" in manifest.errors[0]
                creator.manifest.save.assert_called_once()
    
    def test_logging(self, creator):
        """Test that appropriate logging occurs"""
        with patch('src.ebook_pipeline.agents.omnicreator.logger') as mock_logger:
            # Test successful run logging
            with patch.object(creator, 'scan_chapters', return_value=[]):
                with patch.object(creator, 'process_images'):
                    with patch.object(creator, 'generate_ebook', return_value=(None, None)):
                        with patch.object(creator.manifest, 'save'):
                            creator.run()
                            
                            # Check initial log
                            mock_logger.info.assert_any_call(
                                "OmniCreator-X starting for: Test Book"
                            )
            
            # Test error logging
            with patch.object(creator, 'scan_chapters', side_effect=Exception("Error")):
                with patch.object(creator.manifest, 'save'):
                    creator.run()
                    mock_logger.error.assert_called()


class TestMain:
    """Test suite for main entry point"""
    
    def test_main_success(self):
        """Test main function with successful run"""
        with patch('src.ebook_pipeline.agents.omnicreator.BookConfig.from_env') as mock_config:
            with patch('src.ebook_pipeline.agents.omnicreator.OmniCreator') as mock_creator_class:
                mock_manifest = BuildManifest(
                    status="success",
                    ebook_path="book.epub",
                    pdf_path="book.pdf",
                    landing_page_url="https://example.com"
                )
                
                mock_creator = Mock()
                mock_creator.run.return_value = mock_manifest
                mock_creator_class.return_value = mock_creator
                
                with patch('builtins.print') as mock_print:
                    with patch('sys.exit') as mock_exit:
                        from src.ebook_pipeline.agents.omnicreator import main
                        main()
                        
                        # Check output
                        mock_print.assert_any_call("\nstatus: success")
                        mock_print.assert_any_call("ebook: book.epub")
                        mock_print.assert_any_call("pdf: book.pdf")
                        mock_print.assert_any_call("landing_page: https://example.com")
                        
                        # Check successful exit
                        mock_exit.assert_called_once_with(0)
    
    def test_main_failure(self):
        """Test main function with failed run"""
        with patch('src.ebook_pipeline.agents.omnicreator.BookConfig.from_env') as mock_config:
            with patch('src.ebook_pipeline.agents.omnicreator.OmniCreator') as mock_creator_class:
                mock_manifest = BuildManifest(
                    status="error",
                    errors=["Something went wrong"]
                )
                
                mock_creator = Mock()
                mock_creator.run.return_value = mock_manifest
                mock_creator_class.return_value = mock_creator
                
                with patch('builtins.print'):
                    with patch('sys.exit') as mock_exit:
                        from src.ebook_pipeline.agents.omnicreator import main
                        main()
                        
                        # Check failure exit
                        mock_exit.assert_called_once_with(1)