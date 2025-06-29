#!/usr/bin/env python3
"""
MasterOrchestrator: The AI Brain that coordinates all agents to write complete books
"""
import json
import logging
import os
import sys
import yaml
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger('MasterOrchestrator')


@dataclass
class BookProject:
    """Book project configuration"""
    title: str
    subtitle: str = ""
    author: str = "AI Author"
    target_audience: Dict[str, Any] = field(default_factory=dict)
    book_specs: Dict[str, Any] = field(default_factory=dict)
    style: Dict[str, Any] = field(default_factory=dict)
    monetization: Dict[str, Any] = field(default_factory=dict)
    research_sources: List[Dict[str, Any]] = field(default_factory=list)
    
    @classmethod
    def from_yaml(cls, path: str = "book-project.yaml") -> 'BookProject':
        """Load project configuration from YAML"""
        if not Path(path).exists():
            raise FileNotFoundError(f"Project file not found: {path}")
            
        with open(path, 'r', encoding='utf-8') as f:
            data = yaml.safe_load(f)
            
        project = data.get('project', {})
        return cls(
            title=project.get('title', 'Untitled Book'),
            subtitle=project.get('subtitle', ''),
            author=project.get('author', 'AI Author'),
            target_audience=data.get('target_audience', {}),
            book_specs=data.get('book_specs', {}),
            style=data.get('style', {}),
            monetization=data.get('monetization', {}),
            research_sources=data.get('research_sources', [])
        )


