#!/usr/bin/env python3
"""
AIWriterAgent: The agent interface where Claude writes professional book chapters
"""
import json
import logging
from typing import Dict, List, Any, Optional
from pathlib import Path
from datetime import datetime

logger = logging.getLogger('AIWriterAgent')


class AIWriterAgent:
    """Agent that interfaces with Claude to write book chapters"""
    
    def __init__(self, project: Any):
        """Initialize with project configuration"""
        self.project = project
        self.writing_history = Path("writing-history.json")
        self.load_writing_history()
        
    def load_writing_history(self):
        """Load previous writing history for consistency"""
        if self.writing_history.exists():
            with open(self.writing_history, 'r') as f:
                self.history = json.load(f)
        else:
            self.history = {
                'chapters_written': [],
                'style_notes': [],
                'recurring_themes': []
            }
            
    def save_writing_history(self):
        """Save writing history"""
        with open(self.writing_history, 'w') as f:
            json.dump(self.history, f, indent=2)
            
    def write_chapter(self, chapter_info: Dict[str, Any], 
                     previous_chapters: List[Dict[str, str]]) -> str:
        """
        Interface for Claude to write a chapter.
        This method prepares the context and returns the written content.
        """
        logger.info(f"✍️  AI Writer starting chapter {chapter_info['number']}: {chapter_info['title']}")
        
        # Prepare writing context
        context = self._prepare_writing_context(chapter_info, previous_chapters)
        
        # Generate chapter content
        content = self._generate_chapter_content(context)
        
        # Post-process and enhance
        content = self._enhance_chapter(content, chapter_info)
        
        # Update history
        self._update_history(chapter_info, content)
        
        return content
        
    def _prepare_writing_context(self, chapter_info: Dict[str, Any], 
                               previous_chapters: List[Dict[str, str]]) -> Dict[str, Any]:
        """Prepare comprehensive context for writing"""
        
        # Extract key information from previous chapters
        previous_context = self._analyze_previous_chapters(previous_chapters)
        
        # Build writing prompt
        context = {
            'chapter_info': chapter_info,
            'project': {
                'title': self.project.title,
                'subtitle': self.project.subtitle,
                'author': self.project.author,
                'style': self.project.style,
                'audience': self.project.target_audience
            },
            'previous_context': previous_context,
            'writing_guidelines': self._get_writing_guidelines(),
            'chapter_requirements': self._get_chapter_requirements(chapter_info)
        }
        
        return context
        
    def _analyze_previous_chapters(self, previous_chapters: List[Dict[str, str]]) -> Dict[str, Any]:
        """Analyze previous chapters for context"""
        if not previous_chapters:
            return {
                'key_concepts': [],
                'introduced_terms': [],
                'narrative_threads': [],
                'tone_samples': []
            }
            
        # In a real implementation, this would analyze the actual content
        # For now, return a structured summary
        return {
            'key_concepts': ['Previous concepts covered'],
            'introduced_terms': ['Terms already explained'],
            'narrative_threads': ['Ongoing storylines or examples'],
            'tone_samples': ['Examples of writing style'],
            'chapter_summaries': [
                f"Chapter {i+1} summary" for i in range(len(previous_chapters))
            ]
        }
        
    def _get_writing_guidelines(self) -> Dict[str, Any]:
        """Get specific writing guidelines based on project style"""
        style = self.project.style
        
        guidelines = {
            'tone': style.get('tone', 'professional and friendly'),
            'approach': style.get('approach', 'practical with examples'),
            'features': style.get('features', []),
            'formatting': {
                'use_bullet_points': True,
                'include_summaries': True,
                'add_exercises': 'exercises_per_chapter' in style.get('features', []),
                'use_examples': True,
                'include_visuals': True
            },
            'voice': {
                'person': 'second',  # "you" 
                'active_voice': True,
                'conversational': 'friendly' in style.get('tone', '')
            }
        }
        
        return guidelines
        
    def _get_chapter_requirements(self, chapter_info: Dict[str, Any]) -> Dict[str, Any]:
        """Get specific requirements for this chapter"""
        return {
            'word_count': chapter_info.get('word_target', 3000),
            'key_points': chapter_info.get('key_points', []),
            'images_needed': chapter_info.get('images_needed', 2),
            'structure': [
                'Introduction',
                'Main content covering key points',
                'Practical examples',
                'Common pitfalls',
                'Summary',
                'Exercises (if applicable)'
            ]
        }
        
    def _generate_chapter_content(self, context: Dict[str, Any]) -> str:
        """
        This is where Claude actually writes the chapter.
        The context contains all necessary information.
        """
        
        # Create a structured prompt for chapter writing
        chapter_info = context['chapter_info']
        guidelines = context['writing_guidelines']
        requirements = context['chapter_requirements']
        
        # Start with chapter title
        content = f"# Chapter {chapter_info['number']}: {chapter_info['title']}\n\n"
        
        # Add introduction
        content += f"## Introduction\n\n"
        content += f"{chapter_info['description']}\n\n"
        
        # Main content sections
        for i, key_point in enumerate(chapter_info['key_points'], 1):
            content += f"## {key_point}\n\n"
            content += f"[Detailed content about {key_point} goes here...]\n\n"
            
            # Add example
            if guidelines['formatting']['use_examples']:
                content += f"### Example {i}\n\n"
                content += f"[Practical example demonstrating {key_point}...]\n\n"
                
            # Add image placeholder if needed
            if i <= chapter_info.get('images_needed', 0):
                content += f"![AI-IMAGE: Illustration showing {key_point}]()\n\n"
                
        # Add summary
        content += "## Chapter Summary\n\n"
        content += "In this chapter, we covered:\n\n"
        for point in chapter_info['key_points']:
            content += f"- {point}\n"
        content += "\n"
        
        # Add exercises if required
        if guidelines['formatting']['add_exercises']:
            content += "## Exercises\n\n"
            for i, point in enumerate(chapter_info['key_points'], 1):
                content += f"{i}. Practice exercise for {point}\n"
            content += "\n"
            
        # Add transition to next chapter
        content += "## What's Next\n\n"
        content += "[Preview of the next chapter...]\n"
        
        return content
        
    def _enhance_chapter(self, content: str, chapter_info: Dict[str, Any]) -> str:
        """Enhance chapter with additional elements"""
        
        # Add callout boxes for important points
        enhanced = content
        
        # Add info boxes
        if "Important:" in content or "Note:" in content:
            # In real implementation, would format these specially
            pass
            
        # Ensure proper markdown formatting
        enhanced = self._ensure_markdown_quality(enhanced)
        
        return enhanced
        
    def _ensure_markdown_quality(self, content: str) -> str:
        """Ensure markdown is properly formatted"""
        lines = content.split('\n')
        cleaned = []
        
        for line in lines:
            # Ensure headers have blank lines around them
            if line.startswith('#'):
                if cleaned and cleaned[-1].strip():
                    cleaned.append('')
                cleaned.append(line)
                cleaned.append('')
            else:
                cleaned.append(line)
                
        # Remove multiple blank lines
        final = []
        prev_blank = False
        for line in cleaned:
            if not line.strip():
                if not prev_blank:
                    final.append(line)
                prev_blank = True
            else:
                final.append(line)
                prev_blank = False
                
        return '\n'.join(final)
        
    def _update_history(self, chapter_info: Dict[str, Any], content: str):
        """Update writing history for consistency"""
        self.history['chapters_written'].append({
            'number': chapter_info['number'],
            'title': chapter_info['title'],
            'written_at': datetime.now().isoformat(),
            'word_count': len(content.split())
        })
        
        # Extract any recurring themes or terms
        # In real implementation, would analyze content
        
        self.save_writing_history()
        
    def get_writing_stats(self) -> Dict[str, Any]:
        """Get statistics about the writing progress"""
        total_words = sum(
            ch.get('word_count', 0) 
            for ch in self.history['chapters_written']
        )
        
        return {
            'chapters_written': len(self.history['chapters_written']),
            'total_words': total_words,
            'average_words_per_chapter': total_words // max(len(self.history['chapters_written']), 1),
            'writing_history': self.history['chapters_written']
        }