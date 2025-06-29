#!/usr/bin/env python3
"""
BookPlannerAgent: AI agent that creates comprehensive book outlines
"""
import json
import logging
from typing import Dict, List, Any
from pathlib import Path

logger = logging.getLogger('BookPlannerAgent')


class BookPlannerAgent:
    """Agent responsible for planning book structure and outline"""
    
    def __init__(self, project: Any):
        """Initialize with project configuration"""
        self.project = project
        self.outline_file = Path("book-outline.json")
        
    def generate_outline(self) -> Dict[str, Any]:
        """Generate comprehensive book outline based on project specs"""
        logger.info(f"🎯 Generating outline for: {self.project.title}")
        
        # Analyze target audience
        audience = self._analyze_audience()
        
        # Create chapter structure
        chapters = self._create_chapter_structure()
        
        # Add marketing hooks
        hooks = self._generate_marketing_hooks()
        
        outline = {
            'title': self.project.title,
            'subtitle': self.project.subtitle,
            'author': self.project.author,
            'audience_profile': audience,
            'marketing_hooks': hooks,
            'chapters': chapters,
            'total_words': sum(ch['word_target'] for ch in chapters),
            'estimated_pages': sum(ch['word_target'] for ch in chapters) // 250
        }
        
        # Save outline
        self._save_outline(outline)
        
        return outline
        
    def _analyze_audience(self) -> Dict[str, Any]:
        """Analyze target audience for better content targeting"""
        audience = self.project.target_audience
        
        return {
            'age_range': audience.get('age_range', [25, 55]),
            'knowledge_level': audience.get('knowledge_level', 'beginner'),
            'interests': audience.get('interests', []),
            'pain_points': audience.get('pain_points', []),
            'reading_style': self._determine_reading_style(audience),
            'content_preferences': self._determine_content_preferences(audience)
        }
        
    def _determine_reading_style(self, audience: Dict) -> str:
        """Determine preferred reading style based on audience"""
        knowledge = audience.get('knowledge_level', 'beginner')
        
        if knowledge == 'beginner':
            return 'simple, clear explanations with many examples'
        elif knowledge == 'intermediate':
            return 'balanced theory and practice with case studies'
        else:
            return 'advanced concepts with technical depth'
            
    def _determine_content_preferences(self, audience: Dict) -> List[str]:
        """Determine content preferences"""
        prefs = []
        
        if 'beginner' in str(audience.get('knowledge_level', '')):
            prefs.extend(['step-by-step guides', 'visual aids', 'glossary'])
        
        if audience.get('interests'):
            if 'practical' in str(audience['interests']):
                prefs.append('hands-on exercises')
            if 'theory' in str(audience['interests']):
                prefs.append('conceptual frameworks')
                
        return prefs
        
    def _create_chapter_structure(self) -> List[Dict[str, Any]]:
        """Create detailed chapter structure"""
        num_chapters = self.project.book_specs.get('chapters', 10)
        words_per_chapter = self.project.book_specs.get('words_per_chapter', 3000)
        
        # For now, create a template structure
        # In a real implementation, this would use AI to generate
        # topic-specific chapters based on research
        
        chapters = []
        
        # Introduction chapter
        chapters.append({
            'number': 1,
            'title': 'Introduction',
            'description': f'Welcome readers and introduce {self.project.title}',
            'key_points': [
                'Why this book matters',
                'What you will learn',
                'How to use this book'
            ],
            'word_target': words_per_chapter,
            'images_needed': 1
        })
        
        # Main content chapters
        main_chapters = num_chapters - 2  # Minus intro and conclusion
        for i in range(2, main_chapters + 2):
            chapters.append({
                'number': i,
                'title': f'Core Concept {i-1}',
                'description': f'Deep dive into aspect {i-1} of {self.project.title}',
                'key_points': [
                    f'Foundation of concept {i-1}',
                    f'Practical applications',
                    f'Common mistakes to avoid',
                    f'Advanced techniques'
                ],
                'word_target': words_per_chapter,
                'images_needed': 2
            })
            
        # Conclusion chapter
        chapters.append({
            'number': num_chapters,
            'title': 'Conclusion and Next Steps',
            'description': 'Wrap up and provide actionable next steps',
            'key_points': [
                'Key takeaways',
                'Action plan',
                'Additional resources',
                'Final thoughts'
            ],
            'word_target': words_per_chapter,
            'images_needed': 1
        })
        
        return chapters
        
    def _generate_marketing_hooks(self) -> Dict[str, Any]:
        """Generate marketing hooks based on monetization strategy"""
        monetization = self.project.monetization
        
        return {
            'value_proposition': monetization.get('value_propositions', []),
            'price_point': monetization.get('price_point', '$19.99'),
            'unique_selling_points': [
                'Written by advanced AI with latest information',
                'Comprehensive coverage of the topic',
                'Practical, actionable content',
                'Professional formatting and design'
            ],
            'target_keywords': self._extract_keywords(),
            'elevator_pitch': f"The definitive guide to {self.project.title} that transforms beginners into confident practitioners"
        }
        
    def _extract_keywords(self) -> List[str]:
        """Extract SEO keywords from project"""
        keywords = []
        
        # From title
        title_words = self.project.title.lower().split()
        keywords.extend([w for w in title_words if len(w) > 3])
        
        # From target audience interests
        if self.project.target_audience.get('interests'):
            keywords.extend(self.project.target_audience['interests'])
            
        return list(set(keywords))  # Remove duplicates
        
    def _save_outline(self, outline: Dict[str, Any]):
        """Save outline to file"""
        with open(self.outline_file, 'w', encoding='utf-8') as f:
            json.dump(outline, f, indent=2, ensure_ascii=False)
            
        logger.info(f"📝 Outline saved to {self.outline_file}")
        
    def refine_chapter(self, chapter_num: int, feedback: str) -> Dict[str, Any]:
        """Refine a specific chapter based on feedback"""
        # Load current outline
        with open(self.outline_file, 'r') as f:
            outline = json.load(f)
            
        if chapter_num < 1 or chapter_num > len(outline['chapters']):
            raise ValueError(f"Invalid chapter number: {chapter_num}")
            
        # In a real implementation, this would use AI to refine
        # the chapter based on feedback
        logger.info(f"📝 Refining chapter {chapter_num} based on feedback")
        
        # For now, just return the chapter
        return outline['chapters'][chapter_num - 1]