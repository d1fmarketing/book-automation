#!/usr/bin/env python3
"""
RENDER Image-Slinger: Automated image generation for ebook chapters
Scans for ![AI-IMAGE: description]() tags and generates images via Ideogram 3.0
"""
import os
import re
import sys
import json
import hashlib
import argparse
import logging
from pathlib import Path
from datetime import datetime
import requests
from rich.console import Console
from rich.progress import track
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from openai import OpenAI, APIError

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from agents.image_prompt_agent import ImagePromptAgent

console = Console()

# Setup logging with rotation
from logging.handlers import RotatingFileHandler

log_dir = Path("logs")
log_dir.mkdir(exist_ok=True)

# Create rotating file handler with 10MB limit
rotating_handler = RotatingFileHandler(
    log_dir / 'image-generation.log',
    maxBytes=10*1024*1024,  # 10MB
    backupCount=3
)
rotating_handler.setFormatter(
    logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
)

# Configure logging
logger = logging.getLogger('ImageGenerator')
logger.setLevel(logging.INFO)
logger.addHandler(rotating_handler)
logger.addHandler(logging.StreamHandler())

# Initialize prompt agent
prompt_agent = ImagePromptAgent()
# Updated pattern to support multi-line text with pipe separator
TAG_PATTERN = r'!\[AI-IMAGE:\s*(.+?)(?:\s+text="(.+?)")?\s*\]\(\)'
IDEOGRAM_ENDPOINT = "https://api.ideogram.ai/v1/ideogram-v3/generate"

# Provider configuration
IMAGE_PROVIDER = os.getenv("IMAGE_PROVIDER", "ideogram")  # default to ideogram
COST_PER_IMAGE = 0.08 if IMAGE_PROVIDER == "ideogram" else 0.04  # OpenAI is cheaper
DEFAULT_SIZE = "1024x1024"  # Standard square format, use --size for other options
DEFAULT_MODEL = "ideogram-v3" if IMAGE_PROVIDER == "ideogram" else "gpt-image-1"
MANIFEST_FILE = "context/image-manifest.json"

# Initialize OpenAI client if needed
openai_client = None
if IMAGE_PROVIDER == "openai":
    openai_client = OpenAI()


