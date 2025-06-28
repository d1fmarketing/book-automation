#!/usr/bin/env python3
"""
Checks for continuity errors and inconsistencies across chapters
"""
import os
import sys
import re
import yaml
import json
from pathlib import Path
from collections import defaultdict
import frontmatter
from rich.console import Console
from rich.table import Table
from rich import print as rprint
from datetime import datetime

console = Console()

class ContinuityChecker:
    def __init__(self):
        self.chapters_dir = Path("chapters")
        self.context_dir = Path("context")
        self.story_bible = self.load_story_bible()
        self.errors = []
        self.warnings = []
        
    def load_story_bible(self):
        """Load the story bible for reference"""
        bible_path = self.context_dir / "story-bible.yaml"
        if bible_path.exists():
            with open(bible_path, 'r', encoding='utf-8') as f:
                return yaml.safe_load(f)
        return {}
        
    def check_all_chapters(self):
        """Run all continuity checks"""
        console.print("[bold blue]🔍 Running continuity checks...[/bold blue]\n")
        
        # Ensure context directory exists
        self.context_dir.mkdir(exist_ok=True)
        
        # Create initial empty report to ensure file exists
        self.save_detailed_report()
        
        chapters = self.load_all_chapters()
        
        # Run various checks
        self.check_character_consistency(chapters)
        self.check_timeline_consistency(chapters)
        self.check_location_consistency(chapters)
        self.check_object_tracking(chapters)
        self.check_name_spelling(chapters)
        self.check_pov_consistency(chapters)
        self.check_repeated_information(chapters)
        
        # Generate and save final report
        self.generate_report()
        
    def load_all_chapters(self):
        """Load all chapters into memory"""
        chapters = {}
        chapter_files = sorted(self.chapters_dir.glob("*.md"))
        
        for filepath in chapter_files:
            with open(filepath, 'r', encoding='utf-8') as f:
                post = frontmatter.load(f)
                chapter_num = post.get('chap', '00')
                chapters[chapter_num] = {
                    'content': post.content,
                    'metadata': dict(post.metadata),
                    'file': filepath.name
                }
                
        return chapters
        
    def check_character_consistency(self, chapters):
        """Check for character description inconsistencies"""
        character_details = defaultdict(dict)
        
        # Patterns to look for character descriptions
        patterns = {
            'hair': r'(\w+)\s+(?:had|has)\s+(\w+)\s+hair',
            'eyes': r'(\w+)\'s?\s+eyes?\s+(?:were|was|are|is)\s+(\w+)',
            'height': r'(\w+)\s+(?:was|is|stood)\s+(\w+)\s+(?:tall|short)',
        }
        
        for chapter_num, chapter_data in sorted(chapters.items(), key=lambda x: str(x[0])):
            content = chapter_data['content']
            
            for detail_type, pattern in patterns.items():
                matches = re.findall(pattern, content, re.IGNORECASE)
                for character, detail in matches:
                    character = character.capitalize()
                    
                    if detail_type in character_details[character]:
                        # Check for consistency
                        if character_details[character][detail_type]['detail'] != detail.lower():
                            self.errors.append({
                                'type': 'Character Inconsistency',
                                'severity': 'ERROR',
                                'chapter': chapter_num,
                                'message': f"{character}'s {detail_type} described as '{detail}' but was '{character_details[character][detail_type]['detail']}' in chapter {character_details[character][detail_type]['chapter']}"
                            })
                    else:
                        character_details[character][detail_type] = {
                            'detail': detail.lower(),
                            'chapter': chapter_num
                        }
                        
    def check_timeline_consistency(self, chapters):
        """Check for timeline inconsistencies"""
        timeline_markers = []
        
        # Look for time indicators
        time_patterns = [
            r'(\d+)\s+days?\s+(?:later|after|since)',
            r'(\d+)\s+weeks?\s+(?:later|after|since)',
            r'(\d+)\s+months?\s+(?:later|after|since)',
            r'the\s+next\s+(\w+)',  # next day, next morning, etc.
            r'(\w+)\s+morning',
            r'(\w+)\s+evening',
        ]
        
        for chapter_num, chapter_data in sorted(chapters.items(), key=lambda x: str(x[0])):
            content = chapter_data['content']
            
            for pattern in time_patterns:
                matches = re.findall(pattern, content, re.IGNORECASE)
                for match in matches:
                    timeline_markers.append({
                        'chapter': chapter_num,
                        'marker': match,
                        'pattern': pattern
                    })
                    
        # Check for logical progression
        # This is simplified - you'd want more sophisticated timeline tracking
        self.analyze_timeline_logic(timeline_markers)
        
    def check_location_consistency(self, chapters):
        """Check for location description inconsistencies"""
        location_details = defaultdict(list)
        
        # Patterns for location descriptions
        patterns = [
            r'the\s+(\w+\s*\w*)\s+(?:was|were|had|stood)\s+([^.]+)',
            r'(?:in|at)\s+the\s+(\w+\s*\w*),?\s+([^.]+)',
        ]
        
        for chapter_num, chapter_data in sorted(chapters.items(), key=lambda x: str(x[0])):
            content = chapter_data['content']
            
            # Extract location descriptions
            for pattern in patterns:
                matches = re.findall(pattern, content, re.IGNORECASE)
                for location, description in matches:
                    if len(description) < 100:  # Avoid overly long captures
                        location_details[location.lower()].append({
                            'chapter': chapter_num,
                            'description': description.strip()
                        })
                        
        # Check for contradictions
        for location, details in location_details.items():
            if len(details) > 1:
                # Simple check - look for contradicting descriptors
                descriptions = [d['description'] for d in details]
                self.check_description_consistency(location, descriptions, details)
                
    def check_object_tracking(self, chapters):
        """Track important objects through chapters"""
        object_locations = defaultdict(list)
        
        # Get important objects from story bible
        important_objects = []
        if 'objects' in self.story_bible:
            important_objects = [obj['name'].lower() for obj in self.story_bible['objects']]
            
        # Also look for common important items
        important_objects.extend(['key', 'letter', 'book', 'weapon', 'map', 'ring'])
        
        for chapter_num, chapter_data in sorted(chapters.items(), key=lambda x: str(x[0])):
            content = chapter_data['content'].lower()
            
            for obj in important_objects:
                if obj in content:
                    # Try to determine where the object is
                    patterns = [
                        f'(?:put|placed|left|dropped)\\s+the\\s+{obj}\\s+(?:in|on|at)\\s+(\\w+)',
                        f'the\\s+{obj}\\s+(?:was|lay|sat)\\s+(?:in|on|at)\\s+(?:the\\s+)?(\\w+)',
                        f'(?:took|grabbed|picked up)\\s+the\\s+{obj}'
                    ]
                    
                    for pattern in patterns:
                        matches = re.findall(pattern, content)
                        for match in matches:
                            object_locations[obj].append({
                                'chapter': chapter_num,
                                'action': pattern,
                                'location': match if isinstance(match, str) else 'taken'
                            })
                            
    def check_name_spelling(self, chapters):
        """Check for inconsistent character name spellings"""
        all_names = defaultdict(list)
        
        # Extract all capitalized words that could be names
        for chapter_num, chapter_data in sorted(chapters.items(), key=lambda x: str(x[0])):
            content = chapter_data['content']
            
            # Find all capitalized words
            words = re.findall(r'\b[A-Z][a-z]+\b', content)
            for word in words:
                all_names[word.lower()].append({
                    'spelling': word,
                    'chapter': chapter_num
                })
                
        # Check for similar names that might be misspellings
        names_list = list(all_names.keys())
        for i, name1 in enumerate(names_list):
            for name2 in names_list[i+1:]:
                if self.are_similar_names(name1, name2):
                    self.warnings.append({
                        'type': 'Possible Name Misspelling',
                        'severity': 'WARNING',
                        'message': f"Found similar names: '{name1}' and '{name2}' - could be a misspelling"
                    })
                    
    def check_pov_consistency(self, chapters):
        """Check for POV consistency within chapters"""
        # Get expected POV from story bible
        expected_pov = self.story_bible.get('book', {}).get('point_of_view', '')
        
        for chapter_num, chapter_data in sorted(chapters.items(), key=lambda x: str(x[0])):
            content = chapter_data['content']
            
            # Check for POV indicators
            first_person_indicators = len(re.findall(r'\b(I|me|my|myself)\b', content))
            third_person_indicators = len(re.findall(r'\b(he|she|his|her|they)\b', content))
            
            # Simple heuristic - if mixing is significant, flag it
            total_indicators = first_person_indicators + third_person_indicators
            if total_indicators > 50:  # Enough text to analyze
                first_ratio = first_person_indicators / total_indicators
                
                if 0.2 < first_ratio < 0.8:  # Significant mixing
                    self.warnings.append({
                        'type': 'POV Consistency',
                        'severity': 'WARNING',
                        'chapter': chapter_num,
                        'message': f"Possible POV mixing detected (First person: {first_ratio:.0%})"
                    })
                    
    def check_repeated_information(self, chapters):
        """Check for information that's repeated too often"""
        information_patterns = defaultdict(list)
        
        # Look for explanatory sentences
        for chapter_num, chapter_data in sorted(chapters.items(), key=lambda x: str(x[0])):
            content = chapter_data['content']
            sentences = content.split('.')
            
            for sentence in sentences:
                if len(sentence) > 20:  # Meaningful sentences
                    # Normalize for comparison
                    normalized = ' '.join(sentence.lower().split())
                    information_patterns[normalized].append(chapter_num)
                    
        # Flag sentences that appear in multiple chapters
        for sentence, chapters_list in information_patterns.items():
            if len(chapters_list) > 1:
                self.warnings.append({
                    'type': 'Repeated Information',
                    'severity': 'WARNING',
                    'message': f"Similar sentence appears in chapters: {', '.join(chapters_list)}",
                    'detail': sentence[:100] + '...' if len(sentence) > 100 else sentence
                })
                
    def are_similar_names(self, name1, name2):
        """Check if two names are similar (possible misspelling)"""
        # Levenshtein distance would be better, but keeping it simple
        if abs(len(name1) - len(name2)) > 2:
            return False
            
        differences = sum(1 for c1, c2 in zip(name1, name2) if c1 != c2)
        return differences <= 2
        
    def check_description_consistency(self, item, descriptions, details):
        """Check if descriptions are consistent"""
        # Look for contradicting adjectives
        colors = ['red', 'blue', 'green', 'yellow', 'black', 'white', 'brown', 'gray', 'grey']
        sizes = ['large', 'small', 'big', 'tiny', 'huge', 'massive', 'little']
        
        found_colors = defaultdict(list)
        found_sizes = defaultdict(list)
        
        for i, desc in enumerate(descriptions):
            desc_lower = desc.lower()
            for color in colors:
                if color in desc_lower:
                    found_colors[color].append(details[i]['chapter'])
            for size in sizes:
                if size in desc_lower:
                    found_sizes[size].append(details[i]['chapter'])
                    
        # Check for conflicts
        if len(found_colors) > 1:
            self.warnings.append({
                'type': 'Description Inconsistency',
                'severity': 'WARNING',
                'message': f"{item.title()} described with different colors: {', '.join(found_colors.keys())}"
            })
            
    def analyze_timeline_logic(self, markers):
        """Analyze timeline markers for logical consistency"""
        # This is a simplified check - real implementation would be more sophisticated
        chapter_times = defaultdict(list)
        
        for marker in markers:
            chapter_times[marker['chapter']].append(marker['marker'])
            
        # Basic check: look for "next day" followed by "week later" in same chapter
        for chapter, times in chapter_times.items():
            time_strings = [str(t) for t in times]
            if any('next' in s for s in time_strings) and any('week' in s for s in time_strings):
                self.warnings.append({
                    'type': 'Timeline Warning',
                    'severity': 'WARNING',
                    'chapter': chapter,
                    'message': "Multiple time jumps in single chapter - verify timeline consistency"
                })
                
    def generate_report(self):
        """Generate continuity check report"""
        console.print("\n[bold]📋 Continuity Check Report[/bold]\n")
        
        if not self.errors and not self.warnings:
            console.print("[green]✅ No continuity issues found![/green]")
            return
            
        # Display errors
        if self.errors:
            error_table = Table(title="❌ Errors (Must Fix)", show_header=True)
            error_table.add_column("Type", style="red")
            error_table.add_column("Chapter", style="cyan")
            error_table.add_column("Issue", style="white")
            
            for error in self.errors:
                error_table.add_row(
                    error['type'],
                    error.get('chapter', 'N/A'),
                    error['message']
                )
                
            console.print(error_table)
            
        # Display warnings
        if self.warnings:
            warning_table = Table(title="⚠️  Warnings (Should Review)", show_header=True)
            warning_table.add_column("Type", style="yellow")
            warning_table.add_column("Details", style="white")
            
            for warning in self.warnings[:10]:  # Limit to first 10
                warning_table.add_row(
                    warning['type'],
                    warning['message']
                )
                if 'detail' in warning:
                    warning_table.add_row("", f"  → {warning['detail']}")
                    
            console.print(warning_table)
            
            if len(self.warnings) > 10:
                console.print(f"\n[yellow]... and {len(self.warnings) - 10} more warnings[/yellow]")
                
        # Save detailed report
        self.save_detailed_report()
        
    def save_detailed_report(self):
        """Save detailed report to file"""
        report_path = self.context_dir / "continuity-report.json"
        
        report = {
            'timestamp': datetime.now().isoformat(),
            'summary': {
                'errors': len(self.errors),
                'warnings': len(self.warnings)
            },
            'errors': self.errors,
            'warnings': self.warnings
        }
        
        with open(report_path, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, ensure_ascii=False)
            
        console.print(f"\n[blue]Detailed report saved to {report_path}[/blue]")
        
def main():
    checker = ContinuityChecker()
    checker.check_all_chapters()
    
    # Exit with error code if errors found
    if checker.errors:
        sys.exit(1)
    else:
        sys.exit(0)
    
if __name__ == "__main__":
    main()