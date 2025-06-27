#!/usr/bin/env python3
"""Generate ultra-quality images with Sora Image Generation One API"""

import os
import sys
import argparse
from pathlib import Path
from openai import OpenAI
import requests
from PIL import Image
import io
import json
from datetime import datetime

def generate_ultra_image(chapter, number, prompt=None, size="2048x2048", quality="ultra", style="raw", stylize=1200):
    """Generate ultra-quality image with Sora"""
    
    # Initialize OpenAI client
    api_key = os.getenv('OPENAI_API_KEY')
    if not api_key:
        print("❌ Error: OPENAI_API_KEY not set")
        return False
    
    client = OpenAI(api_key=api_key)
    
    # Default ultra prompt if none provided
    if not prompt:
        prompt = f"""Ultra-HD 3-D golden number {number} hovering over a cosmic nebula, 
                    **include the text 'MAGNETIC NEW BEGINNING' in elegant serif lettering 
                    beneath the digits**, sacred-geometry halo, gold light particles forming 
                    angel wings, deep violet→electric-blue gradient, volumetric god-rays, 
                    hyper-realistic, cinematic depth-of-field, octane render"""
    
    print(f"🎨 Generating ULTRA image for Chapter {chapter:02d} - {number}")
    print(f"   Size: {size}")
    print(f"   Quality: {quality}")
    print(f"   Style: {style}")
    print(f"   Stylize: {stylize}")
    print(f"   Prompt: {prompt[:80]}...")
    
    try:
        # Map quality settings for Sora
        quality_map = {
            'ultra': 'high',  # Sora uses 'high' for best quality
            'high': 'high',
            'medium': 'medium',
            'low': 'low'
        }
        
        # Generate with Sora
        response = client.images.generate(
            model="gpt-image-1",  # Sora model
            prompt=prompt,
            size=size if size in ["1024x1024", "1024x1792", "1792x1024"] else "1024x1024",
            quality=quality_map.get(quality, 'high'),
            n=1
        )
        
        # Get image (Sora returns base64)
        image_data = response.data[0]
        
        # Handle base64 or URL response
        if hasattr(image_data, 'b64_json'):
            import base64
            img = Image.open(io.BytesIO(base64.b64decode(image_data.b64_json)))
        elif hasattr(image_data, 'url'):
            # Download from URL
            img_response = requests.get(image_data.url)
            img = Image.open(io.BytesIO(img_response.content))
        else:
            raise ValueError("Unknown response format from Sora")
        
        # Save as PNG for lossless quality
        output_path = Path(f"assets/chap{chapter:02d}-hero.png")
        output_path.parent.mkdir(exist_ok=True)
        
        # Save at maximum quality
        img.save(output_path, 'PNG', optimize=False, compress_level=0)
        
        print(f"   ✅ Saved to: {output_path}")
        print(f"   📐 Actual size: {img.size}")
        
        # Update manifest
        update_manifest(chapter, number, prompt, size, quality, output_path)
        
        return True
        
    except Exception as e:
        print(f"   ❌ Error: {str(e)}")
        return False

def update_manifest(chapter, number, prompt, size, quality, output_path):
    """Update image manifest with generation details"""
    manifest_path = Path("context/image-manifest.json")
    
    # Load existing manifest
    if manifest_path.exists():
        with open(manifest_path, 'r') as f:
            manifest = json.load(f)
    else:
        manifest = {"generated_images": {}, "total_cost_usd": 0.0}
    
    # Add new image
    manifest['generated_images'][output_path.name] = {
        "chapter": chapter,
        "number": number,
        "type": "hero_ultra",
        "prompt": prompt,
        "provider": "openai",
        "model": "gpt-image-1",
        "quality": quality,
        "size": size,
        "cost_usd": 0.08 if quality == "ultra" else 0.04,
        "generated_at": datetime.now().isoformat() + "Z",
        "status": "completed"
    }
    
    # Update total cost
    manifest['total_cost_usd'] = sum(img.get('cost_usd', 0) for img in manifest['generated_images'].values())
    manifest['last_updated'] = datetime.now().isoformat() + "Z"
    
    # Save
    with open(manifest_path, 'w') as f:
        json.dump(manifest, f, indent=2)

def replace_placeholder(chapter):
    """Replace <HERO_IMG> placeholder with actual image link"""
    chapter_files = list(Path("chapters").glob(f"chapter-{chapter:02d}-*.md"))
    
    if not chapter_files:
        print(f"❌ No chapter file found for chapter {chapter}")
        return False
    
    chapter_file = chapter_files[0]
    content = chapter_file.read_text()
    
    # Find and replace placeholder
    if "<HERO_IMG" in content:
        # Extract number from placeholder
        import re
        match = re.search(r'<HERO_IMG\s+(\d+)>', content)
        if match:
            number = match.group(1)
            image_path = f"../assets/chap{chapter:02d}-hero.png"
            new_content = re.sub(r'<HERO_IMG\s+\d+>', f'![Hero]({image_path})', content)
            
            chapter_file.write_text(new_content)
            print(f"✅ Replaced placeholder in {chapter_file.name}")
            return True
    
    return False

def main():
    parser = argparse.ArgumentParser(description='Generate ultra-quality Sora images')
    parser.add_argument('--chapter', type=int, required=True, help='Chapter number')
    parser.add_argument('--number', type=str, help='Angel number')
    parser.add_argument('--prompt', type=str, help='Custom prompt')
    parser.add_argument('--size', default='2048x2048', help='Image size')
    parser.add_argument('--quality', default='ultra', help='Quality level')
    parser.add_argument('--style', default='raw', help='Style mode')
    parser.add_argument('--stylize', type=int, default=1200, help='Stylization strength')
    parser.add_argument('--auto-replace', action='store_true', help='Auto-replace placeholder')
    
    args = parser.parse_args()
    
    # Generate image
    success = generate_ultra_image(
        args.chapter,
        args.number,
        args.prompt,
        args.size,
        args.quality,
        args.style,
        args.stylize
    )
    
    # Auto-replace placeholder if requested
    if success and args.auto_replace:
        replace_placeholder(args.chapter)
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())