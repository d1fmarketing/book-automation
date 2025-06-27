#!/usr/bin/env python3
"""
BookBuilder: EPUB and PDF generation from Markdown chapters
"""
import os
import json
import subprocess
from pathlib import Path
from typing import List, Optional
import logging

logger = logging.getLogger('BookBuilder')


class BookBuilder:
    """Handles EPUB and PDF generation"""
    
    def __init__(self, config):
        self.config = config
        self.dist_dir = Path("dist")
        self.dist_dir.mkdir(exist_ok=True)
        
    def create_metadata(self) -> dict:
        """Create book metadata"""
        return {
            "title": self.config.book_title,
            "author": self.config.author_name,
            "language": self.config.language,
            "identifier": f"isbn:{self.config.isbn}",
            "publisher": f"{self.config.author_name} Publishing",
            "date": "2025",
            "rights": f"© 2025 {self.config.author_name}. All rights reserved."
        }
    
    def generate_cover(self) -> Optional[Path]:
        """Generate book cover from first available image"""
        images_dir = Path(f"assets/images/{self.config.book_slug}")
        if not images_dir.exists():
            images_dir = Path("assets/images")
            
        # Find first image
        for img in images_dir.glob("*.png"):
            return img
            
        return None
    
    def create_epub(self, chapters: List[Path]) -> Optional[str]:
        """Create EPUB from markdown chapters"""
        try:
            # Prepare output path
            epub_path = self.dist_dir / f"{self.config.book_slug}.epub"
            
            # Create metadata file
            metadata_path = Path("metadata_temp.yaml")
            metadata = self.create_metadata()
            
            with open(metadata_path, 'w') as f:
                for key, value in metadata.items():
                    f.write(f"{key}: {value}\n")
            
            # Build pandoc command
            cmd = [
                "pandoc",
                "--from", "markdown",
                "--to", "epub3",
                "--metadata-file", str(metadata_path),
                "--epub-stylesheet", "assets/css/epub-styles.css",
                "--output", str(epub_path)
            ]
            
            # Add cover if available
            cover = self.generate_cover()
            if cover:
                cmd.extend(["--epub-cover-image", str(cover)])
            
            # Add all chapters
            for chapter in chapters:
                cmd.append(str(chapter))
            
            # Execute
            logger.info(f"Running: {' '.join(cmd)}")
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            if result.returncode != 0:
                logger.error(f"Pandoc error: {result.stderr}")
                return None
                
            # Cleanup
            metadata_path.unlink()
            
            return str(epub_path)
            
        except Exception as e:
            logger.error(f"EPUB creation failed: {e}")
            return None
    
    def create_pdf(self, chapters: List[Path]) -> Optional[str]:
        """Create PDF from markdown chapters"""
        try:
            # For now, use the existing PDF generation script
            pdf_path = self.dist_dir / f"{self.config.book_slug}.pdf"
            
            # Check if we have the Node.js PDF generator
            pdf_script = Path("scripts/generate-pdf-puppeteer.js")
            if pdf_script.exists():
                cmd = ["node", str(pdf_script)]
                result = subprocess.run(cmd, capture_output=True, text=True)
                
                if result.returncode == 0 and pdf_path.exists():
                    return str(pdf_path)
            
            # Fallback to pandoc PDF
            cmd = [
                "pandoc",
                "--from", "markdown",
                "--to", "pdf",
                "--pdf-engine", "xelatex",
                "--output", str(pdf_path)
            ]
            
            # Add metadata
            metadata = self.create_metadata()
            for key, value in metadata.items():
                cmd.extend(["-M", f"{key}={value}"])
            
            # Add chapters
            for chapter in chapters:
                cmd.append(str(chapter))
            
            logger.info(f"Running: {' '.join(cmd)}")
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            if result.returncode != 0:
                logger.error(f"PDF generation error: {result.stderr}")
                return None
                
            return str(pdf_path)
            
        except Exception as e:
            logger.error(f"PDF creation failed: {e}")
            return None