class MasterOrchestrator:
    """The maestro that coordinates all agents to create books"""
    
    def __init__(self, project_file: str = "book-project.yaml"):
        """Initialize the orchestrator with project configuration"""
        self.project = BookProject.from_yaml(project_file)
        self.agents = self._initialize_agents()
        self.state_file = Path("orchestrator-state.json")
        self.state = self._load_state()
        
    def _initialize_agents(self) -> Dict[str, Any]:
        """Initialize all agent instances"""
        agents = {}
        
        # Import agents as needed to avoid circular dependencies
        try:
            from ebook_pipeline.agents.book_planner_agent import BookPlannerAgent
            agents['planner'] = BookPlannerAgent(self.project)
        except ImportError:
            logger.warning("BookPlannerAgent not available yet")
            
        try:
            from ebook_pipeline.agents.ai_writer_agent import AIWriterAgent
            agents['writer'] = AIWriterAgent(self.project)
        except ImportError:
            logger.warning("AIWriterAgent not available yet")
            
        try:
            from ebook_pipeline.agents.research_agent import ResearchAgent
            agents['researcher'] = ResearchAgent(self.project)
        except ImportError:
            logger.warning("ResearchAgent not available yet")
            
        # Use existing agents
        from ebook_pipeline.agents.image_prompt_agent import ImagePromptAgent
        from ebook_pipeline.agents.book_builder import BookBuilder
        from ebook_pipeline.agents.landing_page_builder import LandingPageBuilder
        
        agents['image'] = ImagePromptAgent()
        agents['builder'] = BookBuilder(self._get_book_config())
        agents['landing'] = LandingPageBuilder(self._get_book_config())
        
        return agents
        
    def _get_book_config(self) -> Any:
        """Convert project to BookConfig for existing agents"""
        from ebook_pipeline.agents.omnicreator import BookConfig
        return BookConfig(
            book_title=self.project.title,
            book_slug=self.project.title.lower().replace(' ', '-'),
            author_name=self.project.author
        )
        
    def _load_state(self) -> Dict[str, Any]:
        """Load orchestrator state from file"""
        if self.state_file.exists():
            with open(self.state_file, 'r') as f:
                return json.load(f)
        return {
            'status': 'new',
            'current_chapter': 0,
            'chapters_written': [],
            'outline': None,
            'started_at': datetime.now().isoformat()
        }
        
    def _save_state(self):
        """Save orchestrator state to file"""
        with open(self.state_file, 'w') as f:
            json.dump(self.state, f, indent=2)
            
    def plan_book(self) -> Dict[str, Any]:
        """Generate complete book outline using AI"""
        logger.info(f"📚 Planning book: {self.project.title}")
        
        if 'planner' not in self.agents:
            # Fallback: Generate outline manually
            outline = self._generate_manual_outline()
        else:
            outline = self.agents['planner'].generate_outline()
            
        self.state['outline'] = outline
        self.state['status'] = 'planned'
        self._save_state()
        
        logger.info(f"✅ Book outline generated with {len(outline['chapters'])} chapters")
        return outline
        
    def _generate_manual_outline(self) -> Dict[str, Any]:
        """Generate a basic outline when planner is not available"""
        num_chapters = self.project.book_specs.get('chapters', 10)
        words_per_chapter = self.project.book_specs.get('words_per_chapter', 3000)
        
        chapters = []
        for i in range(1, num_chapters + 1):
            chapters.append({
                'number': i,
                'title': f'Chapter {i}',
                'description': f'Content for chapter {i}',
                'key_points': ['Point 1', 'Point 2', 'Point 3'],
                'word_target': words_per_chapter
            })
            
        return {
            'title': self.project.title,
            'subtitle': self.project.subtitle,
            'chapters': chapters,
            'total_words': num_chapters * words_per_chapter
        }
        
    def write_chapter(self, chapter_num: int) -> str:
        """Write a specific chapter using AI"""
        if not self.state.get('outline'):
            raise ValueError("No outline found. Run 'make ai-plan' first.")
            
        outline = self.state['outline']
        if chapter_num < 1 or chapter_num > len(outline['chapters']):
            raise ValueError(f"Invalid chapter number: {chapter_num}")
            
        chapter_info = outline['chapters'][chapter_num - 1]
        logger.info(f"✍️  Writing Chapter {chapter_num}: {chapter_info['title']}")
        
        # Get previous chapters for context
        previous_chapters = self._get_previous_chapters(chapter_num)
        
        if 'writer' not in self.agents:
            # Fallback: Create basic chapter
            content = self._create_basic_chapter(chapter_info)
        else:
            content = self.agents['writer'].write_chapter(
                chapter_info, 
                previous_chapters
            )
            
        # Save chapter
        chapter_file = Path(f"chapters/chapter-{chapter_num:02d}-{self._slugify(chapter_info['title'])}.md")
        self._save_chapter(chapter_file, content, chapter_info)
        
        # Update state
        self.state['chapters_written'].append(chapter_num)
        self.state['current_chapter'] = chapter_num
        self._save_state()
        
        logger.info(f"✅ Chapter {chapter_num} written: {chapter_file}")
        return str(chapter_file)
        
    def write_next_chapter(self) -> Optional[str]:
        """Write the next pending chapter"""
        if not self.state.get('outline'):
            raise ValueError("No outline found. Run 'make ai-plan' first.")
            
        total_chapters = len(self.state['outline']['chapters'])
        written = set(self.state.get('chapters_written', []))
        
        # Find next unwritten chapter
        for i in range(1, total_chapters + 1):
            if i not in written:
                return self.write_chapter(i)
                
        logger.info("✅ All chapters have been written!")
        return None
        
    def complete_book(self):
        """Run complete pipeline: plan, write all, build, deploy"""
        logger.info("🚀 Starting complete book automation pipeline")
        
        # 1. Plan if needed
        if not self.state.get('outline'):
            self.plan_book()
            
        # 2. Write all chapters
        while self.write_next_chapter():
            pass
            
        # 3. Generate all images
        logger.info("🎨 Generating AI images...")
        os.system("make generate-images")
        
        # 4. Build book formats
        logger.info("📖 Building book formats...")
        os.system("make all")
        
        # 5. Create landing page if configured
        if self.project.monetization:
            logger.info("🌐 Creating landing page...")
            # Landing page generation would go here
            
        logger.info("🎉 Book automation complete!")
        
    def _get_previous_chapters(self, up_to: int) -> List[Dict[str, str]]:
        """Get content of previous chapters for context"""
        chapters = []
        chapter_files = sorted(Path("chapters").glob("chapter-*.md"))
        
        for cf in chapter_files[:up_to-1]:
            with open(cf, 'r', encoding='utf-8') as f:
                content = f.read()
            chapters.append({
                'file': cf.name,
                'content': content
            })
            
        return chapters
        
    def _create_basic_chapter(self, chapter_info: Dict[str, Any]) -> str:
        """Create a basic chapter template"""
        content = f"""# {chapter_info['title']}

{chapter_info['description']}

## Introduction

[Chapter introduction goes here...]

## Main Content

"""
        for i, point in enumerate(chapter_info['key_points'], 1):
            content += f"\n### {point}\n\n[Content for {point}...]\n"
            
        content += "\n## Summary\n\n[Chapter summary goes here...]\n"
        
        return content
        
    def _save_chapter(self, path: Path, content: str, info: Dict[str, Any]):
        """Save chapter with proper frontmatter"""
        frontmatter = {
            'chap': info['number'],
            'title': info['title'],
            'words_target': info.get('word_target', 3000),
            'words': len(content.split()),
            'status': 'draft'
        }
        
        yaml_front = yaml.dump(frontmatter, default_flow_style=False)
        
        full_content = f"---\n{yaml_front}---\n\n{content}"
        
        with open(path, 'w', encoding='utf-8') as f:
            f.write(full_content)
            
    def _slugify(self, text: str) -> str:
        """Convert text to URL-safe slug"""
        import re
        text = text.lower()
        text = re.sub(r'[^\w\s-]', '', text)
        text = re.sub(r'[-\s]+', '-', text)
        return text.strip('-')


def main():
    """CLI entry point"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Master AI Orchestrator for Book Writing')
    parser.add_argument('command', choices=['plan', 'write', 'write-next', 'complete'],
                       help='Command to execute')
    parser.add_argument('--chapter', type=int, help='Chapter number to write')
    parser.add_argument('--project', default='book-project.yaml', help='Project configuration file')
    
    args = parser.parse_args()
    
    try:
        orchestrator = MasterOrchestrator(args.project)
        
        if args.command == 'plan':
            outline = orchestrator.plan_book()
            print(f"\n📚 Book Outline Generated:")
            print(f"Title: {outline['title']}")
            print(f"Chapters: {len(outline['chapters'])}")
            for ch in outline['chapters']:
                print(f"  {ch['number']}. {ch['title']}")
                
        elif args.command == 'write':
            if not args.chapter:
                print("Error: --chapter N required for write command")
                sys.exit(1)
            path = orchestrator.write_chapter(args.chapter)
            print(f"\n✅ Chapter written: {path}")
            
        elif args.command == 'write-next':
            path = orchestrator.write_next_chapter()
            if path:
                print(f"\n✅ Chapter written: {path}")
            else:
                print("\n✅ All chapters completed!")
                
        elif args.command == 'complete':
            orchestrator.complete_book()
            
    except Exception as e:
        logger.error(f"Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()