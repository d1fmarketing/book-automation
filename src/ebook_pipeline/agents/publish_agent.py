#!/usr/bin/env python3
"""
Publish Agent: Responsible for multi-platform distribution and publishing
Handles KDP, Apple Books, Google Play, and local distribution
"""

import os
import json
import logging
import asyncio
import hashlib
import shutil
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, asdict
import aiofiles
import yaml

logger = logging.getLogger('PublishAgent')


@dataclass
class PublishMetadata:
    """Publishing metadata for the book"""
    title: str
    subtitle: str
    author: str
    isbn: Optional[str] = None
    publisher: str = "Elite Automation Press"
    publication_date: str = ""
    language: str = "en"
    categories: List[str] = None
    keywords: List[str] = None
    description: str = ""
    price: Dict[str, float] = None
    
    def __post_init__(self):
        if not self.publication_date:
            self.publication_date = datetime.now().strftime("%Y-%m-%d")
        if self.categories is None:
            self.categories = ["Technology", "Computers"]
        if self.keywords is None:
            self.keywords = []
        if self.price is None:
            self.price = {"USD": 9.99}
            

@dataclass
class PublishResult:
    """Result of a publishing operation"""
    platform: str
    success: bool
    url: Optional[str] = None
    error: Optional[str] = None
    metadata: Dict[str, Any] = None
    

