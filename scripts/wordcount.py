#!/usr/bin/env python3

"""
Word count updater for book chapters
Updates the frontmatter with accurate word counts
"""

import os
import re
import yaml
import argparse
from pathlib import Path
from typing import Dict, Tuple

def count_words(text: str) -> int:
    """Count words in text, excluding markdown syntax"""
    # Remove frontmatter
    text = re.sub(r'^---\n.*?\n---\n', '', text, flags=re.DOTALL)
    
    # Remove markdown elements
    # Headers
    text = re.sub(r'^#{1,6}\s+', '', text, flags=re.MULTILINE)
    # Links
    text = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', text)
    # Images
    text = re.sub(r'!\[([^\]]*)\]\([^\)]+\)', '', text)
    # Bold/italic
    text = re.sub(r'\*{1,3}([^\*]+)\*{1,3}', r'\1', text)
    text = re.sub(r'_{1,3}([^_]+)_{1,3}', r'\1', text)
    # Code blocks
    text = re.sub(r'```[\s\S]*?```', '', text)
    text = re.sub(r'`([^`]+)`', r'\1', text)
    # HTML tags
    text = re.sub(r'<[^>]+>', '', text)
    
    # Count words
    words = text.split()
    return len(words)

def process_chapter(filepath: Path) -> Tuple[int, bool]:
    """Process a single chapter file"""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Extract frontmatter
    match = re.match(r'^---\n(.*?)\n---\n(.*)', content, re.DOTALL)
    if not match:
        print(f"  ⚠️  No frontmatter found in {filepath.name}")
        return 0, False
    
    frontmatter_str = match.group(1)
    body = match.group(2)
    
    # Parse frontmatter
    try:
        frontmatter = yaml.safe_load(frontmatter_str)
    except yaml.YAMLError as e:
        print(f"  ❌ Error parsing frontmatter in {filepath.name}: {e}")
        return 0, False
    
    # Count words
    word_count = count_words(body)
    
    # Update frontmatter if needed
    if frontmatter.get('words') != word_count:
        frontmatter['words'] = word_count
        
        # Rebuild file content
        new_frontmatter = yaml.dump(frontmatter, default_flow_style=False, sort_keys=False)
        new_content = f"---\n{new_frontmatter}---\n{body}"
        
        # Write back
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        
        return word_count, True
    
    return word_count, False

def main():
    parser = argparse.ArgumentParser(description='Update word counts in chapter frontmatter')
    parser.add_argument('--directory', default='chapters', help='Directory containing chapters')
    args = parser.parse_args()
    
    chapters_dir = Path(args.directory)
    if not chapters_dir.exists():
        print(f"❌ Directory not found: {chapters_dir}")
        return
    
    print(f"📊 Updating word counts in {chapters_dir}...\n")
    
    total_words = 0
    updated_count = 0
    
    # Process all markdown files
    for filepath in sorted(chapters_dir.glob('*.md')):
        words, updated = process_chapter(filepath)
        total_words += words
        if updated:
            updated_count += 1
        
        # Get chapter info
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            match = re.search(r'title:\s*"([^"]+)"', content)
            title = match.group(1) if match else filepath.stem
        
        status = "✅ Updated" if updated else "✓ Current"
        print(f"  {status} {filepath.name}: {words:,} words - {title}")
    
    print(f"\n📈 Summary:")
    print(f"  Total words: {total_words:,}")
    print(f"  Files updated: {updated_count}")
    print(f"  Average per chapter: {total_words // max(1, len(list(chapters_dir.glob('*.md')))):,}")

if __name__ == '__main__':
    main()