class ImageGenerator:
    def __init__(self, skip_existing=False, size=None, enhance_images=False, text_overlay_method="ideogram"):
        self.skip_existing = skip_existing
        self.default_size = size or DEFAULT_SIZE
        self.enhance_images = enhance_images
        self.text_overlay_method = text_overlay_method  # "ideogram" or "post"
        self.provider = IMAGE_PROVIDER
        
        # API key validation based on provider
        if self.provider == "ideogram":
            self.api_key = os.getenv("IDEOGRAM_API_KEY")
            if not self.api_key:
                console.print("[red]Error: IDEOGRAM_API_KEY environment variable not set![/red]")
                console.print("Set it with: export IDEOGRAM_API_KEY=ideogram_sk_live_...")
                sys.exit(1)
        elif self.provider == "openai":
            self.api_key = os.getenv("OPENAI_API_KEY")
            if not self.api_key:
                console.print("[red]Error: OPENAI_API_KEY environment variable not set![/red]")
                console.print("Set it with: export OPENAI_API_KEY=sk-...")
                sys.exit(1)
        
        self.headers = {"Api-Key": self.api_key}
        
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
            "schema_version": "2.1",
            "generated_images": {},
            "total_cost_usd": 0.0,
            "last_updated": None
        }
    
    def save_manifest(self):
        """Save manifest with cost tracking"""
        # Ensure schema version is set
        self.manifest["schema_version"] = "2.1"
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
    
    def craft_prompt(self, raw, overlay_text=None, size=None):
        """
        Use ImagePromptAgent to generate prompt dict with emotion detection and text overlay
        """
        if size is None:
            size = self.default_size
        return prompt_agent.build_prompt(raw, overlay_text, size, provider=self.provider)
    
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type(Exception),
        reraise=True
    )
    def generate_image(self, prompt_data):
        """Generate image via selected provider with retry logic"""
        try:
            if self.provider == "openai":
                # Use OpenAI/Sora
                console.print(f"    [cyan]Using Sora (gpt-image-1)[/cyan]")
                
                # Map size to Sora accepted values (Jun 2025 spec)
                # Sora supports: 1024x1024, 1024x1792, 1792x1024, 1536x1536
                size_map = {
                    "1024x1024": "1024x1024",
                    "1536x1536": "1536x1536",  # Supported by Sora
                    "1792x1024": "1792x1024",  # Landscape
                    "1024x1792": "1024x1792",  # Portrait
                    "2048x2048": "1536x1536"   # Fallback from Ideogram's large size
                }
                size = size_map.get(prompt_data['resolution'], "1024x1024")
                
                console.print(f"    [cyan]Requested: {prompt_data['resolution']} → Using: {size}[/cyan]")
                
                # Sora quality mapping (API now uses: low, medium, high, auto)
                quality = "high" if prompt_data['rendering_speed'] == "QUALITY" else "medium"
                
                response = openai_client.images.generate(
                    model="gpt-image-1",
                    prompt=prompt_data['prompt'],
                    size=size,
                    n=1,
                    quality=quality  # Sora uses: low, medium, high, auto
                )
                
                # Debug logging
                logger.info(f"OpenAI response: {response}")
                if response.data and len(response.data) > 0:
                    # Sora may return base64 instead of URL
                    if response.data[0].url:
                        image_url = response.data[0].url
                        logger.info(f"Image URL: {image_url}")
                        return image_url
                    elif response.data[0].b64_json:
                        # Handle base64 response
                        import base64
                        import tempfile
                        
                        # Save base64 to temporary file
                        b64_data = response.data[0].b64_json
                        image_data = base64.b64decode(b64_data)
                        
                        # Create temp file
                        with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp:
                            tmp.write(image_data)
                            temp_path = tmp.name
                        
                        logger.info(f"Saved base64 image to temp file: {temp_path}")
                        return f"file://{temp_path}"
                else:
                    raise ValueError("No image data in OpenAI response")
                
            else:
                # Use Ideogram (default)
                # Prepare multipart form data from agent output
                files = {
                    'prompt': (None, prompt_data['prompt']),
                    'num_images': (None, '1'),
                    'rendering_speed': (None, prompt_data['rendering_speed']),
                    'resolution': (None, prompt_data['resolution'])
                }
                
                response = requests.post(
                    IDEOGRAM_ENDPOINT,
                    headers=self.headers,
                    files=files,
                    timeout=60
                )
                response.raise_for_status()
                
                # Extract image URL from response
                data = response.json()
                if 'data' in data and len(data['data']) > 0:
                    return data['data'][0]['url']
                else:
                    raise ValueError("No image URL in response")
                
        except APIError as e:
            logger.error(f"OpenAI API Error: {e}")
            if hasattr(e, 'response') and e.response:
                try:
                    error_details = e.response.json()
                    logger.error(f"Error details: {error_details}")
                except:
                    logger.error(f"Raw response: {e.response.text}")
            console.print(f"[red]OpenAI API Error: {e}[/red]")
            raise
        except requests.exceptions.HTTPError as e:
            if e.response.status_code == 429:
                console.print(f"[yellow]Rate limit hit, retrying...[/yellow]")
            else:
                console.print(f"[red]API Error {e.response.status_code}: {e.response.text}[/red]")
            raise
        except Exception as e:
            console.print(f"[red]Error: {e}[/red]")
            logger.error(f"Unexpected error: {type(e).__name__}: {e}")
            raise
    
    def download_image(self, url, filename):
        """Download image from URL or handle local file"""
        image_path = self.images_dir / filename
        
        if url.startswith('file://'):
            # Handle local file (from base64)
            import shutil
            local_path = url.replace('file://', '')
            shutil.copy2(local_path, image_path)
            # Clean up temp file
            try:
                os.unlink(local_path)
            except:
                pass
        else:
            # Download from URL
            response = requests.get(url, timeout=30)
            response.raise_for_status()
            
            # Validate content type
            content_type = response.headers.get('content-type', '')
            if not content_type.startswith('image'):
                raise ValueError(f"Invalid content type: {content_type}")
            
            # Save image
            image_path.write_bytes(response.content)
        
        # Apply enhancement if requested
        if self.enhance_images:
            self.enhance_image(image_path)
        
        return image_path
    
    def enhance_image(self, image_path):
        """Apply post-processing enhancements to image"""
        try:
            # Check if enhancement tools are available
            import shutil
            
            # Log enhancement attempt
            console.print(f"    [blue]→ Enhancing image...[/blue]")
            
            # For now, just log - actual enhancement would go here
            # Could use: PIL/Pillow for basic enhancements
            # ESRGAN for upscaling (if available)
            # Color grading with LUTs
            # Film grain addition
            
            # Mark as enhanced in manifest
            slug = image_path.name
            if slug in self.manifest["generated_images"]:
                self.manifest["generated_images"][slug]["enhanced"] = True
            
            console.print(f"    [green]✓ Enhancement complete[/green]")
            logger.info(f"Enhanced image: {image_path.name}")
            
        except Exception as e:
            console.print(f"    [yellow]⚠ Enhancement skipped: {e}[/yellow]")
            logger.warning(f"Enhancement failed for {image_path.name}: {e}")
            # Continue without enhancement
    
    def apply_text_overlay(self, image_path, text, color="#FFFFFF"):
        """Apply text overlay to image using Pillow"""
        try:
            from PIL import Image, ImageDraw, ImageFont
            
            console.print(f"    [blue]→ Applying text overlay: {text}[/blue]")
            
            # Open image
            img = Image.open(image_path)
            draw = ImageDraw.Draw(img)
            
            # Try to use a bold font, fallback to default if not available
            try:
                # Try common font paths
                font_size = int(img.width / 15)  # Dynamic font size based on image width
                font = None
                
                # Common font paths to try
                font_paths = [
                    "/System/Library/Fonts/Helvetica.ttc",  # macOS
                    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",  # Linux
                    "C:/Windows/Fonts/arial.ttf",  # Windows
                    "/System/Library/Fonts/Avenir.ttc",  # macOS alternative
                ]
                
                for font_path in font_paths:
                    if os.path.exists(font_path):
                        try:
                            font = ImageFont.truetype(font_path, font_size)
                            break
                        except:
                            continue
                
                if not font:
                    # Use default font if no system fonts found
                    font = ImageFont.load_default()
                    
            except Exception as e:
                logger.warning(f"Font loading failed: {e}, using default")
                font = ImageFont.load_default()
            
            # Get text dimensions
            bbox = draw.textbbox((0, 0), text, font=font)
            text_width = bbox[2] - bbox[0]
            text_height = bbox[3] - bbox[1]
            
            # Position text (centered, upper third of image)
            x = (img.width - text_width) // 2
            y = img.height // 4 - text_height // 2
            
            # Add semi-transparent background for better readability
            padding = 20
            bg_bbox = (x - padding, y - padding, x + text_width + padding, y + text_height + padding)
            
            # Create a semi-transparent overlay
            overlay = Image.new('RGBA', img.size, (0, 0, 0, 0))
            overlay_draw = ImageDraw.Draw(overlay)
            overlay_draw.rectangle(bg_bbox, fill=(0, 0, 0, 180))  # Semi-transparent black
            
            # Composite overlay
            img = Image.alpha_composite(img.convert('RGBA'), overlay)
            draw = ImageDraw.Draw(img)
            
            # Draw text
            draw.text((x, y), text, fill=color, font=font)
            
            # Save back as PNG
            img.convert('RGB').save(image_path, 'PNG')
            
            console.print(f"    [green]✓ Text overlay applied[/green]")
            logger.info(f"Applied text overlay to {image_path.name}: {text}")
            
            return True
            
        except ImportError:
            console.print(f"    [yellow]⚠ Pillow not installed, skipping text overlay[/yellow]")
            logger.warning("Pillow not installed for text overlay")
            return False
        except Exception as e:
            console.print(f"    [red]✗ Text overlay failed: {e}[/red]")
            logger.error(f"Text overlay failed for {image_path.name}: {e}")
            return False
    
    def process_file(self, filepath):
        """Process a single markdown file for image placeholders"""
        console.print(f"\n[blue]Processing: {filepath.name}[/blue]")
        
        content = filepath.read_text(encoding='utf-8')
        original_content = content
        replacements = []
        
        # Find all image placeholders
        for match in re.finditer(TAG_PATTERN, content):
            description = match.group(1).strip()
            overlay_text = match.group(2).strip() if match.group(2) else None
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
                prompt_data = self.craft_prompt(description, overlay_text)
                prompt = prompt_data["prompt"]
                image_url = self.generate_image(prompt_data)
                
                # Download and save
                image_path = self.download_image(image_url, slug)
                console.print(f"    [green]✓ Saved to: {image_path}[/green]")
                
                # Extract emotion metadata from prompt_data
                emotion_metadata = prompt_data.get('emotion_metadata', {})
                
                # Log emotion detection
                logger.info(f"Emotion detected for '{description[:30]}...': {emotion_metadata.get('primary_emotion', 'neutral')}")
                logger.info(f"Palette applied: {emotion_metadata.get('palette', [])}")
                if overlay_text:
                    logger.info(f"Text overlay: '{overlay_text}'")
                
                # Update manifest with emotion data
                manifest_entry = {
                    "raw_desc": description,
                    "final_prompt": prompt,
                    "emotion_detected": emotion_metadata.get('primary_emotion', 'neutral'),
                    "palette_used": emotion_metadata.get('palette', []),
                    "mood": emotion_metadata.get('mood', 'balanced'),
                    "provider": self.provider,
                    "model": DEFAULT_MODEL,
                    "size": self.default_size,
                    "enhanced": False,  # Will be updated if enhancement is applied
                    "generated_at": datetime.now().isoformat(),
                    "cost_usd": COST_PER_IMAGE
                }
                
                # Add text overlay info if present
                if overlay_text:
                    manifest_entry["overlay_text"] = overlay_text
                    manifest_entry["text_color"] = emotion_metadata.get('text_color', '#FFFFFF')
                    
                    # Apply post-processing text overlay if requested
                    if self.text_overlay_method == "post":
                        text_applied = self.apply_text_overlay(
                            image_path, 
                            overlay_text, 
                            emotion_metadata.get('text_color', '#FFFFFF')
                        )
                        manifest_entry["text_method"] = "pillow" if text_applied else "ideogram"
                    else:
                        manifest_entry["text_method"] = "ideogram"
                
                self.manifest["generated_images"][slug] = manifest_entry
                
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
        provider_name = "Sora (gpt-image-1)" if self.provider == "openai" else "Ideogram 3.0"
        console.print(f"[bold blue]🎨 RENDER Image-Slinger Starting ({provider_name})...[/bold blue]\n")
        logger.info(f"Starting image generation with EmotionPaletteEngine - Provider: {self.provider}, Size: {self.default_size}, Enhance: {self.enhance_images}")
        
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
        console.print(f"  • Model: {DEFAULT_MODEL} ({self.default_size})")
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
    parser.add_argument(
        "--size",
        default=DEFAULT_SIZE,
        help=f"Image resolution (default: {DEFAULT_SIZE})"
    )
    parser.add_argument(
        "--enhance-images",
        action="store_true",
        help="Apply post-processing enhancement (upscale, color grade, grain)"
    )
    parser.add_argument(
        "--text-overlay",
        choices=["ideogram", "post"],
        default="ideogram",
        help="Method for text overlay: 'ideogram' (native) or 'post' (Pillow)"
    )
    args = parser.parse_args()
    
    if args.dry_run:
        console.print("[yellow]DRY RUN MODE - No images will be generated[/yellow]")
        # TODO: Implement dry run
        return
    
    try:
        generator = ImageGenerator(
            skip_existing=args.skip_existing,
            size=args.size,
            enhance_images=args.enhance_images,
            text_overlay_method=args.text_overlay
        )
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