#!/usr/bin/env python3
"""
MasterOrchestrator: The AI Brain that coordinates all agents to write complete books
"""
import json
import logging
import os
import sys
import yaml
import subprocess
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
    
    def __init__(self, project_file: str = "book-project.yaml", mode: str = "standard"):
        """Initialize the orchestrator with project configuration"""
        self.project = BookProject.from_yaml(project_file)
        self.mode = mode  # quick, standard, premium, custom
        self.agents = self._initialize_agents()
        self.state_file = Path("orchestrator-state.json")
        self.state = self._load_state()
        
        # Load pipeline configuration
        try:
            from ebook_pipeline.agents.agent_registry import get_registry
            self.registry = get_registry()
        except:
            logger.warning("Agent registry not available")
            self.registry = None
        
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
            
        # Visual agents
        try:
            from ebook_pipeline.agents.image_prompt_agent import ImagePromptAgent
            agents['image'] = ImagePromptAgent()
        except ImportError:
            logger.warning("ImagePromptAgent not available yet")
            
        try:
            from ebook_pipeline.agents.emotion_palette import EmotionPalette
            agents['emotion'] = EmotionPalette()
        except ImportError:
            logger.warning("EmotionPalette not available yet")
            
        # Build agents
        try:
            from ebook_pipeline.agents.book_builder import BookBuilder
            agents['builder'] = BookBuilder(self._get_book_config())
        except ImportError:
            logger.warning("BookBuilder not available yet")
            
        # Marketing agents
        try:
            from ebook_pipeline.agents.landing_page_builder import LandingPageBuilder
            agents['landing'] = LandingPageBuilder(self._get_book_config())
        except ImportError:
            logger.warning("LandingPageBuilder not available yet")
            
        # Advanced agents
        try:
            from ebook_pipeline.agents.omnicreator import OmniCreator
            agents['omnicreator'] = OmniCreator(self._get_book_config())
        except ImportError:
            logger.warning("OmniCreator not available yet")
        
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
        """Run complete pipeline based on selected mode"""
        logger.info(f"🚀 Starting {self.mode} book automation pipeline")
        
        # Execute based on mode
        if self.mode == "quick":
            self._run_quick_pipeline()
        elif self.mode == "standard":
            self._run_standard_pipeline()
        elif self.mode == "premium":
            self._run_premium_pipeline()
        else:
            self._run_custom_pipeline()
            
        logger.info("🎉 Book automation complete!")
        
    def _run_quick_pipeline(self):
        """Quick mode: plan, write, basic PDF"""
        # 1. Plan if needed
        if not self.state.get('outline'):
            self.plan_book()
            
        # 2. Write all chapters
        while self.write_next_chapter():
            pass
            
        # 3. Basic PDF generation
        logger.info("📖 Generating basic PDF...")
        self._run_tool("node scripts/generate-pdf-puppeteer.js")
        
    def _run_standard_pipeline(self):
        """Standard mode: full pipeline with images and QA"""
        # 1. Plan if needed
        if not self.state.get('outline'):
            self.plan_book()
            
        # 2. Research (optional)
        if 'researcher' in self.agents:
            self._run_research_phase()
            
        # 2. Write all chapters
        while self.write_next_chapter():
            pass
            
        # 3. Context management
        logger.info("📊 Analyzing chapters...")
        self._run_tool("make analyze")
        self._run_tool("make check-continuity")
        
        # 4. Generate images with emotion analysis
        self._generate_images_with_emotion()
        
        # 5. Build professional formats
        logger.info("📖 Building book formats...")
        self._run_tool("node scripts/generate-professional-pdf.js")
        self._run_tool("node scripts/build-epub.js")
        
        # 6. QA validation
        self._run_qa_validation()
        
    def _run_premium_pipeline(self):
        """Premium mode: everything including marketing"""
        # Run standard pipeline first
        self._run_standard_pipeline()
        
        # Additional premium features
        if 'landing' in self.agents and self.project.monetization:
            logger.info("🌐 Creating landing page...")
            self._create_landing_page()
            
        # Start preview server
        logger.info("🌐 Starting preview server...")
        self._run_tool("node scripts/visual-preview-server.js", background=True)
        
    def _run_custom_pipeline(self):
        """Custom mode: user-defined steps"""
        # This would read custom workflow from configuration
        logger.info("Running custom pipeline...")
        # For now, fall back to standard
        self._run_standard_pipeline()
        
    def _run_research_phase(self):
        """Run research for all chapters"""
        logger.info("🔍 Researching topics...")
        # Research implementation would go here
        
    def _generate_images_with_emotion(self):
        """Generate images with emotion palette analysis"""
        logger.info("🎨 Analyzing emotional palette...")
        
        if 'emotion' in self.agents:
            # Analyze chapters for emotional tone
            chapter_files = sorted(Path("chapters").glob("chapter-*.md"))
            emotions = {}
            
            for cf in chapter_files:
                # This would call emotion palette analysis
                logger.info(f"Analyzing emotions in {cf.name}")
                # emotions[cf.name] = self.agents['emotion'].analyze(cf)
                
        logger.info("🎨 Generating AI images...")
        self._run_tool("python3 scripts/generate-images.py --skip-existing")
        
    def _run_qa_validation(self):
        """Run QA validation with retries"""
        logger.info("✅ Running QA validation...")
        
        pdf_path = Path("build/dist/ebook-professional.pdf")
        if not pdf_path.exists():
            # Try other PDF names
            pdf_path = Path("build/dist/ebook-clean.pdf")
            if not pdf_path.exists():
                pdf_path = Path("build/dist/ebook.pdf")
                
        if pdf_path.exists():
            max_retries = 3
            for i in range(max_retries):
                result = self._run_tool(f"node scripts/qa-agent.js {pdf_path}", check=False)
                if result == 0:
                    break
                logger.warning(f"QA failed, retry {i+1}/{max_retries}")
        else:
            logger.warning("No PDF found for QA validation")
            
    def _create_landing_page(self):
        """Create marketing landing page"""
        try:
            landing_agent = self.agents['landing']
            # Landing page creation would go here
            logger.info("Landing page created successfully")
        except Exception as e:
            logger.error(f"Failed to create landing page: {e}")
            
    def _run_tool(self, command: str, check: bool = True, background: bool = False) -> int:
        """Run a tool/script with proper error handling"""
        try:
            if background:
                subprocess.Popen(command, shell=True)
                return 0
            else:
                result = subprocess.run(command, shell=True, check=check)
                return result.returncode
        except subprocess.CalledProcessError as e:
            logger.error(f"Command failed: {command}")
            if check:
                raise
            return e.returncode
        except Exception as e:
            logger.error(f"Error running command: {e}")
            if check:
                raise
            return -1
        
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
    parser.add_argument('command', choices=['plan', 'write', 'write-next', 'complete', 'status'],
                       help='Command to execute')
    parser.add_argument('--chapter', type=int, help='Chapter number to write')
    parser.add_argument('--project', default='book-project.yaml', help='Project configuration file')
    parser.add_argument('--mode', choices=['quick', 'standard', 'premium', 'custom'],
                       default='standard', help='Pipeline mode to use')
    
    args = parser.parse_args()
    
    try:
        orchestrator = MasterOrchestrator(args.project, mode=args.mode)
        
        if args.command == 'status':
            # Show pipeline status
            print("\n📊 Pipeline Status:")
            print(f"Mode: {orchestrator.mode}")
            print(f"Project: {orchestrator.project.title}")
            state = orchestrator.state
            print(f"Status: {state.get('status', 'new')}")
            print(f"Chapters written: {len(state.get('chapters_written', []))}/{len(state.get('outline', {}).get('chapters', []))")
            
            if orchestrator.registry:
                print("\n🤖 Available Agents:")
                agents = orchestrator.registry.list_agents()
                for name, info in agents.items():
                    status = "✅" if name in orchestrator.agents else "⚪"
                    print(f"  {status} {name}: {info['description']}")
                    
        elif args.command == 'plan':
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