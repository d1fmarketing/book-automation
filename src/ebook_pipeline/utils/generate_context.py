#!/usr/bin/env python3
"""
Generates and updates CONTEXT.md based on all chapters and story bible
"""
import os
import sys
import json
import yaml
from pathlib import Path
from datetime import datetime
import frontmatter
from rich.console import Console
from rich import print as rprint
import re

console = Console()

class ContextGenerator:
    def __init__(self):
        self.chapters_dir = Path("chapters")
        self.context_dir = Path("context")
        self.story_bible = self.load_story_bible()
        self.chapter_summaries = self.load_chapter_summaries()
        self.current_chapter = None
        self.last_chapter = None
        
    def load_story_bible(self):
        """Load story bible"""
        bible_path = self.context_dir / "story-bible.yaml"
        if bible_path.exists():
            with open(bible_path, 'r', encoding='utf-8') as f:
                return yaml.safe_load(f)
        return {}
        
    def load_chapter_summaries(self):
        """Load chapter summaries if they exist"""
        summaries_path = self.context_dir / "chapter-summaries.json"
        if summaries_path.exists():
            with open(summaries_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        return {}
        
    def generate_context(self):
        """Generate updated context file"""
        console.print("[bold blue]🔄 Generating context update...[/bold blue]\n")
        
        # Find current and last chapter
        self.identify_current_chapter()
        
        # Build context sections
        context_data = {
            'current_position': self.get_current_position(),
            'story_progress': self.get_story_progress(),
            'next_goals': self.get_next_chapter_goals(),
            'continuity_reminders': self.get_continuity_reminders(),
            'writing_notes': self.get_writing_notes(),
            'avoid_repetition': self.get_avoid_repetition(),
            'foreshadowing': self.get_foreshadowing(),
            'pacing_notes': self.get_pacing_notes(),
            'cross_references': self.get_cross_references(),
        }
        
        # Generate the context file
        self.write_context_file(context_data)
        
        console.print("[green]✓ Context updated successfully![/green]")
        
    def identify_current_chapter(self):
        """Identify the current chapter being worked on"""
        chapter_files = sorted(self.chapters_dir.glob("*.md"))
        
        if not chapter_files:
            self.current_chapter = 1
            self.last_chapter = None
            return
            
        # Find the last completed chapter and current draft
        completed_chapters = []
        draft_chapters = []
        
        for filepath in chapter_files:
            with open(filepath, 'r', encoding='utf-8') as f:
                post = frontmatter.load(f)
                chapter_num = int(post.get('chap', 0))
                status = post.get('status', 'draft')
                
                if status == 'final':
                    completed_chapters.append(chapter_num)
                elif status in ['draft', 'review']:
                    draft_chapters.append(chapter_num)
                    
        if draft_chapters:
            self.current_chapter = min(draft_chapters)
        else:
            self.current_chapter = max(completed_chapters) + 1 if completed_chapters else 1
            
        if completed_chapters:
            self.last_chapter = max(completed_chapters)
            
    def get_current_position(self):
        """Get current position in the book"""
        current_file = self.chapters_dir / f"chapter-{str(self.current_chapter).zfill(2)}-*.md"
        matching_files = list(self.chapters_dir.glob(f"chapter-{str(self.current_chapter).zfill(2)}-*.md"))
        
        if matching_files:
            with open(matching_files[0], 'r', encoding='utf-8') as f:
                post = frontmatter.load(f)
                return {
                    'chapter': self.current_chapter,
                    'status': post.get('status', 'draft'),
                    'words_written': post.get('words', 0),
                    'words_target': post.get('words_target', 2000)
                }
        else:
            return {
                'chapter': self.current_chapter,
                'status': 'not started',
                'words_written': 0,
                'words_target': 2000
            }
            
    def get_story_progress(self):
        """Get story progress summary"""
        progress = {
            'last_chapter': None,
            'summary_so_far': [],
            'character_status': {},
            'active_plots': []
        }
        
        if self.last_chapter:
            # Get last chapter details
            last_chapter_key = f"chapter_{str(self.last_chapter).zfill(2)}"
            if last_chapter_key in self.chapter_summaries:
                last_summary = self.chapter_summaries[last_chapter_key]
                progress['last_chapter'] = {
                    'number': self.last_chapter,
                    'title': last_summary.get('title', ''),
                    'ended_with': last_summary.get('last_line', ''),
                    'key_developments': last_summary.get('key_events', [])
                }
                
        # Build summary of all chapters
        for i in range(1, self.current_chapter):
            chapter_key = f"chapter_{str(i).zfill(2)}"
            if chapter_key in self.chapter_summaries:
                summary = self.chapter_summaries[chapter_key]
                progress['summary_so_far'].append({
                    'chapter': i,
                    'title': summary.get('title', ''),
                    'summary': summary.get('summary', '')
                })
                
        # Character status from story bible and summaries
        if 'characters' in self.story_bible:
            for char_type, char_data in self.story_bible['characters'].items():
                if isinstance(char_data, dict) and 'name' in char_data:
                    char_name = char_data['name']
                    progress['character_status'][char_name] = {
                        'introduced': self.is_character_introduced(char_name),
                        'last_seen': self.get_character_last_seen(char_name),
                        'relationships': char_data.get('relationships', [])
                    }
                    
        # Active plot threads from story bible
        if 'plot' in self.story_bible or 'plot_threads' in self.story_bible:
            progress['active_plots'] = self.get_active_plots()
            
        return progress
        
    def get_next_chapter_goals(self):
        """Get goals for the next chapter"""
        goals = {
            'must_include': [],
            'must_avoid': []
        }
        
        # Based on current chapter number and story structure
        if self.current_chapter == 1:
            goals['must_include'] = [
                "Introduction of main character",
                "Establish setting",
                "Hook the reader",
                "Set the tone"
            ]
            goals['must_avoid'] = [
                "Info dumping",
                "Starting with character waking up (cliché)",
                "Long descriptions without action"
            ]
        else:
            # Get from story bible plot structure
            act = self.determine_current_act()
            if act == 1:
                goals['must_include'].append("Build toward inciting incident")
            elif act == 2:
                goals['must_include'].append("Develop rising action")
            elif act == 3:
                goals['must_include'].append("Move toward climax")
                
        return goals
        
    def get_continuity_reminders(self):
        """Get continuity reminders"""
        reminders = {
            'character_details': {},
            'world_details': {},
            'important_objects': {}
        }
        
        # From story bible
        if 'characters' in self.story_bible:
            for char_type, char_data in self.story_bible['characters'].items():
                if isinstance(char_data, dict) and 'name' in char_data:
                    reminders['character_details'][char_data['name']] = {
                        'description': char_data.get('physical_description', ''),
                        'personality': char_data.get('personality_traits', []),
                        'speech_pattern': char_data.get('speech_patterns', '')
                    }
                    
        if 'world' in self.story_bible:
            world = self.story_bible['world']
            if 'locations' in world:
                for location in world['locations']:
                    reminders['world_details'][location['name']] = location.get('description', '')
                    
        if 'objects' in self.story_bible:
            for obj in self.story_bible['objects']:
                reminders['important_objects'][obj['name']] = {
                    'description': obj.get('description', ''),
                    'last_location': self.get_object_last_location(obj['name'])
                }
                
        return reminders
        
    def get_writing_notes(self):
        """Get writing notes and reminders"""
        return {
            'recent_feedback': self.get_recent_feedback(),
            'style_reminders': [
                "Follow guidelines in WRITING-RULES.md",
                "Maintain consistent POV",
                "Show don't tell"
            ],
            'research_needed': self.get_research_needed()
        }
        
    def get_avoid_repetition(self):
        """Get list of things to avoid repeating"""
        avoid = {
            'scenes_used': [],
            'phrases_to_avoid': [],
            'revealed_info': []
        }
        
        # Get from chapter summaries
        for chapter_key, summary in self.chapter_summaries.items():
            if 'key_events' in summary:
                avoid['scenes_used'].extend(summary['key_events'])
                
        # Get repeated phrases from analysis (if available)
        analysis_file = self.context_dir / "repeated-phrases.json"
        if analysis_file.exists():
            with open(analysis_file, 'r', encoding='utf-8') as f:
                repeated = json.load(f)
                avoid['phrases_to_avoid'] = repeated.get('common_phrases', [])[:5]
                
        return avoid
        
    def get_foreshadowing(self):
        """Get foreshadowing elements to plant"""
        foreshadowing = {
            'plant_seeds': [],
            'subtle_hints': []
        }
        
        # Based on story bible plot structure
        if 'plot' in self.story_bible:
            plot = self.story_bible['plot']
            if 'three_act_structure' in plot:
                # Determine what to foreshadow based on current position
                if self.current_chapter < 5:
                    if 'midpoint' in plot['three_act_structure']['act_2']:
                        foreshadowing['plant_seeds'].append(
                            f"Hint at: {plot['three_act_structure']['act_2']['midpoint']}"
                        )
                        
        return foreshadowing
        
    def get_pacing_notes(self):
        """Get pacing guidance"""
        total_chapters = self.estimate_total_chapters()
        current_progress = self.current_chapter / total_chapters if total_chapters else 0
        
        if current_progress < 0.25:
            pace = "Building"
            act = "Act 1 - Setup"
        elif current_progress < 0.75:
            pace = "Accelerating"
            act = "Act 2 - Rising Action"
        else:
            pace = "Climactic"
            act = "Act 3 - Resolution"
            
        return {
            'overall_pace': pace,
            'current_act': act,
            'tension_level': self.get_tension_level()
        }
        
    def get_cross_references(self):
        """Get cross-reference suggestions"""
        return {
            'callbacks': self.get_callback_opportunities(),
            'setups': self.get_setup_opportunities()
        }
        
    # Helper methods
    def is_character_introduced(self, character_name):
        """Check if character has been introduced"""
        for chapter_key, summary in self.chapter_summaries.items():
            if character_name in summary.get('characters', []):
                return True
        return False
        
    def get_character_last_seen(self, character_name):
        """Get last chapter where character appeared"""
        last_seen = None
        for chapter_key, summary in sorted(self.chapter_summaries.items(), reverse=True):
            if character_name in summary.get('characters', []):
                chapter_num = int(chapter_key.split('_')[1])
                return chapter_num
        return last_seen
        
    def get_object_last_location(self, object_name):
        """Get last known location of an object"""
        # This would be tracked through chapter analysis
        return "Unknown"
        
    def determine_current_act(self):
        """Determine which act we're in"""
        total_chapters = self.estimate_total_chapters()
        if not total_chapters:
            return 1
            
        progress = self.current_chapter / total_chapters
        if progress < 0.25:
            return 1
        elif progress < 0.75:
            return 2
        else:
            return 3
            
    def estimate_total_chapters(self):
        """Estimate total number of chapters"""
        # Could be set in story bible or estimated from word count
        return 20  # Default estimate
        
    def get_recent_feedback(self):
        """Get recent feedback if available"""
        feedback_file = self.context_dir / "feedback.txt"
        if feedback_file.exists():
            with open(feedback_file, 'r', encoding='utf-8') as f:
                return f.read().strip()
        return None
        
    def get_research_needed(self):
        """Get research items from story bible"""
        if 'research' in self.story_bible:
            return [item['topic'] for item in self.story_bible['research']]
        return []
        
    def get_tension_level(self):
        """Determine current tension level"""
        act = self.determine_current_act()
        if act == 1:
            return "Building"
        elif act == 2:
            if self.current_chapter > 10:
                return "High"
            return "Rising"
        else:
            return "Peak"
            
    def get_callback_opportunities(self):
        """Identify callback opportunities"""
        callbacks = []
        # Look for events from early chapters that could be referenced
        for i in range(1, min(self.current_chapter, 3)):
            chapter_key = f"chapter_{str(i).zfill(2)}"
            if chapter_key in self.chapter_summaries:
                summary = self.chapter_summaries[chapter_key]
                if summary.get('key_events'):
                    callbacks.append(f"Chapter {i}: {summary['key_events'][0]}")
        return callbacks
        
    def get_setup_opportunities(self):
        """Identify setup opportunities for future chapters"""
        setups = []
        # Based on plot structure
        if 'plot' in self.story_bible:
            if 'climax' in self.story_bible['plot'].get('three_act_structure', {}).get('act_3', {}):
                setups.append("Plant seeds for climax")
        return setups
        
    def write_context_file(self, context_data):
        """Write the context file"""
        context_path = self.context_dir / "CONTEXT.md"
        
        # Build the markdown content
        content = [
            "# Current Writing Context",
            "",
            "> This file maintains the current state of the book writing process.",
            "> **ALWAYS READ THIS FILE BEFORE WRITING ANY CHAPTER**",
            "",
            "## 📍 Current Position",
            "",
            f"**Current Chapter**: {context_data['current_position']['chapter']}  ",
            f"**Status**: {context_data['current_position']['status']}  ",
            f"**Words Written**: {context_data['current_position']['words_written']} / {context_data['current_position']['words_target']} target",
            "",
            "## 📖 Story Progress Summary",
            ""
        ]
        
        # Last chapter section
        if context_data['story_progress']['last_chapter']:
            last = context_data['story_progress']['last_chapter']
            content.extend([
                "### Last Chapter Completed",
                f"- **Chapter**: {last['number']} - {last['title']}",
                f"- **Ended with**: {last['ended_with']}",
                "- **Key developments**:"
            ])
            for event in last['key_developments']:
                content.append(f"  - {event}")
            content.append("")
        else:
            content.extend([
                "### Last Chapter Completed",
                "- **Chapter**: N/A (Starting fresh)",
                "- **Ended with**: N/A",
                "- **Key developments**: N/A",
                ""
            ])
            
        # What's happened so far
        content.extend([
            "### What's Happened So Far"
        ])
        if context_data['story_progress']['summary_so_far']:
            for chapter in context_data['story_progress']['summary_so_far']:
                content.append(f"{chapter['chapter']}. **{chapter['title']}**: {chapter['summary'][:100]}...")
        else:
            content.append("1. Nothing yet - ready to begin!")
        content.append("")
        
        # Character status
        content.extend([
            "### Character Status"
        ])
        if context_data['story_progress']['character_status']:
            for char, status in context_data['story_progress']['character_status'].items():
                if status['introduced']:
                    content.append(f"- **{char}**: Last seen in chapter {status['last_seen']}")
                else:
                    content.append(f"- **{char}**: Not yet introduced")
        else:
            content.append("- **Protagonist**: Not yet introduced")
            content.append("- **Key relationships**: None established")
        content.append("")
        
        # Active plot threads
        content.extend([
            "### Active Plot Threads"
        ])
        if context_data['story_progress']['active_plots']:
            for plot in context_data['story_progress']['active_plots']:
                content.append(f"- {plot}")
        else:
            content.append("- None yet")
        content.append("")
        
        # Next chapter goals
        content.extend([
            "## 🎯 Next Chapter Goals",
            "",
            "### Must Include"
        ])
        for goal in context_data['next_goals']['must_include']:
            content.append(f"- [ ] {goal}")
        content.extend([
            "",
            "### Must Avoid"
        ])
        for avoid in context_data['next_goals']['must_avoid']:
            content.append(f"- [ ] {avoid}")
        content.append("")
        
        # Continuity reminders
        content.extend([
            "## 🔄 Continuity Reminders",
            "",
            "### Character Details to Remember"
        ])
        if context_data['continuity_reminders']['character_details']:
            for char, details in context_data['continuity_reminders']['character_details'].items():
                content.append(f"- **{char}**: {details['description']}")
        else:
            content.append("- N/A")
        content.extend([
            "",
            "### World Details Established"
        ])
        if context_data['continuity_reminders']['world_details']:
            for location, description in context_data['continuity_reminders']['world_details'].items():
                content.append(f"- **{location}**: {description[:100]}...")
        else:
            content.append("- N/A")
        content.extend([
            "",
            "### Important Objects/Items"
        ])
        if context_data['continuity_reminders']['important_objects']:
            for obj, details in context_data['continuity_reminders']['important_objects'].items():
                content.append(f"- **{obj}**: {details['description']}")
        else:
            content.append("- N/A")
        content.append("")
        
        # Writing notes
        content.extend([
            "## 📝 Writing Notes",
            "",
            "### Recent Feedback"
        ])
        feedback = context_data['writing_notes']['recent_feedback']
        content.append(f"- {feedback}" if feedback else "- N/A")
        content.extend([
            "",
            "### Style Reminders"
        ])
        for reminder in context_data['writing_notes']['style_reminders']:
            content.append(f"- {reminder}")
        content.extend([
            "",
            "### Research Needed"
        ])
        if context_data['writing_notes']['research_needed']:
            for item in context_data['writing_notes']['research_needed']:
                content.append(f"- {item}")
        else:
            content.append("- N/A")
        content.append("")
        
        # Avoid repetition
        content.extend([
            "## 🚫 Do NOT Repeat",
            "",
            "### Scenes/Events Already Used"
        ])
        if context_data['avoid_repetition']['scenes_used']:
            for scene in context_data['avoid_repetition']['scenes_used'][:5]:
                content.append(f"- {scene[:100]}...")
        else:
            content.append("- N/A")
        content.extend([
            "",
            "### Phrases to Avoid"
        ])
        if context_data['avoid_repetition']['phrases_to_avoid']:
            for phrase in context_data['avoid_repetition']['phrases_to_avoid']:
                content.append(f"- \"{phrase}\"")
        else:
            content.append("- N/A")
        content.extend([
            "",
            "### Plot Points Already Revealed"
        ])
        if context_data['avoid_repetition']['revealed_info']:
            for info in context_data['avoid_repetition']['revealed_info']:
                content.append(f"- {info}")
        else:
            content.append("- N/A")
        content.append("")
        
        # Foreshadowing
        content.extend([
            "## 💡 Upcoming Foreshadowing",
            "",
            "### Plant Seeds For"
        ])
        if context_data['foreshadowing']['plant_seeds']:
            for seed in context_data['foreshadowing']['plant_seeds']:
                content.append(f"- {seed}")
        else:
            content.append("- N/A")
        content.extend([
            "",
            "### Subtle Hints About"
        ])
        if context_data['foreshadowing']['subtle_hints']:
            for hint in context_data['foreshadowing']['subtle_hints']:
                content.append(f"- {hint}")
        else:
            content.append("- N/A")
        content.append("")
        
        # Pacing notes
        content.extend([
            "## 📊 Pacing Notes",
            "",
            f"**Overall Pace**: {context_data['pacing_notes']['overall_pace']}  ",
            f"**Current Act**: {context_data['pacing_notes']['current_act']}  ",
            f"**Tension Level**: {context_data['pacing_notes']['tension_level']}  ",
            ""
        ])
        
        # Cross-references
        content.extend([
            "## 🔗 Cross-References",
            "",
            "### Callbacks to Make"
        ])
        if context_data['cross_references']['callbacks']:
            for callback in context_data['cross_references']['callbacks']:
                content.append(f"- {callback}")
        else:
            content.append("- N/A")
        content.extend([
            "",
            "### Setups for Future Chapters"
        ])
        if context_data['cross_references']['setups']:
            for setup in context_data['cross_references']['setups']:
                content.append(f"- {setup}")
        else:
            content.append("- N/A")
        content.extend([
            "",
            "---",
            "",
            f"**Last Updated**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}  ",
            f"**Session**: #{self.get_session_number()}"
        ])
        
        # Write the file
        with open(context_path, 'w', encoding='utf-8') as f:
            f.write('\n'.join(content))
            
    def get_session_number(self):
        """Get current session number"""
        session_file = self.context_dir / ".session"
        if session_file.exists():
            with open(session_file, 'r') as f:
                session = int(f.read().strip())
        else:
            session = 1
            
        # Increment for this session
        with open(session_file, 'w') as f:
            f.write(str(session + 1))
            
        return session
    
    def get_active_plots(self) -> list:
        """Return a list of plot-thread IDs still unresolved in chapters."""
        active = []
        for plot in self.story_bible.get("plot_threads", []):
            if not plot.get("resolved"):
                active.append(plot["id"])
        return active

def main():
    try:
        generator = ContextGenerator()
        
        # Validate directories exist
        if not generator.chapters_dir.exists():
            console.print(f"[red]Error: Chapters directory '{generator.chapters_dir}' not found![/red]")
            sys.exit(1)
            
        if not generator.context_dir.exists():
            console.print(f"[red]Error: Context directory '{generator.context_dir}' not found![/red]")
            sys.exit(1)
            
        generator.generate_context()
        sys.exit(0)
        
    except Exception as e:
        console.print(f"[red]Error generating context: {e}[/red]")
        sys.exit(1)
    
if __name__ == "__main__":
    main()