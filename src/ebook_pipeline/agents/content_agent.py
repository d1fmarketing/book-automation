#!/usr/bin/env python3
"""
Content Agent: Responsible for processing markdown chapters and generating HTML content
Integrates functionality from scripts/generation/*
"""

import os
import json
import yaml
import logging
import subprocess
import base64
from pathlib import Path
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
import asyncio
import aiofiles

logger = logging.getLogger('ContentAgent')


@dataclass
class ChapterContent:
    """Represents a chapter with its content and metadata"""
    number: int
    title: str
    filename: str
    content: str
    word_count: int
    status: str
    image_path: Optional[str] = None
    image_base64: Optional[str] = None


@dataclass
class BookContent:
    """Complete book content structure"""
    title: str
    subtitle: str
    author: str
    chapters: List[ChapterContent]
    metadata: Dict[str, Any]
    images: Dict[str, str]  # filename -> base64


class ContentAgent:
    """
    Agent responsible for content generation and processing
    Consolidates scripts from scripts/generation/
    """
    
    def __init__(self, project_path: str = ".", websocket_manager=None):
        self.project_path = Path(project_path)
        self.websocket_manager = websocket_manager
        self.chapters_dir = self.project_path / "chapters"
        self.assets_dir = self.project_path / "assets"
        self.images_dir = self.assets_dir / "images"
        self.metadata_path = self.project_path / "metadata.yaml"
        
        # Scripts from scripts/generation/ that we'll integrate
        self.generation_scripts = {
            'create_images': 'scripts/generation/create-horizontal-images.js',
            'convert_png': 'scripts/generation/convert-to-png.js',
            'generate_images': 'scripts/generation/generate-images.js'
        }
        
    async def initialize(self):
        """Initialize the content agent"""
        logger.info("Initializing Content Agent...")
        
        # Ensure required directories exist
        self.chapters_dir.mkdir(exist_ok=True)
        self.assets_dir.mkdir(exist_ok=True)
        self.images_dir.mkdir(exist_ok=True)
        
        await self._notify_status("initialized", {"agent": "content"})
        
    async def _notify_status(self, status: str, data: Dict[str, Any]):
        """Send status update via websocket if available"""
        if self.websocket_manager:
            await self.websocket_manager.broadcast({
                "type": "status",
                "source": "content",
                "target": "all",
                "data": {
                    "agent": "content",
                    "status": status,
                    **data
                }
            })
            
    async def load_metadata(self) -> Dict[str, Any]:
        """Load book metadata from YAML file"""
        if not self.metadata_path.exists():
            raise FileNotFoundError(f"Metadata file not found: {self.metadata_path}")
            
        async with aiofiles.open(self.metadata_path, 'r') as f:
            content = await f.read()
            return yaml.safe_load(content)
            
    async def load_chapters(self) -> List[ChapterContent]:
        """Load all chapters from markdown files"""
        chapters = []
        
        # Find all chapter files
        chapter_files = sorted(self.chapters_dir.glob("chapter-*.md"))
        
        for chapter_file in chapter_files:
            logger.info(f"Loading chapter: {chapter_file.name}")
            
            async with aiofiles.open(chapter_file, 'r', encoding='utf-8') as f:
                content = await f.read()
                
            # Parse frontmatter and content
            lines = content.split('\n')
            frontmatter = {}
            content_start = 0
            
            if lines[0] == '---':
                for i, line in enumerate(lines[1:], 1):
                    if line == '---':
                        content_start = i + 1
                        break
                    if ':' in line:
                        key, value = line.split(':', 1)
                        frontmatter[key.strip()] = value.strip()
                        
            # Extract chapter content
            chapter_content = '\n'.join(lines[content_start:])
            
            # Extract chapter number from filename
            chapter_num = int(chapter_file.stem.split('-')[1])
            
            chapter = ChapterContent(
                number=chapter_num,
                title=frontmatter.get('title', f'Chapter {chapter_num}').strip('"'),
                filename=chapter_file.name,
                content=chapter_content,
                word_count=int(frontmatter.get('words', 0)),
                status=frontmatter.get('status', 'draft')
            )
            
            chapters.append(chapter)
            
        await self._notify_status("chapters_loaded", {
            "count": len(chapters),
            "total_words": sum(ch.word_count for ch in chapters)
        })
        
        return chapters
        
    async def generate_images(self, chapters: List[ChapterContent]) -> Dict[str, str]:
        """Generate images for chapters using existing scripts"""
        logger.info("Generating chapter images...")
        
        images = {}
        
        # Check if we need to generate images
        existing_images = list(self.images_dir.glob("*.png"))
        
        if len(existing_images) < len(chapters) + 1:  # +1 for cover
            # Run image generation script
            script_path = self.project_path / self.generation_scripts['create_images']
            
            if script_path.exists():
                logger.info("Running image generation script...")
                result = subprocess.run(
                    ['node', str(script_path)],
                    cwd=str(self.project_path),
                    capture_output=True,
                    text=True
                )
                
                if result.returncode != 0:
                    logger.error(f"Image generation failed: {result.stderr}")
                else:
                    logger.info("Images generated successfully")
                    
        # Load images as base64
        for img_file in self.images_dir.glob("*.png"):
            with open(img_file, 'rb') as f:
                img_data = f.read()
                img_base64 = base64.b64encode(img_data).decode('utf-8')
                images[img_file.stem] = f"data:image/png;base64,{img_base64}"
                
        # Assign images to chapters
        for chapter in chapters:
            # Look for chapter-specific image
            img_key = f"chapter-{chapter.number:02d}"
            for key in images:
                if img_key in key:
                    chapter.image_base64 = images[key]
                    break
                    
        await self._notify_status("images_generated", {
            "count": len(images),
            "size_mb": sum(len(img) for img in images.values()) / 1024 / 1024
        })
        
        return images
        
    async def generate_html(self, book_content: BookContent) -> str:
        """Generate HTML from book content"""
        logger.info("Generating HTML content...")
        
        # Build HTML structure
        html_parts = ['<!DOCTYPE html>', '<html>', '<head>', '<meta charset="UTF-8">']
        
        # Add title
        html_parts.append(f'<title>{book_content.title}</title>')
        
        # Add CSS (will be handled by Format Agent)
        html_parts.append('</head>')
        html_parts.append('<body>')
        
        # Cover page
        if 'cover' in book_content.images:
            html_parts.append('<div class="cover">')
            html_parts.append(f'<img src="{book_content.images["cover"]}" alt="Book Cover">')
            html_parts.append('</div>')
            
        # Title page
        html_parts.append('<div class="page title-page">')
        html_parts.append(f'<h1>{book_content.title}</h1>')
        if book_content.subtitle:
            html_parts.append(f'<p class="subtitle">{book_content.subtitle}</p>')
        html_parts.append(f'<p class="author">{book_content.author}</p>')
        html_parts.append('</div>')
        
        # Chapters
        for chapter in book_content.chapters:
            html_parts.append(f'<div class="chapter" id="chapter-{chapter.number}">')
            html_parts.append(f'<div class="chapter-number">{chapter.number}</div>')
            html_parts.append(f'<h1>{chapter.title}</h1>')
            
            # Process chapter content
            paragraphs = chapter.content.strip().split('\n\n')
            for i, para in enumerate(paragraphs):
                if para.strip():
                    css_class = 'first-paragraph' if i == 0 else ''
                    html_parts.append(f'<p class="{css_class}">{para.strip()}</p>')
                    
                    # Add image after second paragraph
                    if i == 1 and chapter.image_base64:
                        html_parts.append(f'<img src="{chapter.image_base64}" '
                                        f'alt="Chapter {chapter.number} illustration" '
                                        f'class="chapter-image">')
                        
            html_parts.append('</div>')
            
        html_parts.append('</body>')
        html_parts.append('</html>')
        
        html_content = '\n'.join(html_parts)
        
        await self._notify_status("html_generated", {
            "size_kb": len(html_content) / 1024,
            "chapters": len(book_content.chapters)
        })
        
        return html_content
        
    async def process_book(self, project_path: Optional[str] = None) -> Dict[str, Any]:
        """Main method to process book content"""
        if project_path:
            self.project_path = Path(project_path)
            
        await self.initialize()
        
        # Load metadata
        metadata = await self.load_metadata()
        
        # Load chapters
        chapters = await self.load_chapters()
        
        # Generate images
        images = await self.generate_images(chapters)
        
        # Create book content structure
        book_content = BookContent(
            title=metadata.get('title', 'Untitled'),
            subtitle=metadata.get('subtitle', ''),
            author=metadata.get('author', 'Anonymous'),
            chapters=chapters,
            metadata=metadata,
            images=images
        )
        
        # Generate HTML
        html_content = await self.generate_html(book_content)
        
        # Save intermediate HTML
        output_path = self.project_path / "build" / "content.html"
        output_path.parent.mkdir(exist_ok=True)
        
        async with aiofiles.open(output_path, 'w', encoding='utf-8') as f:
            await f.write(html_content)
            
        logger.info(f"Content processing complete. HTML saved to: {output_path}")
        
        await self._notify_status("processing_complete", {
            "output": str(output_path),
            "chapters": len(chapters),
            "images": len(images)
        })
        
        return {
            "status": "success",
            "html_path": str(output_path),
            "book_content": book_content,
            "statistics": {
                "chapters": len(chapters),
                "total_words": sum(ch.word_count for ch in chapters),
                "images": len(images)
            }
        }


# Standalone execution for testing
if __name__ == "__main__":
    import sys
    
    async def main():
        project_path = sys.argv[1] if len(sys.argv) > 1 else "pipeline-book"
        
        agent = ContentAgent(project_path)
        result = await agent.process_book()
        
        print(f"\nContent Agent Result:")
        print(f"Status: {result['status']}")
        print(f"HTML Path: {result['html_path']}")
        print(f"Statistics: {result['statistics']}")
        
    asyncio.run(main())