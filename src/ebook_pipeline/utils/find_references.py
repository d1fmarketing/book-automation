#!/usr/bin/env python3
"""
Search for specific references across all chapters
"""
import re
import sys
from collections import defaultdict
from pathlib import Path

import click
import frontmatter
from rich.console import Console
from rich.table import Table
from rich.text import Text

console = Console()

class ReferenceFinder:
    def __init__(self):
        self.chapters_dir = Path("chapters")
        self.results = defaultdict(list)

    def search(self, query, case_sensitive=False, whole_word=False, regex=False):
        """Search for query across all chapters"""
        console.print(f"[bold blue]🔍 Searching for: '{query}'[/bold blue]\n")

        chapter_files = sorted(self.chapters_dir.glob("*.md"))
        total_matches = 0

        for filepath in chapter_files:
            matches = self.search_in_file(filepath, query, case_sensitive, whole_word, regex)
            if matches:
                self.results[filepath.name] = matches
                total_matches += len(matches)

        # Display results
        self.display_results(query, total_matches)

    def search_in_file(self, filepath, query, case_sensitive, whole_word, regex):
        """Search for query in a single file"""
        with open(filepath, 'r', encoding='utf-8') as f:
            post = frontmatter.load(f)

        content = post.content
        lines = content.split('\n')
        matches = []

        # Prepare search pattern
        if regex:
            pattern = query
        else:
            # Escape special regex characters if not using regex
            pattern = re.escape(query)
            if whole_word:
                pattern = r'\b' + pattern + r'\b'

        flags = 0 if case_sensitive else re.IGNORECASE

        # Search line by line
        for line_num, line in enumerate(lines, 1):
            try:
                if regex:
                    found = re.search(pattern, line, flags)
                else:
                    found = re.search(pattern, line, flags)

                if found:
                    matches.append({
                        'line_num': line_num,
                        'line': line.strip(),
                        'match': found.group(),
                        'start': found.start(),
                        'end': found.end(),
                        'chapter': post.get('chap', '00'),
                        'title': post.get('title', 'Untitled')
                    })
            except re.error as e:
                console.print(f"[red]Regex error: {e}[/red]")
                sys.exit(1)

        return matches

    def display_results(self, query, total_matches):
        """Display search results"""
        if not self.results:
            console.print(f"[yellow]No matches found for '{query}'[/yellow]")
            return

        console.print(f"[green]Found {total_matches} matches in {len(self.results)} files:[/green]\n")

        # Create results table
        table = Table(show_header=True, header_style="bold blue")
        table.add_column("Location", style="cyan", width=20)
        table.add_column("Context", style="white", width=80)

        for filename, matches in sorted(self.results.items()):
            for match in matches:
                # Format location
                location = f"Ch {match['chapter']}, line {match['line_num']}"

                # Format context with highlighting
                context = match['line']
                if len(context) > 100:
                    # Truncate long lines around the match
                    start = max(0, match['start'] - 40)
                    end = min(len(context), match['end'] + 40)
                    context = "..." + context[start:end] + "..."

                # Highlight the match
                highlighted = Text(context)
                match_start = context.find(match['match'])
                if match_start != -1:
                    highlighted.stylize("bold yellow", match_start, match_start + len(match['match']))

                table.add_row(location, highlighted)

        console.print(table)

        # Summary by chapter
        console.print("\n[bold]Summary by Chapter:[/bold]")
        chapter_counts = defaultdict(int)
        for filename, matches in self.results.items():
            if matches:
                chapter_num = matches[0]['chapter']
                chapter_title = matches[0]['title']
                chapter_counts[f"Chapter {chapter_num}: {chapter_title}"] = len(matches)

        for chapter, count in sorted(chapter_counts.items()):
            console.print(f"  • {chapter}: {count} matches")

    def search_character_dialogue(self, character_name):
        """Search for all dialogue by a specific character"""
        console.print(f"[bold blue]💬 Searching for dialogue by: {character_name}[/bold blue]\n")

        dialogue_pattern = rf'{character_name}[^"]*"([^"]+)"'
        chapter_files = sorted(self.chapters_dir.glob("*.md"))
        all_dialogue = []

        for filepath in chapter_files:
            with open(filepath, 'r', encoding='utf-8') as f:
                post = frontmatter.load(f)

            content = post.content
            matches = re.findall(dialogue_pattern, content, re.IGNORECASE)

            if matches:
                chapter_num = post.get('chap', '00')
                for dialogue in matches:
                    all_dialogue.append({
                        'chapter': chapter_num,
                        'dialogue': dialogue,
                        'file': filepath.name
                    })

        # Display dialogue
        if all_dialogue:
            console.print(f"[green]Found {len(all_dialogue)} lines of dialogue:[/green]\n")
            for item in all_dialogue:
                console.print(f"[cyan]Chapter {item['chapter']}:[/cyan] \"{item['dialogue']}\"")
        else:
            console.print(f"[yellow]No dialogue found for {character_name}[/yellow]")

    def search_scenes(self, location):
        """Search for all scenes in a specific location"""
        console.print(f"[bold blue]📍 Searching for scenes in: {location}[/bold blue]\n")

        # Patterns that indicate scene location
        location_patterns = [
            rf'at the {location}',
            rf'in the {location}',
            rf'entered the {location}',
            rf'inside the {location}',
            rf'{location}[,\.]',
        ]

        chapter_files = sorted(self.chapters_dir.glob("*.md"))
        scenes = []

        for filepath in chapter_files:
            with open(filepath, 'r', encoding='utf-8') as f:
                post = frontmatter.load(f)

            content = post.content
            lines = content.split('\n')

            for pattern in location_patterns:
                for line_num, line in enumerate(lines, 1):
                    if re.search(pattern, line, re.IGNORECASE):
                        # Get context (few lines before and after)
                        start = max(0, line_num - 3)
                        end = min(len(lines), line_num + 3)
                        context = '\n'.join(lines[start:end])

                        scenes.append({
                            'chapter': post.get('chap', '00'),
                            'line_num': line_num,
                            'context': context,
                            'file': filepath.name
                        })
                        break  # One match per pattern per file

        # Display scenes
        if scenes:
            console.print(f"[green]Found {len(scenes)} scenes in {location}:[/green]\n")
            for scene in scenes:
                console.print(f"[cyan]Chapter {scene['chapter']}, line {scene['line_num']}:[/cyan]")
                console.print(f"[dim]{scene['context']}[/dim]\n")
                console.print("-" * 80)
        else:
            console.print(f"[yellow]No scenes found in {location}[/yellow]")

@click.command()
@click.argument('query')
@click.option('-c', '--case-sensitive', is_flag=True, help='Case sensitive search')
@click.option('-w', '--whole-word', is_flag=True, help='Match whole words only')
@click.option('-r', '--regex', is_flag=True, help='Use regex pattern')
@click.option('-d', '--dialogue', is_flag=True, help='Search for character dialogue')
@click.option('-s', '--scene', is_flag=True, help='Search for scenes in location')
def main(query, case_sensitive, whole_word, regex, dialogue, scene):
    """Search for references across all chapters"""
    finder = ReferenceFinder()

    if dialogue:
        finder.search_character_dialogue(query)
    elif scene:
        finder.search_scenes(query)
    else:
        finder.search(query, case_sensitive, whole_word, regex)

if __name__ == "__main__":
    main()
