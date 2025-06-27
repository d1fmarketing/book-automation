#!/usr/bin/env python3
"""
OmniCreator-X: Universal Book-to-Everything Pipeline
Transforms Markdown → EPUB/PDF → Landing Page
"""
import os
import sys
import json
import uuid
import logging
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, field

# Ensure logs directory exists
Path('logs').mkdir(exist_ok=True)

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('logs/omnicreator.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger('OmniCreator-X')

@dataclass
class BookConfig:
    """Configuration for book generation"""
    book_title: str
    book_slug: str
    author_name: str
    source_dir: str = "chapters/"
    target_domain: str = ""
    primary_palette: List[str] = field(default_factory=list)
    isbn: str = field(default_factory=lambda: str(uuid.uuid4()))
    language: str = "en"
    
    @classmethod
    def from_env(cls) -> 'BookConfig':
        """Load configuration from environment variables"""
        palette = os.getenv('PRIMARY_PALETTE', '[]')
        try:
            palette_list = json.loads(palette) if palette else []
        except:
            palette_list = []
            
        return cls(
            book_title=os.getenv('BOOK_TITLE', 'Untitled Book'),
            book_slug=os.getenv('BOOK_SLUG', 'untitled-book'),
            author_name=os.getenv('AUTHOR_NAME', 'Anonymous'),
            source_dir=os.getenv('SOURCE_DIR', 'chapters/'),
            target_domain=os.getenv('TARGET_DOMAIN', ''),
            primary_palette=palette_list
        )


@dataclass
class BuildManifest:
    """Track build process and outputs"""
    status: str = "pending"
    started_at: str = field(default_factory=lambda: datetime.now().isoformat())
    completed_at: Optional[str] = None
    ebook_path: Optional[str] = None
    pdf_path: Optional[str] = None
    landing_page_url: Optional[str] = None
    images_generated: Dict[str, Dict] = field(default_factory=dict)
    errors: List[str] = field(default_factory=list)
    
    def save(self, path: str = "build_manifest.json"):
        """Save manifest to JSON file"""
        with open(path, 'w') as f:
            json.dump(self.__dict__, f, indent=2)


class OmniCreator:
    """Main orchestrator for book-to-everything pipeline"""
    
    def __init__(self, config: BookConfig):
        self.config = config
        self.manifest = BuildManifest()
        self.ensure_directories()
        
    def ensure_directories(self):
        """Create necessary directories"""
        dirs = ['dist', 'logs', f'assets/images/{self.config.book_slug}']
        for d in dirs:
            Path(d).mkdir(parents=True, exist_ok=True)
    
    def scan_chapters(self) -> List[Path]:
        """Scan source directory for markdown files"""
        source = Path(self.config.source_dir)
        if not source.exists():
            raise FileNotFoundError(f"Source directory not found: {source}")
            
        # Find all markdown files
        chapters = sorted(source.glob("*.md"))
        logger.info(f"Found {len(chapters)} chapters in {source}")
        return chapters
    
    def process_images(self, chapters: List[Path]) -> Dict[str, str]:
        """Process all image placeholders in chapters"""
        from ebook_pipeline.agents.image_prompt_agent import ImagePromptAgent
        from scripts.generate_images import ImageGenerator
        
        # Initialize with custom palette if provided
        agent = ImagePromptAgent()
        if self.config.primary_palette:
            agent.brand_colors = self.config.primary_palette
            
        # Use existing image generator
        generator = ImageGenerator(skip_existing=True)
        
        # Process each chapter
        image_map = {}
        for chapter in chapters:
            logger.info(f"Processing images in {chapter.name}")
            # ImageGenerator handles the processing
            generator.process_file(chapter)
            
        return image_map
    
    def generate_ebook(self, chapters: List[Path]) -> Tuple[Optional[str], Optional[str]]:
        """Generate EPUB and PDF from chapters"""
        from agents.book_builder import BookBuilder
        
        builder = BookBuilder(self.config)
        
        # Generate EPUB
        epub_path = builder.create_epub(chapters)
        logger.info(f"Generated EPUB: {epub_path}")
        
        # Generate PDF
        pdf_path = builder.create_pdf(chapters)
        logger.info(f"Generated PDF: {pdf_path}")
        
        return epub_path, pdf_path
    
    def create_landing_page(self) -> Optional[str]:
        """Create and deploy landing page"""
        from agents.landing_page_builder import LandingPageBuilder
        
        builder = LandingPageBuilder(self.config)
        
        # Build page
        page_data = builder.create_page()
        
        # Deploy
        url = builder.deploy(page_data)
        logger.info(f"Deployed landing page: {url}")
        
        return url
    
    def run(self) -> BuildManifest:
        """Execute complete pipeline"""
        logger.info(f"OmniCreator-X starting for: {self.config.book_title}")
        
        try:
            # 1. Scan chapters
            chapters = self.scan_chapters()
            
            # 2. Process images
            self.process_images(chapters)
            
            # 3. Generate ebook
            epub_path, pdf_path = self.generate_ebook(chapters)
            self.manifest.ebook_path = epub_path
            self.manifest.pdf_path = pdf_path
            
            # 4. Create landing page
            if self.config.target_domain:
                url = self.create_landing_page()
                self.manifest.landing_page_url = url
            
            # Success
            self.manifest.status = "success"
            self.manifest.completed_at = datetime.now().isoformat()
            
        except Exception as e:
            logger.error(f"Pipeline failed: {e}")
            self.manifest.status = "error"
            self.manifest.errors.append(str(e))
            
        finally:
            # Save manifest
            self.manifest.save()
            
        return self.manifest


def main():
    """Entry point for OmniCreator"""
    # Load configuration
    config = BookConfig.from_env()
    
    # Create and run pipeline
    creator = OmniCreator(config)
    manifest = creator.run()
    
    # Output summary
    print(f"\nstatus: {manifest.status}")
    if manifest.ebook_path:
        print(f"ebook: {manifest.ebook_path}")
    if manifest.pdf_path:
        print(f"pdf: {manifest.pdf_path}")
    if manifest.landing_page_url:
        print(f"landing_page: {manifest.landing_page_url}")
    
    sys.exit(0 if manifest.status == "success" else 1)


if __name__ == "__main__":
    main()