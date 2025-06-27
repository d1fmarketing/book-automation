#!/usr/bin/env python3
"""Categorize files in the repository for refactoring"""
import os
import csv
from pathlib import Path

def get_file_category(file_path):
    """Determine the category of a file based on its path and extension"""
    path = Path(file_path)
    name = path.name
    ext = path.suffix.lower()
    parts = path.parts
    
    # Skip hidden files and directories
    if any(part.startswith('.') for part in parts[1:]):  # Skip the root '.'
        if '.husky' in str(path):
            return 'CI/CD'
        elif '.github' in str(path):
            return 'CI/CD'
        return 'Config'
    
    # Tests
    if 'test' in str(path) or '__test__' in str(path):
        return 'Tests'
    
    # Documentation
    if ext in ['.md', '.txt', '.rst'] and name.upper() in ['README.MD', 'CHANGELOG.MD', 'LICENSE', 'CONTRIBUTING.MD']:
        return 'Docs'
    elif ext == '.md' and any(doc in name.lower() for doc in ['readme', 'guide', 'doc', 'usage']):
        return 'Docs'
    
    # Code files
    if ext == '.py':
        if 'agents' in parts:
            return 'Code-Agents'
        elif 'scripts' in parts:
            return 'Code-Scripts'
        return 'Code'
    elif ext in ['.js', '.ts', '.jsx', '.tsx']:
        return 'Code-JS'
    
    # Configuration
    if ext in ['.json', '.yaml', '.yml', '.toml', '.ini', '.cfg']:
        return 'Config'
    elif name in ['Makefile', 'Dockerfile', '.gitignore', '.env', '.editorconfig']:
        return 'Config'
    elif name.startswith('.env'):
        return 'Config'
    
    # Assets
    if 'assets' in parts or 'images' in parts:
        return 'Assets'
    elif ext in ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico']:
        return 'Assets'
    elif ext in ['.ttf', '.otf', '.woff', '.woff2']:
        return 'Assets'
    elif ext in ['.css', '.scss', '.sass']:
        return 'Assets'
    
    # Build artifacts
    if 'build' in parts or 'dist' in parts:
        return 'Build'
    
    # Logs
    if 'logs' in parts or ext == '.log':
        return 'Logs'
    
    # Context files
    if 'context' in parts:
        return 'Context'
    
    # Chapter files
    if 'chapters' in parts and ext == '.md':
        return 'Content'
    
    # Shell scripts
    if ext in ['.sh', '.bash']:
        return 'Scripts'
    
    return 'Other'

def should_keep_file(file_path, category):
    """Determine if a file should be kept"""
    # Always keep important files
    important_files = [
        'package.json', 'requirements.txt', 'Makefile', '.gitignore',
        'metadata.yaml', 'pyproject.toml', 'setup.py', 'setup.cfg'
    ]
    
    if Path(file_path).name in important_files:
        return True
    
    # Keep all code, tests, config, and content
    if category in ['Code', 'Code-Agents', 'Code-Scripts', 'Code-JS', 'Tests', 
                    'Config', 'Content', 'Context', 'CI/CD']:
        return True
    
    # Keep essential docs
    if category == 'Docs' and any(doc in file_path.upper() for doc in ['README', 'CLAUDE', 'CONTRIBUTING']):
        return True
    
    # Keep assets
    if category == 'Assets':
        return True
    
    # Skip logs and build artifacts
    if category in ['Logs', 'Build']:
        return False
    
    return True

def suggest_new_path(file_path, category):
    """Suggest a new path for better organization"""
    path = Path(file_path)
    name = path.name
    
    # Agent files
    if category == 'Code-Agents':
        # Map specific agent files
        agent_map = {
            'image_prompt_agent.py': 'src/ebook_pipeline/agents/image_prompt_agent.py',
            'emotion_palette_engine.py': 'src/ebook_pipeline/agents/emotion_palette.py',
            'omnicreator.py': 'src/ebook_pipeline/agents/omnicreator.py',
            'book_builder.py': 'src/ebook_pipeline/agents/book_builder.py',
            'landing_page_builder.py': 'src/ebook_pipeline/agents/landing_page_builder.py',
        }
        if name in agent_map:
            return agent_map[name]
        return f"src/ebook_pipeline/agents/{name}"
    
    # Script files
    if category == 'Code-Scripts':
        if name.endswith('.py'):
            # Core scripts go to src/
            core_scripts = ['wordcount.py', 'continuity-check.py', 'analyze-chapters.py',
                          'generate-context.py', 'find-references.py', 'character-tracker.py']
            if name in core_scripts:
                return f"src/ebook_pipeline/utils/{name.replace('-', '_')}"
            # Image generation scripts
            elif 'image' in name:
                return f"src/ebook_pipeline/generators/{name.replace('-', '_')}"
    
    # Test files - flatten structure
    if category == 'Tests':
        if 'test_' in name:
            return f"tests/unit/{name}"
    
    # Documentation consolidation
    if category == 'Docs':
        if name.upper() == 'README.MD':
            return 'README.md'  # Keep at root
        elif 'SORA' in name.upper():
            return f"docs/sora/{name}"
        elif name.upper() != 'CLAUDE.MD':  # Keep CLAUDE.md at root
            return f"docs/{name}"
    
    # Config files stay mostly the same
    if category == 'Config':
        if name in ['.env.omnicreator']:
            return f"config/{name}"
    
    # No change
    return ""

def main():
    """Generate file categorization CSV"""
    with open('refactor/file_list.txt', 'r') as f:
        files = [line.strip() for line in f if line.strip()]
    
    rows = []
    for file_path in files:
        if os.path.isfile(file_path):
            try:
                size = os.path.getsize(file_path)
                category = get_file_category(file_path)
                keep = 'Y' if should_keep_file(file_path, category) else 'N'
                new_path = suggest_new_path(file_path, category)
                
                rows.append({
                    'Path': file_path,
                    'Size': size,
                    'Category': category,
                    'Keep': keep,
                    'New-Path': new_path
                })
            except:
                pass
    
    # Write CSV
    with open('refactor/file_map.csv', 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=['Path', 'Size', 'Category', 'Keep', 'New-Path'])
        writer.writeheader()
        writer.writerows(rows)
    
    # Print summary
    print("File categorization complete!")
    print(f"Total files: {len(rows)}")
    
    # Category counts
    categories = {}
    for row in rows:
        cat = row['Category']
        categories[cat] = categories.get(cat, 0) + 1
    
    print("\nCategory breakdown:")
    for cat, count in sorted(categories.items()):
        print(f"  {cat}: {count}")
    
    # Files to keep/remove
    keep_count = sum(1 for row in rows if row['Keep'] == 'Y')
    print(f"\nFiles to keep: {keep_count}")
    print(f"Files to remove: {len(rows) - keep_count}")

if __name__ == '__main__':
    main()