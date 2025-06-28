#!/usr/bin/env python3
"""
Analyzes all chapters to extract context information for AI awareness
"""
import os
import sys
import json
import yaml
import re
from pathlib import Path
from collections import Counter, defaultdict
import frontmatter
from rich.console import Console
from rich.table import Table
from rich import print as rprint

console = Console()

class ChapterAnalyzer:
    def __init__(self):
        self.chapters_dir = Path("chapters")
        self.context_dir = Path("context")
        self.chapter_data = {}
        self.all_characters = set()
        self.all_locations = set()
        self.word_frequency = Counter()
        self.phrase_frequency = Counter()
        
    def analyze_all_chapters(self):
        """Main analysis function"""
        console.print("[bold blue]📚 Analyzing all chapters...[/bold blue]\n")
        
        chapter_files = sorted(self.chapters_dir.glob("*.md"))
        
        for chapter_file in chapter_files:
            self.analyze_chapter(chapter_file)
            
        # Generate summaries
        self.generate_chapter_summaries()
        self.find_repeated_phrases()
        self.extract_character_mentions()
        self.create_timeline()
        
        console.print("[green]✓ Analysis complete![/green]")
        
    def analyze_chapter(self, filepath):
        """Analyze a single chapter"""
        with open(filepath, 'r', encoding='utf-8') as f:
            post = frontmatter.load(f)
            
        chapter_num = post.get('chap', '00')
        content = post.content
        
        # Extract various elements
        characters = self.extract_characters(content)
        locations = self.extract_locations(content)
        dialogue = self.extract_dialogue(content)
        key_events = self.extract_key_events(content)
        
        # Word frequency analysis
        words = re.findall(r'\b\w+\b', content.lower())
        self.word_frequency.update(words)
        
        # Store chapter data
        self.chapter_data[chapter_num] = {
            'file': filepath.name,
            'title': post.get('title', ''),
            'word_count': len(words),
            'characters': list(characters),
            'locations': list(locations),
            'dialogue_count': len(dialogue),
            'key_events': key_events,
            'summary': self.generate_summary(content),
            'first_line': self.get_first_line(content),
            'last_line': self.get_last_line(content),
            'metadata': dict(post.metadata)
        }
        
        self.all_characters.update(characters)
        self.all_locations.update(locations)
        
    def extract_characters(self, content):
        """Extract character names from content"""
        # Simple pattern - customize based on your naming conventions
        # Looks for capitalized words that appear multiple times
        words = re.findall(r'\b[A-Z][a-z]+\b', content)
        word_counts = Counter(words)
        
        # Consider a word a character name if it appears 3+ times
        characters = {word for word, count in word_counts.items() 
                     if count >= 3 and word not in ['The', 'This', 'That', 'They']}
        
        return characters
        
    def extract_locations(self, content):
        """Extract location names"""
        # Look for "at the", "in the", "to the" + capitalized words
        locations = set()
        patterns = [
            r'(?:at|in|to) the ([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)',
            r'(?:arrived at|went to|left) ([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)'
        ]
        
        for pattern in patterns:
            matches = re.findall(pattern, content)
            locations.update(matches)
            
        return locations
        
    def extract_dialogue(self, content):
        """Extract all dialogue"""
        # Match content between quotes
        dialogue = re.findall(r'"([^"]+)"', content)
        return dialogue
        
    def extract_key_events(self, content):
        """Extract potential key events (action sentences)"""
        # Look for sentences with action verbs
        action_verbs = ['discovered', 'found', 'realized', 'attacked', 'escaped',
                       'revealed', 'confessed', 'died', 'arrived', 'left']
        
        sentences = content.split('.')
        key_events = []
        
        for sentence in sentences:
            if any(verb in sentence.lower() for verb in action_verbs):
                key_events.append(sentence.strip() + '.')
                
        return key_events[:5]  # Top 5 events
        
    def generate_summary(self, content):
        """Generate a brief summary of the chapter"""
        # Get first few sentences
        sentences = content.split('.')[:3]
        summary = '. '.join(sentences) + '.'
        return summary[:200] + '...' if len(summary) > 200 else summary
        
    def get_first_line(self, content):
        """Get the first line of actual content"""
        lines = content.strip().split('\n')
        for line in lines:
            if line.strip() and not line.startswith('#'):
                return line.strip()
        return ""
        
    def get_last_line(self, content):
        """Get the last line of actual content"""
        lines = content.strip().split('\n')
        for line in reversed(lines):
            if line.strip() and not line.startswith('#'):
                return line.strip()
        return ""
        
    def find_repeated_phrases(self):
        """Find phrases that appear in multiple chapters"""
        # Extract 3-4 word phrases from all chapters
        all_phrases = []
        
        for chapter_data in self.chapter_data.values():
            if 'file' in chapter_data:
                filepath = self.chapters_dir / chapter_data['file']
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = frontmatter.load(f).content
                    
                words = re.findall(r'\b\w+\b', content.lower())
                # Create 3-word phrases
                for i in range(len(words) - 2):
                    phrase = ' '.join(words[i:i+3])
                    all_phrases.append(phrase)
                    
        self.phrase_frequency = Counter(all_phrases)
        
    def extract_character_mentions(self):
        """Track where each character appears"""
        character_appearances = defaultdict(list)
        
        for chapter_num, data in self.chapter_data.items():
            for character in data.get('characters', []):
                character_appearances[character].append(chapter_num)
                
        return character_appearances
        
    def create_timeline(self):
        """Create a timeline of events"""
        timeline = []
        
        for chapter_num, data in sorted(self.chapter_data.items(), key=lambda x: str(x[0])):
            timeline.append({
                'chapter': chapter_num,
                'title': data.get('title', ''),
                'events': data.get('key_events', [])[:2]  # Top 2 events
            })
            
        return timeline
        
    def generate_chapter_summaries(self):
        """Generate and save chapter summaries"""
        summaries_file = self.context_dir / "chapter-summaries.json"
        
        summaries = {}
        for chapter_num, data in sorted(self.chapter_data.items(), key=lambda x: str(x[0])):
            summaries[f"chapter_{chapter_num}"] = {
                'title': data.get('title', ''),
                'summary': data.get('summary', ''),
                'characters': data.get('characters', []),
                'locations': data.get('locations', []),
                'word_count': data.get('word_count', 0),
                'first_line': data.get('first_line', ''),
                'last_line': data.get('last_line', ''),
                'key_events': data.get('key_events', [])
            }
            
        with open(summaries_file, 'w', encoding='utf-8') as f:
            json.dump(summaries, f, indent=2, ensure_ascii=False)
            
        console.print(f"[green]✓ Chapter summaries saved to {summaries_file}[/green]")
        
    def generate_report(self):
        """Generate analysis report"""
        console.print("\n[bold]📊 Analysis Report[/bold]\n")
        
        # Chapter overview table
        table = Table(title="Chapter Overview")
        table.add_column("Chapter", style="cyan")
        table.add_column("Title", style="green")
        table.add_column("Words", justify="right")
        table.add_column("Characters", style="yellow")
        table.add_column("Locations", style="blue")
        
        for chapter_num, data in sorted(self.chapter_data.items(), key=lambda x: str(x[0])):
            table.add_row(
                str(chapter_num),
                data.get('title', '')[:30],
                str(data.get('word_count', 0)),
                ', '.join(data.get('characters', []))[:30],
                ', '.join(data.get('locations', []))[:30]
            )
            
        console.print(table)
        
        # Most frequent words (excluding common words)
        common_words = {'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
                       'of', 'with', 'by', 'from', 'up', 'about', 'into', 'through', 'after',
                       'is', 'was', 'are', 'were', 'been', 'be', 'have', 'has', 'had',
                       'he', 'she', 'it', 'they', 'i', 'you', 'we'}
        
        filtered_words = {word: count for word, count in self.word_frequency.items()
                         if word not in common_words and len(word) > 3}
        
        console.print("\n[bold]Most Frequent Significant Words:[/bold]")
        for word, count in Counter(filtered_words).most_common(10):
            console.print(f"  • {word}: {count} times")
            
        # Repeated phrases
        console.print("\n[bold]Most Repeated 3-Word Phrases:[/bold]")
        for phrase, count in self.phrase_frequency.most_common(5):
            if count > 1:  # Only show phrases that appear more than once
                console.print(f"  • '{phrase}': {count} times")
                
        # Character appearances
        console.print("\n[bold]Character Appearances:[/bold]")
        char_appearances = self.extract_character_mentions()
        for character, chapters in sorted(char_appearances.items()):
            console.print(f"  • {character}: Chapters {', '.join(str(ch) for ch in chapters)}")
            
def main():
    try:
        analyzer = ChapterAnalyzer()
        
        # Check if chapters directory exists
        if not analyzer.chapters_dir.exists():
            console.print(f"[red]Error: Chapters directory '{analyzer.chapters_dir}' not found![/red]")
            sys.exit(1)
            
        # Check if there are any chapters
        chapter_files = list(analyzer.chapters_dir.glob("*.md"))
        if not chapter_files:
            console.print("[yellow]Warning: No chapter files found![/yellow]")
            sys.exit(0)  # Not an error, just no work to do
            
        analyzer.analyze_all_chapters()
        analyzer.generate_report()
        sys.exit(0)
        
    except Exception as e:
        console.print(f"[red]Error during analysis: {e}[/red]")
        sys.exit(1)
    
if __name__ == "__main__":
    main()