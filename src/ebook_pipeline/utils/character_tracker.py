#!/usr/bin/env python3
"""
Track character appearances, development, and interactions throughout the book
"""
import os
import re
import yaml
import json
from pathlib import Path
from collections import defaultdict, Counter
import frontmatter
from rich.console import Console
from rich.table import Table
from rich.tree import Tree
from rich import print as rprint
import click
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches

console = Console()

class CharacterTracker:
    def __init__(self):
        self.chapters_dir = Path("chapters")
        self.context_dir = Path("context")
        self.story_bible = self.load_story_bible()
        self.character_data = defaultdict(lambda: {
            'appearances': [],
            'dialogue_count': 0,
            'interactions': defaultdict(int),
            'descriptions': [],
            'development': []
        })
        
    def load_story_bible(self):
        """Load story bible for character information"""
        bible_path = self.context_dir / "story-bible.yaml"
        if bible_path.exists():
            with open(bible_path, 'r', encoding='utf-8') as f:
                return yaml.safe_load(f)
        return {}
        
    def track_all_characters(self):
        """Track all characters across all chapters"""
        console.print("[bold blue]👥 Tracking all characters...[/bold blue]\n")
        
        chapter_files = sorted(self.chapters_dir.glob("*.md"))
        
        for filepath in chapter_files:
            self.analyze_chapter_for_characters(filepath)
            
        # Generate reports
        self.display_character_summary()
        self.save_character_data()
        
    def track_specific_character(self, character_name):
        """Track a specific character's journey"""
        console.print(f"[bold blue]🔍 Tracking character: {character_name}[/bold blue]\n")
        
        chapter_files = sorted(self.chapters_dir.glob("*.md"))
        
        for filepath in chapter_files:
            self.analyze_chapter_for_character(filepath, character_name)
            
        # Display character journey
        self.display_character_journey(character_name)
        
    def analyze_chapter_for_characters(self, filepath):
        """Analyze a chapter for all character appearances"""
        with open(filepath, 'r', encoding='utf-8') as f:
            post = frontmatter.load(f)
            
        chapter_num = post.get('chap', '00')
        content = post.content
        
        # Get known characters from story bible
        known_characters = self.get_known_characters()
        
        # Also detect potential character names (capitalized words appearing multiple times)
        potential_characters = self.detect_character_names(content)
        
        all_characters = known_characters.union(potential_characters)
        
        for character in all_characters:
            if self.character_appears(character, content):
                # Track appearance
                self.character_data[character]['appearances'].append({
                    'chapter': chapter_num,
                    'file': filepath.name
                })
                
                # Count dialogue
                dialogue_count = self.count_character_dialogue(character, content)
                self.character_data[character]['dialogue_count'] += dialogue_count
                
                # Track interactions
                interactions = self.find_character_interactions(character, content, all_characters)
                for other_char in interactions:
                    self.character_data[character]['interactions'][other_char] += 1
                    
                # Extract descriptions
                descriptions = self.extract_character_descriptions(character, content)
                if descriptions:
                    self.character_data[character]['descriptions'].extend([
                        {'chapter': chapter_num, 'description': desc} for desc in descriptions
                    ])
                    
    def analyze_chapter_for_character(self, filepath, character_name):
        """Analyze a chapter for a specific character"""
        with open(filepath, 'r', encoding='utf-8') as f:
            post = frontmatter.load(f)
            
        chapter_num = post.get('chap', '00')
        content = post.content
        
        if self.character_appears(character_name, content):
            # Get detailed information
            lines = content.split('\n')
            appearances = []
            
            for line_num, line in enumerate(lines, 1):
                if re.search(rf'\b{character_name}\b', line, re.IGNORECASE):
                    # Get context
                    start = max(0, line_num - 2)
                    end = min(len(lines), line_num + 2)
                    context = '\n'.join(lines[start:end])
                    
                    appearances.append({
                        'line_num': line_num,
                        'context': context,
                        'line': line.strip()
                    })
                    
            self.character_data[character_name]['appearances'].append({
                'chapter': chapter_num,
                'file': filepath.name,
                'details': appearances
            })
            
    def get_known_characters(self):
        """Get known characters from story bible"""
        characters = set()
        
        if 'characters' in self.story_bible:
            for char_type, char_data in self.story_bible['characters'].items():
                if isinstance(char_data, dict) and 'name' in char_data:
                    characters.add(char_data['name'])
                elif isinstance(char_data, list):
                    for char in char_data:
                        if isinstance(char, dict) and 'name' in char:
                            characters.add(char['name'])
                            
        return characters
        
    def detect_character_names(self, content):
        """Detect potential character names in content"""
        # Find capitalized words that appear multiple times
        words = re.findall(r'\b[A-Z][a-z]+\b', content)
        word_counts = Counter(words)
        
        # Filter out common words and require minimum appearances
        common_words = {'The', 'This', 'That', 'They', 'There', 'These', 'Those',
                       'Chapter', 'Part', 'Section', 'Page'}
        
        potential_characters = {
            word for word, count in word_counts.items()
            if count >= 3 and word not in common_words
        }
        
        return potential_characters
        
    def character_appears(self, character, content):
        """Check if character appears in content"""
        return bool(re.search(rf'\b{character}\b', content, re.IGNORECASE))
        
    def count_character_dialogue(self, character, content):
        """Count dialogue instances for a character"""
        # Pattern: Character said/says "..."
        dialogue_patterns = [
            rf'{character}\s+(?:said|says|asked|asks|replied|replies|shouted|shouts|whispered|whispers)[^"]*"[^"]+"',
            rf'"[^"]+"\s+(?:said|says|asked|asks|replied|replies)\s+{character}',
        ]
        
        count = 0
        for pattern in dialogue_patterns:
            matches = re.findall(pattern, content, re.IGNORECASE)
            count += len(matches)
            
        return count
        
    def find_character_interactions(self, character, content, all_characters):
        """Find which other characters interact with this character"""
        interactions = set()
        
        # Look for sentences containing both characters
        sentences = content.split('.')
        for sentence in sentences:
            if character.lower() in sentence.lower():
                for other_char in all_characters:
                    if other_char != character and other_char.lower() in sentence.lower():
                        interactions.add(other_char)
                        
        return interactions
        
    def extract_character_descriptions(self, character, content):
        """Extract physical and personality descriptions"""
        descriptions = []
        
        # Patterns for descriptions
        desc_patterns = [
            rf'{character}\s+(?:was|is|looked|appeared|seemed)\s+([^.]+)',
            rf'{character}\'s\s+([^.]+(?:hair|eyes|face|smile|voice)[^.]+)',
            rf'(?:His|Her|Their)\s+([^.]+)',  # Only if preceded by character name
        ]
        
        for pattern in desc_patterns[:2]:  # Skip pronoun pattern for now
            matches = re.findall(pattern, content, re.IGNORECASE)
            descriptions.extend([match.strip() for match in matches if len(match) < 200])
            
        return descriptions
        
    def display_character_summary(self):
        """Display summary of all characters"""
        if not self.character_data:
            console.print("[yellow]No characters found[/yellow]")
            return
            
        # Create summary table
        table = Table(title="Character Summary", show_header=True)
        table.add_column("Character", style="cyan")
        table.add_column("Appearances", justify="center")
        table.add_column("Dialogue", justify="center")
        table.add_column("Interactions", justify="center")
        table.add_column("First Seen", style="green")
        table.add_column("Last Seen", style="red")
        
        for character, data in sorted(self.character_data.items()):
            appearances = data['appearances']
            if appearances:
                first_chapter = min(app['chapter'] for app in appearances)
                last_chapter = max(app['chapter'] for app in appearances)
                interaction_count = sum(data['interactions'].values())
                
                table.add_row(
                    character,
                    str(len(appearances)),
                    str(data['dialogue_count']),
                    str(interaction_count),
                    f"Ch {first_chapter}",
                    f"Ch {last_chapter}"
                )
                
        console.print(table)
        
        # Show character relationships
        console.print("\n[bold]Character Relationships:[/bold]")
        for character, data in sorted(self.character_data.items()):
            if data['interactions']:
                console.print(f"\n[cyan]{character}[/cyan] interacts with:")
                for other, count in sorted(data['interactions'].items(), key=lambda x: x[1], reverse=True):
                    console.print(f"  • {other}: {count} times")
                    
    def display_character_journey(self, character_name):
        """Display detailed journey for a specific character"""
        if character_name not in self.character_data:
            console.print(f"[yellow]No data found for {character_name}[/yellow]")
            return
            
        data = self.character_data[character_name]
        
        # Character overview
        console.print(f"\n[bold]Character Journey: {character_name}[/bold]\n")
        
        # Timeline of appearances
        tree = Tree(f"[bold cyan]{character_name}'s Timeline[/bold cyan]")
        
        for appearance in sorted(data['appearances'], key=lambda x: x['chapter']):
            chapter_node = tree.add(f"[green]Chapter {appearance['chapter']}[/green]")
            
            if 'details' in appearance:
                for detail in appearance['details'][:3]:  # Show first 3 occurrences
                    chapter_node.add(f"Line {detail['line_num']}: {detail['line'][:80]}...")
                    
        console.print(tree)
        
        # Character descriptions over time
        if data['descriptions']:
            console.print("\n[bold]Character Development:[/bold]")
            for desc in data['descriptions']:
                console.print(f"  [cyan]Ch {desc['chapter']}:[/cyan] {desc['description']}")
                
        # Dialogue samples
        console.print(f"\n[bold]Dialogue Count:[/bold] {data['dialogue_count']}")
        
        # Interaction network
        if data['interactions']:
            console.print("\n[bold]Interactions:[/bold]")
            for other, count in sorted(data['interactions'].items(), key=lambda x: x[1], reverse=True):
                console.print(f"  • {other}: {count} scenes together")
                
    def create_character_arc_visualization(self, character_name):
        """Create a visual representation of character arc"""
        if character_name not in self.character_data:
            console.print(f"[yellow]No data found for {character_name}[/yellow]")
            return
            
        data = self.character_data[character_name]
        appearances = data['appearances']
        
        if not appearances:
            return
            
        # Prepare data for visualization
        chapters = sorted(set(int(app['chapter']) for app in appearances))
        chapter_activity = Counter(int(app['chapter']) for app in appearances)
        
        # Create plot
        plt.figure(figsize=(12, 6))
        
        # Appearance frequency
        plt.subplot(2, 1, 1)
        plt.bar(chapter_activity.keys(), chapter_activity.values(), color='skyblue', edgecolor='navy')
        plt.xlabel('Chapter')
        plt.ylabel('Appearances')
        plt.title(f'{character_name} - Appearance Frequency')
        plt.grid(axis='y', alpha=0.3)
        
        # Interaction timeline
        plt.subplot(2, 1, 2)
        interaction_chapters = defaultdict(list)
        for other, count in data['interactions'].items():
            # Estimate which chapters had interactions
            for app in appearances:
                interaction_chapters[int(app['chapter'])].append(other)
                
        # Plot interactions
        y_pos = 0
        colors = plt.cm.Set3(range(len(data['interactions'])))
        legend_elements = []
        
        for i, (other, _) in enumerate(data['interactions'].items()):
            for chapter in chapters:
                if other in interaction_chapters[chapter]:
                    plt.scatter(chapter, y_pos, color=colors[i], s=100)
            legend_elements.append(mpatches.Patch(color=colors[i], label=other))
            y_pos += 1
            
        plt.xlabel('Chapter')
        plt.ylabel('Characters')
        plt.title(f'{character_name} - Interaction Timeline')
        plt.legend(handles=legend_elements, loc='upper right')
        plt.grid(axis='x', alpha=0.3)
        
        plt.tight_layout()
        
        # Save plot
        output_path = self.context_dir / f"character_arc_{character_name.lower()}.png"
        plt.savefig(output_path, dpi=300, bbox_inches='tight')
        console.print(f"\n[green]Character arc visualization saved to {output_path}[/green]")
        plt.close()
        
    def save_character_data(self):
        """Save character tracking data to file"""
        output_path = self.context_dir / "character-tracking.json"
        
        # Convert defaultdict to regular dict for JSON serialization
        save_data = {}
        for character, data in self.character_data.items():
            save_data[character] = {
                'appearances': data['appearances'],
                'dialogue_count': data['dialogue_count'],
                'interactions': dict(data['interactions']),
                'descriptions': data['descriptions'],
                'summary': {
                    'total_appearances': len(data['appearances']),
                    'chapters': sorted(set(app['chapter'] for app in data['appearances']))
                }
            }
            
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(save_data, f, indent=2, ensure_ascii=False)
            
        console.print(f"\n[blue]Character data saved to {output_path}[/blue]")

@click.command()
@click.argument('character_name', required=False)
@click.option('-a', '--all', 'track_all', is_flag=True, help='Track all characters')
@click.option('-v', '--visualize', is_flag=True, help='Create character arc visualization')
def main(character_name, track_all, visualize):
    """Track character appearances and development"""
    tracker = CharacterTracker()
    
    if track_all or not character_name:
        tracker.track_all_characters()
    else:
        tracker.track_specific_character(character_name)
        if visualize:
            tracker.create_character_arc_visualization(character_name)

if __name__ == "__main__":
    main()