#!/usr/bin/env python3
"""
RENDER Image-Slinger: Automated image generation for ebook chapters
Scans for ![AI-IMAGE: description]() tags and generates images via OpenAI
"""
import os
import re
import sys
import json
import hashlib
import argparse
from pathlib import Path
from datetime import datetime
import requests
from rich.console import Console
from rich.progress import track
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

try:
    from openai import OpenAI
except ImportError:
    print("Error: openai package not installed. Run: pip install openai")
    sys.exit(1)

console = Console()

# Constants
TAG_PATTERN = r'!\[AI-IMAGE:\s*(.+?)\s*\]\(\)'
COST_PER_IMAGE = 0.04  # GPT-IMAGE-1 pricing
DEFAULT_SIZE = "1024x1024"  # DALL-E 3 supports 1024x1024, 1792x1024, or 1024x1792
DEFAULT_MODEL = "gpt-image-1"
MANIFEST_FILE = "context/image-manifest.json"


class ImageGenerator:
    def __init__(self, skip_existing=False):
        self.skip_existing = skip_existing
        self.api_key = os.getenv("OPENAI_API_KEY")
        if not self.api_key:
            console.print("[red]Error: OPENAI_API_KEY environment variable not set![/red]")
            console.print("Set it with: export OPENAI_API_KEY=sk-...")
            sys.exit(1)
        
        # Initialize OpenAI client
        from openai import OpenAI
        self.client = OpenAI(api_key=self.api_key)
        
        # Load manifest
        self.manifest_path = Path(MANIFEST_FILE)
        self.manifest = self.load_manifest()
        
        # Load style guide
        self.style_guide = self.load_style_guide()
        
        # Ensure images directory exists
        self.images_dir = Path("assets/images")
        self.images_dir.mkdir(parents=True, exist_ok=True)
        
        self.total_cost = 0
        self.images_generated = 0
    
    def load_manifest(self):
        """Load or create image generation manifest"""
        if self.manifest_path.exists():
            with open(self.manifest_path, 'r') as f:
                return json.load(f)
        return {
            "generated_images": {},
            "total_cost_usd": 0.0,
            "last_updated": None
        }
    
    def save_manifest(self):
        """Save manifest with cost tracking"""
        self.manifest["total_cost_usd"] = round(self.manifest.get("total_cost_usd", 0) + self.total_cost, 2)
        self.manifest["last_updated"] = datetime.now().isoformat()
        
        # Ensure context directory exists
        self.manifest_path.parent.mkdir(exist_ok=True)
        
        with open(self.manifest_path, 'w') as f:
            json.dump(self.manifest, f, indent=2)
    
    def load_style_guide(self):
        """Load writing rules for style consistency"""
        style_path = Path("context/WRITING-RULES.md")
        if style_path.exists():
            return style_path.read_text(encoding='utf-8')
        return ""
    
    def generate_slug(self, description):
        """Generate human-readable, collision-safe filename"""
        # Clean description for readability
        clean_desc = re.sub(r'[^\w\s-]', '', description.lower())
        clean_desc = re.sub(r'[-\s]+', '_', clean_desc)
        
        # Take first 20 chars for readability
        prefix = clean_desc[:20].rstrip('_')
        
        # Add hash for uniqueness
        hash_suffix = hashlib.md5(description.encode()).hexdigest()[:8]
        
        return f"{prefix}_{hash_suffix}.png"
    
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type(Exception),
        reraise=True
    )
    def generate_image(self, prompt):
        """Generate image via OpenAI API with retry logic"""
        try:
            response = self.client.images.generate(
                model=DEFAULT_MODEL,
                prompt=prompt,
                n=1,
                size=DEFAULT_SIZE
            )
            return response.data[0].url
        except Exception as e:
            if "rate_limit" in str(e).lower():
                console.print(f"[yellow]Rate limit hit, retrying...[/yellow]")
            else:
                console.print(f"[red]API Error: {e}[/red]")
            raise
    
    def download_image(self, url, filename):
        """Download image with content-type validation"""
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        
        # Validate content type
        content_type = response.headers.get('content-type', '')
        if not content_type.startswith('image'):
            raise ValueError(f"Invalid content type: {content_type}")
        
        # Save image
        image_path = self.images_dir / filename
        image_path.write_bytes(response.content)
        return image_path
    
    def create_prompt(self, description):
        """Create detailed prompt with style guide context for gpt-image-1"""
        base_prompt = description.strip()
        
        # Extract key style elements from writing rules
        style_elements = []
        if self.style_guide:
            # Look for specific style directives
            if "tone:" in self.style_guide.lower():
                style_elements.append("maintaining consistent tone")
            if "genre:" in self.style_guide.lower():
                style_elements.append("fitting the genre aesthetic")
        
        # Build enhanced prompt
        style_suffix = ""
        if style_elements:
            style_suffix = f". Style context: {', '.join(style_elements)}"
        
        # Simple, clear prompt for gpt-image-1
        prompt = f"{base_prompt}. High quality, detailed illustration{style_suffix}"
        
        return prompt
    
    def process_file(self, filepath):
        """Process a single markdown file for image placeholders"""
        console.print(f"\n[blue]Processing: {filepath.name}[/blue]")
        
        content = filepath.read_text(encoding='utf-8')
        original_content = content
        replacements = []
        
        # Find all image placeholders
        for match in re.finditer(TAG_PATTERN, content):
            description = match.group(1).strip()
            slug = self.generate_slug(description)
            
            # Check if already generated
            if self.skip_existing and slug in self.manifest.get("generated_images", {}):
                console.print(f"  [yellow]↻ Skipping existing: {description[:50]}...[/yellow]")
                # Still need to update the markdown
                image_path = f"../assets/images/{slug}"
                replacement = f"![{description}]({image_path})"
                replacements.append((match.group(0), replacement))
                continue
            
            # Generate new image
            console.print(f"  [green]→ Generating: {description[:50]}...[/green]")
            
            try:
                # Create prompt and generate
                prompt = self.create_prompt(description)
                image_url = self.generate_image(prompt)
                
                # Download and save
                image_path = self.download_image(image_url, slug)
                console.print(f"    [green]✓ Saved to: {image_path}[/green]")
                
                # Update manifest
                self.manifest["generated_images"][slug] = {
                    "description": description,
                    "prompt": prompt,
                    "model": DEFAULT_MODEL,
                    "size": DEFAULT_SIZE,
                    "generated_at": datetime.now().isoformat(),
                    "cost_usd": COST_PER_IMAGE
                }
                
                # Track cost
                self.total_cost += COST_PER_IMAGE
                self.images_generated += 1
                
                # Prepare replacement
                relative_path = f"../assets/images/{slug}"
                replacement = f"![{description}]({relative_path})"
                replacements.append((match.group(0), replacement))
                
            except Exception as e:
                console.print(f"    [red]✗ Failed: {e}[/red]")
                return False
        
        # Apply all replacements
        if replacements:
            for old, new in replacements:
                content = content.replace(old, new)
            
            if content != original_content:
                filepath.write_text(content, encoding='utf-8')
                console.print(f"  [green]✓ Updated {len(replacements)} image links[/green]")
        
        return True
    
    def run(self):
        """Process all chapter files"""
        console.print("[bold blue]🎨 RENDER Image-Slinger Starting...[/bold blue]\n")
        
        chapters_dir = Path("chapters")
        if not chapters_dir.exists():
            console.print("[red]Error: chapters/ directory not found![/red]")
            return False
        
        # Find all markdown files
        chapter_files = sorted(chapters_dir.glob("*.md"))
        if not chapter_files:
            console.print("[yellow]No chapter files found.[/yellow]")
            return True
        
        # Process each file
        success = True
        for chapter_file in track(chapter_files, description="Processing chapters..."):
            if not self.process_file(chapter_file):
                success = False
        
        # Save manifest
        self.save_manifest()
        
        # Summary
        console.print(f"\n[bold green]✅ Image Generation Complete![/bold green]")
        console.print(f"  • Model: {DEFAULT_MODEL} ({DEFAULT_SIZE})")
        console.print(f"  • Images generated: {self.images_generated}")
        console.print(f"  • Cost this session: ${self.total_cost:.2f}")
        console.print(f"  • Total cost to date: ${self.manifest['total_cost_usd']:.2f}")
        
        return success


def main():
    parser = argparse.ArgumentParser(description="Generate images for ebook chapters")
    parser.add_argument(
        "--skip-existing",
        action="store_true",
        help="Skip regenerating existing images"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be generated without making API calls"
    )
    args = parser.parse_args()
    
    if args.dry_run:
        console.print("[yellow]DRY RUN MODE - No images will be generated[/yellow]")
        # TODO: Implement dry run
        return
    
    try:
        generator = ImageGenerator(skip_existing=args.skip_existing)
        success = generator.run()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        console.print("\n[yellow]Interrupted by user[/yellow]")
        sys.exit(1)
    except Exception as e:
        console.print(f"\n[red]Fatal error: {e}[/red]")
        sys.exit(1)


if __name__ == "__main__":
    main()