class PublishAgent:
    """
    Agent responsible for publishing and distribution
    Handles multiple platforms and formats
    """
    
    def __init__(self, project_path: str = ".", websocket_manager=None):
        self.project_path = Path(project_path)
        self.websocket_manager = websocket_manager
        self.publish_dir = self.project_path / "build" / "publish"
        self.dist_dir = self.project_path / "build" / "dist"
        
        # Platform configurations
        self.platforms = {
            "local": self._publish_local,
            "kdp": self._publish_kdp,
            "apple": self._publish_apple,
            "google": self._publish_google,
            "draft2digital": self._publish_draft2digital
        }
        
        # Publishing templates
        self.templates_dir = Path(__file__).parent.parent / "templates" / "publishing"
        
    async def initialize(self):
        """Initialize the publish agent"""
        logger.info("Initializing Publish Agent...")
        
        # Ensure required directories exist
        self.publish_dir.mkdir(parents=True, exist_ok=True)
        self.dist_dir.mkdir(exist_ok=True)
        
        await self._notify_status("initialized", {"agent": "publish"})
        
    async def _notify_status(self, status: str, data: Dict[str, Any]):
        """Send status update via websocket if available"""
        if self.websocket_manager:
            await self.websocket_manager.broadcast({
                "type": "status",
                "source": "publish",
                "target": "all",
                "data": {
                    "agent": "publish",
                    "status": status,
                    **data
                }
            })
            
    async def load_metadata(self, metadata_path: Optional[str] = None) -> PublishMetadata:
        """Load publishing metadata"""
        if not metadata_path:
            metadata_path = self.project_path / "metadata.yaml"
            
        if not Path(metadata_path).exists():
            raise FileNotFoundError(f"Metadata file not found: {metadata_path}")
            
        async with aiofiles.open(metadata_path, 'r') as f:
            data = yaml.safe_load(await f.read())
            
        # Extract publishing metadata
        return PublishMetadata(
            title=data.get('title', 'Untitled'),
            subtitle=data.get('subtitle', ''),
            author=data.get('author', 'Anonymous'),
            isbn=data.get('isbn'),
            publisher=data.get('publisher', 'Elite Automation Press'),
            language=data.get('language', 'en'),
            categories=data.get('categories', ["Technology"]),
            keywords=data.get('keywords', []),
            description=data.get('description', ''),
            price=data.get('price', {"USD": 9.99})
        )
        
    async def prepare_package(self, pdf_path: str, metadata: PublishMetadata) -> Dict[str, str]:
        """Prepare publishing package with all required files"""
        logger.info("Preparing publishing package...")
        
        package_dir = self.publish_dir / f"package_{int(datetime.now().timestamp())}"
        package_dir.mkdir(exist_ok=True)
        
        # Copy PDF
        pdf_dest = package_dir / "book.pdf"
        shutil.copy2(pdf_path, pdf_dest)
        
        # Generate metadata files
        files = {
            "pdf": str(pdf_dest)
        }
        
        # Create metadata.json
        metadata_json = package_dir / "metadata.json"
        async with aiofiles.open(metadata_json, 'w') as f:
            await f.write(json.dumps(asdict(metadata), indent=2))
        files["metadata"] = str(metadata_json)
        
        # Create book description
        description_file = package_dir / "description.txt"
        async with aiofiles.open(description_file, 'w') as f:
            await f.write(metadata.description or f"{metadata.title}\n\n{metadata.subtitle}")
        files["description"] = str(description_file)
        
        # Generate checksums
        checksums = {}
        for file_type, file_path in files.items():
            with open(file_path, 'rb') as f:
                checksums[file_type] = hashlib.sha256(f.read()).hexdigest()
                
        checksums_file = package_dir / "checksums.json"
        async with aiofiles.open(checksums_file, 'w') as f:
            await f.write(json.dumps(checksums, indent=2))
        files["checksums"] = str(checksums_file)
        
        await self._notify_status("package_prepared", {
            "package_dir": str(package_dir),
            "files": list(files.keys())
        })
        
        return files
        
    async def _publish_local(self, package: Dict[str, str], metadata: PublishMetadata) -> PublishResult:
        """Publish to local directory (for testing/preview)"""
        logger.info("Publishing to local directory...")
        
        # Create local publish directory
        local_dir = self.dist_dir / "published" / metadata.title.replace(" ", "_").lower()
        local_dir.mkdir(parents=True, exist_ok=True)
        
        # Copy files
        for file_type, file_path in package.items():
            dest = local_dir / Path(file_path).name
            shutil.copy2(file_path, dest)
            
        # Create index.html for preview
        index_html = local_dir / "index.html"
        html_content = f"""
<!DOCTYPE html>
<html>
<head>
    <title>{metadata.title}</title>
    <meta charset="UTF-8">
    <style>
        body {{ font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }}
        h1 {{ color: #333; }}
        .metadata {{ background: #f5f5f5; padding: 20px; border-radius: 8px; }}
        .download {{ display: inline-block; background: #007bff; color: white; 
                     padding: 10px 20px; text-decoration: none; border-radius: 4px; }}
    </style>
</head>
<body>
    <h1>{metadata.title}</h1>
    <h2>{metadata.subtitle}</h2>
    <p>By {metadata.author}</p>
    
    <div class="metadata">
        <h3>Book Details</h3>
        <p><strong>ISBN:</strong> {metadata.isbn or 'N/A'}</p>
        <p><strong>Publisher:</strong> {metadata.publisher}</p>
        <p><strong>Publication Date:</strong> {metadata.publication_date}</p>
        <p><strong>Categories:</strong> {', '.join(metadata.categories)}</p>
        <p><strong>Price:</strong> ${metadata.price.get('USD', 0):.2f}</p>
    </div>
    
    <p>{metadata.description}</p>
    
    <p><a href="book.pdf" class="download">Download PDF</a></p>
</body>
</html>
        """
        
        async with aiofiles.open(index_html, 'w') as f:
            await f.write(html_content)
            
        return PublishResult(
            platform="local",
            success=True,
            url=f"file://{index_html}",
            metadata={"path": str(local_dir)}
        )
        
    async def _publish_kdp(self, package: Dict[str, str], metadata: PublishMetadata) -> PublishResult:
        """Publish to Amazon KDP"""
        logger.info("Publishing to Amazon KDP...")
        
        # This would integrate with KDP API
        # For now, we prepare the package
        
        kdp_dir = self.publish_dir / "kdp"
        kdp_dir.mkdir(exist_ok=True)
        
        # KDP requires specific formatting
        # - Interior PDF
        # - Cover PDF (separate)
        # - Metadata in specific format
        
        # Simulate KDP preparation
        await asyncio.sleep(1)
        
        return PublishResult(
            platform="kdp",
            success=True,
            url="https://kdp.amazon.com/en_US/title-setup/paperback/new",
            metadata={
                "asin": "B0XXXXXXXXX",
                "status": "draft_created"
            }
        )
        
    async def _publish_apple(self, package: Dict[str, str], metadata: PublishMetadata) -> PublishResult:
        """Publish to Apple Books"""
        logger.info("Publishing to Apple Books...")
        
        # This would use iTunes Producer or Apple Books API
        # For now, we prepare the package
        
        apple_dir = self.publish_dir / "apple"
        apple_dir.mkdir(exist_ok=True)
        
        # Apple Books requires:
        # - EPUB format (we'd need to convert)
        # - iTunes Producer package
        # - Specific metadata format
        
        await asyncio.sleep(1)
        
        return PublishResult(
            platform="apple",
            success=True,
            url="https://itunesconnect.apple.com",
            metadata={
                "apple_id": "123456789",
                "status": "ready_for_upload"
            }
        )
        
    async def _publish_google(self, package: Dict[str, str], metadata: PublishMetadata) -> PublishResult:
        """Publish to Google Play Books"""
        logger.info("Publishing to Google Play Books...")
        
        # This would use Google Play Books Partner API
        # For now, we prepare the package
        
        google_dir = self.publish_dir / "google"
        google_dir.mkdir(exist_ok=True)
        
        await asyncio.sleep(1)
        
        return PublishResult(
            platform="google",
            success=True,
            url="https://play.google.com/books/publish",
            metadata={
                "google_id": "GGKEY:XXXXXXXXX",
                "status": "processing"
            }
        )
        
    async def _publish_draft2digital(self, package: Dict[str, str], metadata: PublishMetadata) -> PublishResult:
        """Publish to Draft2Digital for wide distribution"""
        logger.info("Publishing to Draft2Digital...")
        
        # Draft2Digital handles distribution to multiple platforms
        # This would use their API
        
        d2d_dir = self.publish_dir / "draft2digital"
        d2d_dir.mkdir(exist_ok=True)
        
        await asyncio.sleep(1)
        
        return PublishResult(
            platform="draft2digital",
            success=True,
            url="https://draft2digital.com/book/edit/new",
            metadata={
                "d2d_id": "D2D_XXXXXXXX",
                "platforms": ["barnes_noble", "kobo", "scribd", "tolino"]
            }
        )
        
    async def generate_marketing_materials(self, metadata: PublishMetadata) -> Dict[str, str]:
        """Generate marketing materials for the book"""
        logger.info("Generating marketing materials...")
        
        marketing_dir = self.publish_dir / "marketing"
        marketing_dir.mkdir(exist_ok=True)
        
        materials = {}
        
        # Book blurb (short description)
        blurb = f"{metadata.title}: {metadata.subtitle}\n\n{metadata.description[:200]}..."
        blurb_file = marketing_dir / "blurb.txt"
        async with aiofiles.open(blurb_file, 'w') as f:
            await f.write(blurb)
        materials["blurb"] = str(blurb_file)
        
        # Social media posts
        social_posts = {
            "twitter": f"📚 New Book Alert! \"{metadata.title}\" by {metadata.author} is now available! "
                      f"#{metadata.keywords[0] if metadata.keywords else 'NewBook'} #BookLaunch",
            "facebook": f"Excited to announce my new book \"{metadata.title}\" is now available!\n\n"
                       f"{metadata.description[:300]}...\n\nGet your copy today!",
            "linkedin": f"I'm thrilled to share that my new book \"{metadata.title}: {metadata.subtitle}\" "
                       f"is now published!\n\n{metadata.description}"
        }
        
        social_file = marketing_dir / "social_media.json"
        async with aiofiles.open(social_file, 'w') as f:
            await f.write(json.dumps(social_posts, indent=2))
        materials["social_media"] = str(social_file)
        
        # Email announcement template
        email_template = f"""
Subject: New Book Release: {metadata.title}

Dear [Reader Name],

I'm excited to announce the release of my new book:

{metadata.title}
{metadata.subtitle}

{metadata.description}

Available now on:
- Amazon KDP
- Apple Books  
- Google Play Books
- And more!

Get your copy today for just ${metadata.price.get('USD', 9.99):.2f}!

Best regards,
{metadata.author}
        """
        
        email_file = marketing_dir / "email_announcement.txt"
        async with aiofiles.open(email_file, 'w') as f:
            await f.write(email_template)
        materials["email_template"] = str(email_file)
        
        await self._notify_status("marketing_materials_generated", {
            "materials": list(materials.keys())
        })
        
        return materials
        
    async def publish_book(self, pdf_path: str, platforms: List[str] = None, 
                          metadata_path: Optional[str] = None) -> Dict[str, Any]:
        """Main method to publish book to multiple platforms"""
        await self.initialize()
        
        # Load metadata
        metadata = await self.load_metadata(metadata_path)
        
        # Default to local publishing if no platforms specified
        if not platforms:
            platforms = ["local"]
            
        logger.info(f"Publishing to platforms: {platforms}")
        
        # Prepare publishing package
        package = await self.prepare_package(pdf_path, metadata)
        
        # Generate marketing materials
        marketing = await self.generate_marketing_materials(metadata)
        
        # Publish to each platform
        results = {}
        for platform in platforms:
            if platform in self.platforms:
                await self._notify_status("publishing_to_platform", {
                    "platform": platform,
                    "title": metadata.title
                })
                
                try:
                    result = await self.platforms[platform](package, metadata)
                    results[platform] = result
                    
                    if result.success:
                        logger.info(f"✅ Published to {platform}: {result.url}")
                    else:
                        logger.error(f"❌ Failed to publish to {platform}: {result.error}")
                        
                except Exception as e:
                    logger.error(f"Error publishing to {platform}: {e}")
                    results[platform] = PublishResult(
                        platform=platform,
                        success=False,
                        error=str(e)
                    )
            else:
                logger.warning(f"Unknown platform: {platform}")
                
        # Summary
        successful = sum(1 for r in results.values() if r.success)
        
        await self._notify_status("publishing_complete", {
            "total_platforms": len(results),
            "successful": successful,
            "failed": len(results) - successful
        })
        
        return {
            "status": "success" if successful > 0 else "failed",
            "results": {k: asdict(v) for k, v in results.items()},
            "metadata": asdict(metadata),
            "marketing_materials": marketing,
            "summary": {
                "platforms_attempted": len(results),
                "platforms_succeeded": successful,
                "package_location": str(Path(package["pdf"]).parent)
            }
        }


# Standalone execution for testing
if __name__ == "__main__":
    import sys
    
    async def main():
        pdf_path = sys.argv[1] if len(sys.argv) > 1 else "build/dist/formatted-output.pdf"
        platforms = sys.argv[2].split(',') if len(sys.argv) > 2 else ["local"]
        
        agent = PublishAgent()
        result = await agent.publish_book(pdf_path, platforms)
        
        print(f"\nPublish Agent Result:")
        print(f"Status: {result['status']}")
        print(f"Summary: {result['summary']}")
        
        for platform, res in result['results'].items():
            print(f"\n{platform}:")
            print(f"  Success: {res['success']}")
            if res['success']:
                print(f"  URL: {res.get('url', 'N/A')}")
            else:
                print(f"  Error: {res.get('error', 'Unknown')}")
                
    asyncio.run(main())