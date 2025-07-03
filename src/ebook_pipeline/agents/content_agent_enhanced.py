#!/usr/bin/env python3
"""
Enhanced Content Agent with Image Generation Integration
Processes markdown chapters and generates images using ImagePromptAgent
"""

import os
import json
import yaml
import logging
import subprocess
import base64
import re
from pathlib import Path
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass
import asyncio
import aiofiles

# Import ImagePromptAgent
from .image_prompt_agent import ImagePromptAgent

logger = logging.getLogger('ContentAgentEnhanced')


@dataclass
class ChapterContent:
    """Represents a chapter with its content and metadata"""
    number: int
    title: str
    filename: str
    content: str
    word_count: int
    status: str
    image_placeholders: List[Dict[str, str]] = None
    generated_images: Dict[str, str] = None
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
    ai_generated_images: Dict[str, str]  # placeholder -> generated image path


class ContentAgentEnhanced:
    """
    Enhanced Content Agent with AI image generation
    """
    
    def __init__(self, project_path: str = ".", websocket_manager=None):
        self.project_path = Path(project_path)
        self.websocket_manager = websocket_manager
        self.chapters_dir = self.project_path / "chapters"
        self.assets_dir = self.project_path / "assets"
        self.images_dir = self.assets_dir / "images"
        self.ai_images_dir = self.assets_dir / "ai-images"
        self.metadata_path = self.project_path / "metadata.yaml"
        
        # Initialize ImagePromptAgent
        self.image_agent = ImagePromptAgent(
            default_style="professional ebook illustration",
            default_quality="QUALITY",
            brand_colors=["#1A237E", "#45B3E7", "#863DFF"]
        )
        
    async def initialize(self):
        """Initialize the content agent"""
        logger.info("Initializing Enhanced Content Agent...")
        
        # Ensure required directories exist
        self.chapters_dir.mkdir(exist_ok=True)
        self.assets_dir.mkdir(exist_ok=True)
        self.images_dir.mkdir(exist_ok=True)
        self.ai_images_dir.mkdir(exist_ok=True)
        
        await self._notify_status("initialized", {"agent": "content_enhanced"})
        
    async def _notify_status(self, status: str, data: Dict[str, Any]):
        """Send status update via websocket if available"""
        if self.websocket_manager:
            await self.websocket_manager.broadcast({
                "type": "status",
                "source": "content_enhanced",
                "target": "all",
                "data": {
                    "agent": "content_enhanced",
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
            
    def extract_image_placeholders(self, content: str) -> List[Dict[str, str]]:
        """Extract ![AI-IMAGE: description] placeholders from content"""
        pattern = r'!\[AI-IMAGE:\s*([^\]]+)\]\(\)'
        matches = re.findall(pattern, content)
        
        placeholders = []
        for i, match in enumerate(matches):
            placeholders.append({
                'index': i,
                'description': match.strip(),
                'placeholder': f'![AI-IMAGE: {match}]()'
            })
        
        return placeholders
    
    async def generate_ai_image(self, description: str, chapter_num: int, index: int) -> str:
        """Generate an AI image using ImagePromptAgent"""
        logger.info(f"Generating AI image for Chapter {chapter_num}: {description[:50]}...")
        
        # Build prompt using ImagePromptAgent
        prompt_data = self.image_agent.build_prompt(
            raw_desc=description,
            overlay_text=None,  # No text overlay for book illustrations
            res="1024x1024",
            provider="ideogram"  # or "sora" for OpenAI
        )
        
        # Save prompt data for reference
        prompt_file = self.ai_images_dir / f"chapter-{chapter_num:02d}-image-{index:02d}-prompt.json"
        async with aiofiles.open(prompt_file, 'w') as f:
            await f.write(json.dumps(prompt_data, indent=2))
        
        # For now, create a placeholder image
        # In production, this would call the actual API
        image_filename = f"chapter-{chapter_num:02d}-ai-{index:02d}.png"
        image_path = self.ai_images_dir / image_filename
        
        # Create a simple placeholder (in production, use actual API)
        await self._create_placeholder_image(image_path, prompt_data)
        
        logger.info(f"✅ Generated image: {image_filename}")
        return str(image_path)
    
    async def _create_placeholder_image(self, image_path: Path, prompt_data: Dict):
        """Create a placeholder image (replace with actual API call)"""
        # Use existing image generation script if available
        script_path = self.project_path / "scripts" / "generation" / "generate-images.js"
        
        if script_path.exists():
            # Call the script with prompt data
            result = await asyncio.create_subprocess_exec(
                'node', str(script_path),
                '--prompt', prompt_data['prompt'],
                '--output', str(image_path),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, stderr = await result.communicate()
            
            if result.returncode != 0:
                logger.error(f"Image generation failed: {stderr.decode()}")
                # Create a simple placeholder
                await self._create_svg_placeholder(image_path, prompt_data)
        else:
            # Create SVG placeholder
            await self._create_svg_placeholder(image_path, prompt_data)
    
    async def _create_svg_placeholder(self, image_path: Path, prompt_data: Dict):
        """Create an SVG placeholder image"""
        emotion = prompt_data.get('emotion_metadata', {}).get('primary_emotion', 'neutral')
        palette = prompt_data.get('emotion_metadata', {}).get('palette', ['#1A237E', '#45B3E7'])
        
        svg_content = f"""
        <svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style="stop-color:{palette[0]};stop-opacity:1" />
                    <stop offset="100%" style="stop-color:{palette[1] if len(palette) > 1 else palette[0]};stop-opacity:1" />
                </linearGradient>
            </defs>
            <rect width="1024" height="1024" fill="url(#bg)"/>
            <text x="512" y="480" font-family="Arial" font-size="24" fill="white" text-anchor="middle">
                AI Generated Image
            </text>
            <text x="512" y="520" font-family="Arial" font-size="18" fill="white" text-anchor="middle" opacity="0.8">
                {prompt_data['prompt'][:60]}...
            </text>
            <text x="512" y="560" font-family="Arial" font-size="16" fill="white" text-anchor="middle" opacity="0.6">
                Emotion: {emotion}
            </text>
        </svg>
        """
        
        # Save as SVG first
        svg_path = image_path.with_suffix('.svg')
        async with aiofiles.open(svg_path, 'w') as f:
            await f.write(svg_content.strip())
        
        # Convert to PNG using ImageMagick if available
        try:
            result = await asyncio.create_subprocess_exec(
                'convert', str(svg_path), str(image_path),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            await result.communicate()
            # Remove SVG after conversion
            if image_path.exists():
                svg_path.unlink()
        except:
            # If conversion fails, keep the SVG
            logger.warning("ImageMagick not available, keeping SVG format")
            svg_path.rename(image_path.with_suffix('.svg'))
    
    async def process_chapter_images(self, chapter: ChapterContent) -> str:
        """Process all image placeholders in a chapter"""
        if not chapter.image_placeholders:
            return chapter.content
        
        updated_content = chapter.content
        chapter.generated_images = {}
        
        for placeholder in chapter.image_placeholders:
            # Generate image
            image_path = await self.generate_ai_image(
                placeholder['description'],
                chapter.number,
                placeholder['index']
            )
            
            # Load image as base64
            if Path(image_path).exists():
                with open(image_path, 'rb') as f:
                    img_data = f.read()
                    img_base64 = base64.b64encode(img_data).decode('utf-8')
                    mime_type = 'image/png' if image_path.endswith('.png') else 'image/svg+xml'
                    img_src = f"data:{mime_type};base64,{img_base64}"
                
                # Replace placeholder with actual image
                new_img_tag = f'![{placeholder["description"]}]({img_src})'
                updated_content = updated_content.replace(placeholder['placeholder'], new_img_tag)
                
                # Store reference
                chapter.generated_images[placeholder['placeholder']] = image_path
        
        return updated_content
    
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
            
            # Extract image placeholders
            placeholders = self.extract_image_placeholders(chapter_content)
            
            chapter = ChapterContent(
                number=chapter_num,
                title=frontmatter.get('title', f'Chapter {chapter_num}').strip('"'),
                filename=chapter_file.name,
                content=chapter_content,
                word_count=int(frontmatter.get('words', 0)),
                status=frontmatter.get('status', 'draft'),
                image_placeholders=placeholders
            )
            
            chapters.append(chapter)
            
        await self._notify_status("chapters_loaded", {
            "count": len(chapters),
            "total_words": sum(ch.word_count for ch in chapters),
            "ai_images_needed": sum(len(ch.image_placeholders) for ch in chapters)
        })
        
        return chapters
        
    async def generate_images(self, chapters: List[ChapterContent]) -> Dict[str, str]:
        """Generate all images including AI-generated ones"""
        logger.info("Generating chapter images...")
        
        images = {}
        ai_generated_images = {}
        
        # Process AI image placeholders
        for chapter in chapters:
            if chapter.image_placeholders:
                logger.info(f"Processing {len(chapter.image_placeholders)} AI images for Chapter {chapter.number}")
                updated_content = await self.process_chapter_images(chapter)
                chapter.content = updated_content
                
                # Track generated images
                if chapter.generated_images:
                    ai_generated_images.update(chapter.generated_images)
        
        # Load existing images
        for img_file in self.images_dir.glob("*.png"):
            with open(img_file, 'rb') as f:
                img_data = f.read()
                img_base64 = base64.b64encode(img_data).decode('utf-8')
                images[img_file.stem] = f"data:image/png;base64,{img_base64}"
        
        # Load AI-generated images
        for img_file in self.ai_images_dir.glob("*.png"):
            with open(img_file, 'rb') as f:
                img_data = f.read()
                img_base64 = base64.b64encode(img_data).decode('utf-8')
                images[img_file.stem] = f"data:image/png;base64,{img_base64}"
                
        # Assign chapter header images
        for chapter in chapters:
            img_key = f"chapter-{chapter.number:02d}"
            for key in images:
                if img_key in key and 'ai' not in key:
                    chapter.image_base64 = images[key]
                    break
                    
        await self._notify_status("images_generated", {
            "count": len(images),
            "ai_generated": len(ai_generated_images),
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
            
            # Process chapter content (already has AI images embedded)
            # Convert markdown to HTML
            import markdown
            md = markdown.Markdown(extensions=['extra', 'codehilite'])
            html_content = md.convert(chapter.content)
            
            html_parts.append('<div class="chapter-content">')
            
            # Add chapter header image if available
            if chapter.image_base64:
                html_parts.append(f'<img src="{chapter.image_base64}" '
                                f'alt="Chapter {chapter.number} illustration" '
                                f'class="chapter-image">')
            
            html_parts.append(html_content)
            html_parts.append('</div>')
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
        
        # Generate images (including AI)
        images = await self.generate_images(chapters)
        
        # Create book content structure
        book_content = BookContent(
            title=metadata.get('title', 'Untitled'),
            subtitle=metadata.get('subtitle', ''),
            author=metadata.get('author', 'Anonymous'),
            chapters=chapters,
            metadata=metadata,
            images=images,
            ai_generated_images={}  # Track AI images separately
        )
        
        # Generate HTML
        html_content = await self.generate_html(book_content)
        
        # Save intermediate HTML
        output_path = self.project_path / "build" / "content-enhanced.html"
        output_path.parent.mkdir(exist_ok=True)
        
        async with aiofiles.open(output_path, 'w', encoding='utf-8') as f:
            await f.write(html_content)
            
        logger.info(f"Content processing complete. HTML saved to: {output_path}")
        
        await self._notify_status("processing_complete", {
            "output": str(output_path),
            "chapters": len(chapters),
            "images": len(images),
            "ai_images": sum(len(ch.image_placeholders or []) for ch in chapters)
        })
        
        return {
            "status": "success",
            "html_path": str(output_path),
            "book_content": book_content,
            "statistics": {
                "chapters": len(chapters),
                "total_words": sum(ch.word_count for ch in chapters),
                "images": len(images),
                "ai_images_generated": sum(len(ch.image_placeholders or []) for ch in chapters)
            }
        }


# Standalone execution for testing
if __name__ == "__main__":
    import sys
    
    async def main():
        project_path = sys.argv[1] if len(sys.argv) > 1 else "pipeline-book"
        
        agent = ContentAgentEnhanced(project_path)
        result = await agent.process_book()
        
        print(f"\nEnhanced Content Agent Result:")
        print(f"Status: {result['status']}")
        print(f"HTML Path: {result['html_path']}")
        print(f"Statistics: {result['statistics']}")
        
    asyncio.run(main())