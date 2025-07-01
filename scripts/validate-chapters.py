#!/usr/bin/env python3
"""
Validate chapter files for book automation pipeline
Ensures all chapters meet requirements defined in workflow rules
"""

import os
import sys
import re
import glob
import yaml
import json
from typing import Dict, List, Tuple, Optional
from pathlib import Path
from collections import defaultdict


class ChapterValidator:
    """Validates chapter markdown files"""
    
    REQUIRED_FRONTMATTER = {
        'chap': (int, str),  # Chapter number
        'title': str,        # Chapter title
        'words_target': int, # Target word count
        'words': int,        # Actual word count
        'status': str        # draft, review, final
    }
    
    VALID_STATUSES = ['draft', 'review', 'final']
    MIN_WORDS_PER_CHAPTER = 500
    MAX_WORDS_PER_CHAPTER = 10000
    
    def __init__(self, chapters_dir: str = 'chapters'):
        self.chapters_dir = Path(chapters_dir)
        self.errors: List[str] = []
        self.warnings: List[str] = []
        self.chapter_stats: Dict = defaultdict(dict)
    
    def validate(self) -> Tuple[bool, List[str], List[str], Dict]:
        """
        Validate all chapter files
        Returns: (is_valid, errors, warnings, stats)
        """
        # Check directory exists
        if not self.chapters_dir.exists():
            self.errors.append(f"Chapters directory not found: {self.chapters_dir}")
            return False, self.errors, self.warnings, {}
        
        # Find all markdown files
        chapter_files = sorted(glob.glob(str(self.chapters_dir / '*.md')))
        
        if not chapter_files:
            self.errors.append(f"No chapter files found in {self.chapters_dir}")
            return False, self.errors, self.warnings, {}
        
        # Validate each chapter
        for chapter_file in chapter_files:
            self._validate_chapter(chapter_file)
        
        # Check overall structure
        self._validate_chapter_sequence()
        self._check_placeholders()
        self._generate_stats()
        
        return len(self.errors) == 0, self.errors, self.warnings, dict(self.chapter_stats)
    
    def _validate_chapter(self, filepath: str):
        """Validate individual chapter file"""
        filename = os.path.basename(filepath)
        
        # Check naming convention
        if not re.match(r'^chapter-\d{2}-[\w-]+\.md$', filename):
            self.warnings.append(
                f"Non-standard filename: {filename}. "
                "Expected format: chapter-XX-slug.md"
            )
        
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
        except Exception as e:
            self.errors.append(f"Cannot read {filename}: {e}")
            return
        
        # Extract and validate frontmatter
        frontmatter, body = self._extract_frontmatter(content)
        
        if not frontmatter:
            self.errors.append(f"No frontmatter found in {filename}")
            return
        
        self._validate_frontmatter(filename, frontmatter)
        
        # Validate content
        self._validate_content(filename, body, frontmatter)
        
        # Store stats
        self.chapter_stats[filename] = {
            'frontmatter': frontmatter,
            'word_count': self._count_words(body),
            'has_title': bool(re.search(r'^#\s+.+', body, re.MULTILINE)),
            'placeholders': self._find_placeholders(body)
        }
    
    def _extract_frontmatter(self, content: str) -> Tuple[Optional[Dict], str]:
        """Extract YAML frontmatter from markdown content"""
        pattern = r'^---\s*\n(.*?)\n---\s*\n(.*)$'
        match = re.match(pattern, content, re.DOTALL)
        
        if not match:
            return None, content
        
        try:
            frontmatter = yaml.safe_load(match.group(1))
            body = match.group(2)
            return frontmatter, body
        except yaml.YAMLError as e:
            self.errors.append(f"Invalid YAML frontmatter: {e}")
            return None, content
    
    def _validate_frontmatter(self, filename: str, frontmatter: Dict):
        """Validate chapter frontmatter"""
        # Check required fields
        for field, expected_type in self.REQUIRED_FRONTMATTER.items():
            if field not in frontmatter:
                self.errors.append(f"{filename}: Missing required frontmatter field: {field}")
            else:
                self._check_type(f"{filename}.{field}", frontmatter[field], expected_type)
        
        # Validate specific fields
        if 'status' in frontmatter and frontmatter['status'] not in self.VALID_STATUSES:
            self.errors.append(
                f"{filename}: Invalid status '{frontmatter['status']}'. "
                f"Must be one of: {', '.join(self.VALID_STATUSES)}"
            )
        
        # Check word count accuracy
        if 'words' in frontmatter and 'words_target' in frontmatter:
            if frontmatter['words'] > frontmatter['words_target'] * 1.2:
                self.warnings.append(
                    f"{filename}: Word count ({frontmatter['words']}) "
                    f"exceeds target ({frontmatter['words_target']}) by >20%"
                )
    
    def _validate_content(self, filename: str, body: str, frontmatter: Dict):
        """Validate chapter content"""
        # Check word count constraints
        word_count = self._count_words(body)
        
        if word_count < self.MIN_WORDS_PER_CHAPTER:
            self.errors.append(
                f"{filename}: Word count ({word_count}) below minimum ({self.MIN_WORDS_PER_CHAPTER})"
            )
        elif word_count > self.MAX_WORDS_PER_CHAPTER:
            self.errors.append(
                f"{filename}: Word count ({word_count}) exceeds maximum ({self.MAX_WORDS_PER_CHAPTER})"
            )
        
        # Check for chapter title
        if not re.search(r'^#\s+.+', body, re.MULTILINE):
            self.warnings.append(f"{filename}: No H1 chapter title found")
        
        # Check frontmatter word count matches actual
        if 'words' in frontmatter:
            reported = frontmatter['words']
            if abs(reported - word_count) > 50:  # Allow 50 word variance
                self.warnings.append(
                    f"{filename}: Frontmatter word count ({reported}) "
                    f"doesn't match actual ({word_count})"
                )
        
        # Check for common markdown issues
        self._check_markdown_issues(filename, body)
    
    def _check_markdown_issues(self, filename: str, content: str):
        """Check for common markdown problems"""
        issues = []
        
        # Check for broken links
        broken_links = re.findall(r'\[([^\]]+)\]\(\s*\)', content)
        if broken_links:
            issues.append(f"Empty link(s): {', '.join(broken_links[:3])}")
        
        # Check for multiple consecutive blank lines
        if re.search(r'\n\n\n+', content):
            issues.append("Multiple consecutive blank lines")
        
        # Check for unclosed formatting
        for marker in ['**', '*', '_', '`']:
            count = content.count(marker)
            if count % 2 != 0:
                issues.append(f"Unclosed {marker} formatting")
        
        if issues:
            self.warnings.append(f"{filename}: Markdown issues - {'; '.join(issues)}")
    
    def _count_words(self, text: str) -> int:
        """Count words in text, excluding markdown syntax"""
        # Remove markdown elements
        text = re.sub(r'```[\s\S]*?```', '', text)  # Code blocks
        text = re.sub(r'`[^`]+`', '', text)  # Inline code
        text = re.sub(r'!\[([^\]]*)\]\([^)]+\)', '', text)  # Images
        text = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', text)  # Links
        text = re.sub(r'[*_]{1,2}([^*_]+)[*_]{1,2}', r'\1', text)  # Bold/italic
        text = re.sub(r'^#+\s+', '', text, flags=re.MULTILINE)  # Headers
        text = re.sub(r'^>\s+', '', text, flags=re.MULTILINE)  # Blockquotes
        text = re.sub(r'^\s*[-*+]\s+', '', text, flags=re.MULTILINE)  # Lists
        
        # Count words
        words = re.findall(r'\b\w+\b', text)
        return len(words)
    
    def _find_placeholders(self, content: str) -> List[str]:
        """Find AI-IMAGE and other placeholders"""
        placeholders = []
        
        # Find AI-IMAGE placeholders
        ai_images = re.findall(r'!\[([^\]]*)\]\(AI-IMAGE:[^)]+\)', content)
        placeholders.extend([f"AI-IMAGE: {desc}" for desc in ai_images])
        
        # Find TODO markers
        todos = re.findall(r'TODO:?\s*([^\n]+)', content)
        placeholders.extend([f"TODO: {todo}" for todo in todos])
        
        # Find FIXME markers
        fixmes = re.findall(r'FIXME:?\s*([^\n]+)', content)
        placeholders.extend([f"FIXME: {fixme}" for fixme in fixmes])
        
        return placeholders
    
    def _validate_chapter_sequence(self):
        """Validate chapter numbering sequence"""
        chapter_numbers = []
        
        for filename, stats in self.chapter_stats.items():
            if 'frontmatter' in stats and 'chap' in stats['frontmatter']:
                chap = stats['frontmatter']['chap']
                try:
                    num = int(chap) if isinstance(chap, (int, str)) else None
                    if num:
                        chapter_numbers.append((num, filename))
                except ValueError:
                    self.warnings.append(f"{filename}: Non-numeric chapter number: {chap}")
        
        # Check for gaps or duplicates
        chapter_numbers.sort()
        seen = set()
        
        for num, filename in chapter_numbers:
            if num in seen:
                self.errors.append(f"Duplicate chapter number {num} in {filename}")
            seen.add(num)
        
        # Check sequence
        if chapter_numbers:
            expected = list(range(1, len(chapter_numbers) + 1))
            actual = [num for num, _ in chapter_numbers]
            
            if actual != expected:
                missing = set(expected) - set(actual)
                if missing:
                    self.warnings.append(
                        f"Missing chapter number(s): {', '.join(map(str, sorted(missing)))}"
                    )
    
    def _check_placeholders(self):
        """Check for unresolved placeholders across all chapters"""
        all_placeholders = []
        
        for filename, stats in self.chapter_stats.items():
            if 'placeholders' in stats and stats['placeholders']:
                for placeholder in stats['placeholders']:
                    all_placeholders.append(f"{filename}: {placeholder}")
        
        if all_placeholders:
            self.warnings.append(
                f"Found {len(all_placeholders)} unresolved placeholder(s):\n" +
                '\n'.join(f"  • {p}" for p in all_placeholders[:10]) +
                ('\n  ...' if len(all_placeholders) > 10 else '')
            )
    
    def _generate_stats(self):
        """Generate overall statistics"""
        total_words = 0
        chapter_count = len(self.chapter_stats)
        status_counts = defaultdict(int)
        
        for stats in self.chapter_stats.values():
            if 'word_count' in stats:
                total_words += stats['word_count']
            
            if 'frontmatter' in stats and 'status' in stats['frontmatter']:
                status_counts[stats['frontmatter']['status']] += 1
        
        self.chapter_stats['_summary'] = {
            'total_chapters': chapter_count,
            'total_words': total_words,
            'average_words': total_words // chapter_count if chapter_count > 0 else 0,
            'status_breakdown': dict(status_counts)
        }
    
    def _check_type(self, field_path: str, value, expected_type):
        """Check if value matches expected type"""
        if isinstance(expected_type, tuple):
            if not any(isinstance(value, t) for t in expected_type):
                self.errors.append(
                    f"{field_path}: Wrong type. Expected one of {expected_type}, got {type(value).__name__}"
                )
        else:
            if not isinstance(value, expected_type):
                self.errors.append(
                    f"{field_path}: Wrong type. Expected {expected_type.__name__}, got {type(value).__name__}"
                )
    
    def print_report(self):
        """Print validation report"""
        print("=== Chapter Validation Report ===\n")
        
        if self.errors:
            print(f"❌ Found {len(self.errors)} error(s):")
            for error in self.errors:
                print(f"  • {error}")
            print()
        
        if self.warnings:
            print(f"⚠️  Found {len(self.warnings)} warning(s):")
            for warning in self.warnings:
                print(f"  • {warning}")
            print()
        
        # Print summary stats
        if '_summary' in self.chapter_stats:
            summary = self.chapter_stats['_summary']
            print("📊 Summary:")
            print(f"  • Total chapters: {summary['total_chapters']}")
            print(f"  • Total words: {summary['total_words']:,}")
            print(f"  • Average words/chapter: {summary['average_words']:,}")
            
            if summary['status_breakdown']:
                print("  • Status breakdown:")
                for status, count in summary['status_breakdown'].items():
                    print(f"    - {status}: {count}")
            print()
        
        if not self.errors and not self.warnings:
            print("✅ All chapters validated successfully!")
        
        return len(self.errors) == 0


def main():
    """Main entry point"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Validate book chapters')
    parser.add_argument(
        'chapters_dir',
        nargs='?',
        default='chapters',
        help='Path to chapters directory (default: chapters)'
    )
    parser.add_argument(
        '--quiet', '-q',
        action='store_true',
        help='Only show errors, not warnings'
    )
    parser.add_argument(
        '--json',
        action='store_true',
        help='Output as JSON'
    )
    parser.add_argument(
        '--fix-word-counts',
        action='store_true',
        help='Update word counts in frontmatter'
    )
    
    args = parser.parse_args()
    
    validator = ChapterValidator(args.chapters_dir)
    is_valid, errors, warnings, stats = validator.validate()
    
    if args.fix_word_counts:
        # Import and use the word count updater
        sys.path.insert(0, 'src')
        try:
            from ebook_pipeline.utils.wordcount import update_all_word_counts
            print("Updating word counts...")
            update_all_word_counts()
            print("Word counts updated. Re-validating...")
            # Re-validate after update
            validator = ChapterValidator(args.chapters_dir)
            is_valid, errors, warnings, stats = validator.validate()
        except ImportError:
            print("Warning: Could not import word count updater")
    
    if args.json:
        result = {
            'valid': is_valid,
            'errors': errors,
            'warnings': warnings if not args.quiet else [],
            'stats': stats
        }
        print(json.dumps(result, indent=2))
    else:
        if args.quiet:
            validator.warnings = []
        validator.print_report()
    
    sys.exit(0 if is_valid else 1)


if __name__ == '__main__':
    main()