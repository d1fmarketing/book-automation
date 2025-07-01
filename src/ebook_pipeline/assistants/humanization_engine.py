#!/usr/bin/env python3
"""
HumanizationEngine: Makes AI writing indistinguishable from human writing
"""
import random
import re
import yaml
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple
import logging
from collections import Counter
import statistics

logger = logging.getLogger(__name__)


class HumanizationEngine:
    """Engine for humanizing AI-generated text using configured templates"""
    
    def __init__(self):
        self.config_dir = Path("context/humanization")
        self.config = self._load_config("humanization-config.yaml")
        self.voice_templates = self._load_config("voice-templates.yaml")
        self.stories = self._load_config("personal-stories.yaml")
        self.imperfections = self._load_config("imperfections.yaml")
        self.anti_patterns = self._load_config("anti-patterns.yaml")
        
        # Track usage to ensure variety
        self.used_stories = []
        self.last_voice = None
        self.sentence_count = 0
        self.paragraph_count = 0
        
    def _load_config(self, filename: str) -> Dict[str, Any]:
        """Load YAML configuration file"""
        config_path = self.config_dir / filename
        if config_path.exists():
            with open(config_path, 'r', encoding='utf-8') as f:
                return yaml.safe_load(f)
        logger.warning(f"Config file not found: {config_path}")
        return {}
    
    def humanize_text(self, text: str, content_type: str = "general", 
                     chapter_num: int = 1) -> str:
        """Main method to humanize text"""
        logger.info(f"Humanizing text (type: {content_type}, chapter: {chapter_num})")
        
        # First, detect and remove AI patterns
        text = self._remove_ai_patterns(text)
        
        # Apply voice template
        text = self._apply_voice_template(text, content_type)
        
        # Add natural imperfections
        text = self._add_imperfections(text)
        
        # Inject personal stories if appropriate
        text = self._inject_stories(text, content_type)
        
        # Vary sentence and paragraph structure
        text = self._vary_structure(text)
        
        # Add humanization markers
        text = self._add_human_touches(text)
        
        # Final authenticity check
        metrics = self._calculate_authenticity_metrics(text)
        logger.info(f"Authenticity metrics: {metrics}")
        
        return text
    
    def _remove_ai_patterns(self, text: str) -> str:
        """Remove common AI writing patterns"""
        forbidden = self.anti_patterns.get('forbidden_phrases', {})
        
        # Remove academic markers
        for phrase in forbidden.get('academic_markers', []):
            text = re.sub(rf'\b{re.escape(phrase)}\b', 
                         self._get_human_alternative(phrase), 
                         text, flags=re.IGNORECASE)
        
        # Remove Portuguese formal phrases
        for phrase in forbidden.get('portuguese_formal', []):
            text = re.sub(rf'\b{re.escape(phrase)}\b',
                         self._get_casual_alternative(phrase),
                         text, flags=re.IGNORECASE)
        
        # Fix mechanical patterns
        text = self._fix_mechanical_patterns(text)
        
        return text
    
    def _get_human_alternative(self, phrase: str) -> str:
        """Get human alternative for formal phrase"""
        alternatives = {
            "Furthermore": random.choice(["E mais", "Além disso", "Ah, e tem mais"]),
            "Moreover": random.choice(["E também", "Sem falar que", "E olha"]),
            "Nevertheless": random.choice(["Mesmo assim", "Mas ainda assim", "Só que"]),
            "In conclusion": random.choice(["Resumindo", "No final", "É isso"]),
            "Hence": random.choice(["Por isso", "Então", "Daí"]),
            "Thus": random.choice(["Assim", "Então", "Logo"]),
        }
        return alternatives.get(phrase, phrase)
    
    def _get_casual_alternative(self, phrase: str) -> str:
        """Get casual alternative for Portuguese formal phrase"""
        alternatives = {
            "Em suma": random.choice(["Resumindo", "No fim das contas", "Basicamente"]),
            "Ademais": random.choice(["E mais", "Além disso", "Fora isso"]),
            "Não obstante": random.choice(["Mesmo assim", "Ainda assim", "Mas"]),
            "Destarte": random.choice(["Assim", "Desse jeito", "Então"]),
        }
        return alternatives.get(phrase, phrase)
    
    def _apply_voice_template(self, text: str, content_type: str) -> str:
        """Apply appropriate voice template based on content type"""
        voice_map = {
            "introduction": "introduction",
            "technical": "technical_explanation",
            "motivation": "motivation",
            "story": "storytelling",
            "practical": "problem_solving",
            "reflection": "reflection"
        }
        
        voice_type = voice_map.get(content_type, "introduction")
        voice = self.voice_templates.get('voice_variations', {}).get(voice_type, {})
        
        if not voice:
            return text
        
        # Inject voice-specific phrases
        phrases = voice.get('phrases', [])
        if phrases and random.random() < 0.3:  # 30% chance
            # Add phrase at beginning of random paragraph
            paragraphs = text.split('\n\n')
            if len(paragraphs) > 1:
                idx = random.randint(1, len(paragraphs) - 1)
                paragraphs[idx] = f"{random.choice(phrases)} {paragraphs[idx]}"
                text = '\n\n'.join(paragraphs)
        
        return text
    
    def _add_imperfections(self, text: str) -> str:
        """Add natural imperfections to text"""
        if random.random() > self.config.get('humanization', {}).get('imperfection_rate', 0.15):
            return text
        
        imperfection_type = random.choice([
            'grammar_flexibilities',
            'conversational_markers', 
            'typing_patterns'
        ])
        
        if imperfection_type == 'grammar_flexibilities':
            text = self._add_grammar_flexibility(text)
        elif imperfection_type == 'conversational_markers':
            text = self._add_conversational_markers(text)
        else:
            text = self._add_typing_patterns(text)
        
        return text
    
    def _add_grammar_flexibility(self, text: str) -> str:
        """Add informal grammar usage"""
        sentences = re.split(r'(?<=[.!?])\s+', text)
        
        # Start sentence with E/Mas (15% chance)
        if sentences and random.random() < 0.15:
            idx = random.randint(1, min(3, len(sentences) - 1))
            if idx < len(sentences):
                starters = ["E ", "Mas ", "Só que ", "Aí "]
                sentences[idx] = random.choice(starters) + sentences[idx]
        
        # Add fragment (10% chance)
        if random.random() < 0.10:
            fragments = [
                "O problema? {topic}.",
                "A solução? Mais simples do que parece.",
                "Resultado? Sucesso total.",
                "Próximo passo? Vamos ver."
            ]
            text += f"\n\n{random.choice(fragments)}"
        
        return ' '.join(sentences)
    
    def _add_conversational_markers(self, text: str) -> str:
        """Add conversational elements"""
        markers = self.imperfections.get('natural_imperfections', {}).get('conversational_markers', [])
        
        if not markers:
            return text
        
        marker = random.choice(markers)
        examples = marker.get('examples', [])
        
        if examples and random.random() < marker.get('frequency', 0.05):
            # Insert marker in middle of text
            sentences = text.split('. ')
            if len(sentences) > 2:
                idx = random.randint(1, len(sentences) - 2)
                sentences[idx] += f". {random.choice(examples)}"
                text = '. '.join(sentences)
        
        return text
    
    def _add_typing_patterns(self, text: str) -> str:
        """Add natural typing variations"""
        patterns = self.imperfections.get('typing_patterns', {}).get('intentional_variations', [])
        
        for pattern in patterns:
            if pattern['type'] == 'Emphasis variations' and random.random() < 0.1:
                # Add emphasis
                words = text.split()
                if len(words) > 10:
                    idx = random.randint(5, len(words) - 5)
                    emphasis = random.choice([
                        lambda w: w.upper(),
                        lambda w: f"**{w}**",
                        lambda w: f"*{w}*",
                        lambda w: w + "!"
                    ])
                    if words[idx].isalpha():
                        words[idx] = emphasis(words[idx])
                        text = ' '.join(words)
        
        return text
    
    def _inject_stories(self, text: str, content_type: str) -> str:
        """Inject personal stories based on context"""
        if random.random() > self.config.get('humanization', {}).get('story_injection_rate', 0.25):
            return text
        
        story_categories = self.stories.get('story_categories', {})
        
        # Select appropriate story category
        if 'technical' in content_type:
            category = 'failures'
            subcategory = 'learning_moments'
        elif 'motivation' in content_type:
            category = 'successes'
            subcategory = 'breakthrough_moments'
        else:
            category = 'daily_life'
            subcategory = 'relatable_moments'
        
        stories = story_categories.get(category, {}).get(subcategory, [])
        
        if stories:
            story = random.choice(stories)
            story_text = story.get('story', '')
            lesson = story.get('lesson', '')
            
            # Format story with placeholders
            story_text = self._fill_story_placeholders(story_text)
            
            # Insert story at appropriate point
            paragraphs = text.split('\n\n')
            if len(paragraphs) > 2:
                idx = random.randint(1, len(paragraphs) - 1)
                story_paragraph = f"\n\n{story_text}"
                if lesson:
                    story_paragraph += f" {lesson}"
                paragraphs.insert(idx, story_paragraph)
                text = '\n\n'.join(paragraphs)
        
        return text
    
    def _fill_story_placeholders(self, story: str) -> str:
        """Fill story placeholders with contextual content"""
        placeholders = {
            '{topic}': random.choice(['isso', 'essa técnica', 'esse conceito']),
            '{common_misconception}': 'copiar e colar código',
            '{correct_approach}': 'entender o que está fazendo',
            '{situation}': 'projeto',
            '{embarrassing_mistake}': 'deletei a branch errada',
            '{wisdom_gained}': 'sempre fazer backup',
            '{wrong_approach}': 'tudo manualmente',
            '{right_tool}': 'um script de automação',
            '{request}': 'para fazer em 1 dia',
            '{advice}': 'Sempre documente seu código',
            '{obvious_solution}': 'tentar desligar e ligar?',
            '{mistake}': 'não testei direito',
            '{realization_moment}': 'vi o padrão se repetindo',
            '{many_approaches}': 'mil',
            '{simple_solution}': 'uma linha de código',
            '{unconventional_approach}': 'fazer ao contrário',
            '{achievement}': 'automatizei todo o processo',
            '{milestone}': 'pull request aceito',
            '{tedious_task}': 'deploy manual'
        }
        
        for placeholder, value in placeholders.items():
            story = story.replace(placeholder, value)
        
        return story
    
    def _vary_structure(self, text: str) -> str:
        """Vary sentence and paragraph structure"""
        # Split into sentences
        sentences = re.split(r'(?<=[.!?])\s+', text)
        
        # Vary sentence length
        new_sentences = []
        for i, sentence in enumerate(sentences):
            if random.random() < 0.1:  # 10% ultra-short
                if len(sentence.split()) > 5:
                    # Make it short
                    short_versions = ["É isso.", "Simples assim.", "Próximo.", "Sacou?"]
                    new_sentences.append(random.choice(short_versions))
                else:
                    new_sentences.append(sentence)
            else:
                new_sentences.append(sentence)
        
        # Vary paragraph structure
        text = ' '.join(new_sentences)
        paragraphs = text.split('\n\n')
        
        # Add single-sentence paragraphs
        if len(paragraphs) > 3 and random.random() < 0.2:
            idx = random.randint(1, len(paragraphs) - 1)
            # Split a paragraph
            sentences = re.split(r'(?<=[.!?])\s+', paragraphs[idx])
            if len(sentences) > 2:
                # Make last sentence its own paragraph
                paragraphs[idx] = ' '.join(sentences[:-1])
                paragraphs.insert(idx + 1, sentences[-1])
        
        return '\n\n'.join(paragraphs)
    
    def _add_human_touches(self, text: str) -> str:
        """Add final human touches"""
        touches = self.imperfections.get('human_touches', {})
        
        # Add aside comments (5% chance)
        if random.random() < 0.05:
            asides = touches.get('aside_comments', [])
            if asides:
                aside = random.choice(asides)
                # Insert aside in middle of text
                sentences = text.split('. ')
                if len(sentences) > 3:
                    idx = random.randint(2, len(sentences) - 2)
                    sentences[idx] += f" {aside}"
                    text = '. '.join(sentences)
        
        # Add meta comments (3% chance)
        if random.random() < 0.03:
            meta_comments = touches.get('meta_comments', [])
            if meta_comments:
                comment = random.choice(meta_comments)
                text += f"\n\n{comment}"
        
        # Add flow breakers
        flow_breakers = self.config.get('flow_breakers', {}).get('phrases', [])
        if flow_breakers and random.random() < 0.15:
            breaker = random.choice(flow_breakers)
            paragraphs = text.split('\n\n')
            if len(paragraphs) > 2:
                idx = random.randint(1, len(paragraphs) - 1)
                paragraphs[idx] = f"{breaker} {paragraphs[idx]}"
                text = '\n\n'.join(paragraphs)
        
        return text
    
    def _fix_mechanical_patterns(self, text: str) -> str:
        """Fix mechanical writing patterns"""
        # Fix robotic introductions
        robotic_intros = [
            r"In this section, we will\s+",
            r"This chapter covers\s+",
            r"We will explore\s+",
            r"Let's dive into\s+"
        ]
        
        for pattern in robotic_intros:
            text = re.sub(pattern, "", text, flags=re.IGNORECASE)
        
        # Fix mechanical conclusions
        mechanical_endings = [
            r"In summary,\s*",
            r"To recap what we learned\s*",
            r"This demonstrates that\s*"
        ]
        
        for pattern in mechanical_endings:
            text = re.sub(pattern, random.choice(["", "Então, ", "É isso: "]), 
                         text, flags=re.IGNORECASE)
        
        return text
    
    def _calculate_authenticity_metrics(self, text: str) -> Dict[str, float]:
        """Calculate metrics to measure human-like qualities"""
        sentences = re.split(r'(?<=[.!?])\s+', text)
        paragraphs = text.split('\n\n')
        words = text.split()
        
        # Sentence length variation
        if sentences:
            sentence_lengths = [len(s.split()) for s in sentences]
            sentence_stddev = statistics.stdev(sentence_lengths) if len(sentence_lengths) > 1 else 0
        else:
            sentence_stddev = 0
        
        # Paragraph length variation  
        if paragraphs:
            para_lengths = [len(p.split('.')) for p in paragraphs]
            para_stddev = statistics.stdev(para_lengths) if len(para_lengths) > 1 else 0
        else:
            para_stddev = 0
        
        # Personal pronoun usage
        personal_pronouns = ['eu', 'você', 'nós', 'a gente', 'meu', 'seu', 'nosso']
        pronoun_count = sum(1 for word in words if word.lower() in personal_pronouns)
        
        # Question count
        question_count = text.count('?')
        
        # Contraction usage (approximation)
        contractions = ['pra', 'pro', 'tá', 'né', 'tô']
        contraction_count = sum(1 for word in words if word.lower() in contractions)
        
        return {
            'sentence_length_stddev': sentence_stddev,
            'paragraph_length_stddev': para_stddev,
            'personal_pronouns_per_1000_words': (pronoun_count / len(words)) * 1000 if words else 0,
            'questions_per_1000_words': (question_count / len(words)) * 1000 if words else 0,
            'contraction_rate': (contraction_count / len(words)) * 100 if words else 0,
            'avg_sentence_length': sum(sentence_lengths) / len(sentence_lengths) if sentences else 0
        }
    
    def analyze_text_humanity(self, text: str) -> Dict[str, Any]:
        """Analyze how human-like a text is"""
        metrics = self._calculate_authenticity_metrics(text)
        
        # Detect AI patterns
        ai_patterns_found = []
        forbidden = self.anti_patterns.get('forbidden_phrases', {})
        
        for category, phrases in forbidden.items():
            for phrase in phrases:
                if re.search(rf'\b{re.escape(phrase)}\b', text, re.IGNORECASE):
                    ai_patterns_found.append(phrase)
        
        # Calculate humanity score (0-100)
        score = 100
        
        # Deduct points for AI patterns
        score -= len(ai_patterns_found) * 5
        
        # Deduct for low variation
        if metrics['sentence_length_stddev'] < 3:
            score -= 10
        if metrics['paragraph_length_stddev'] < 1:
            score -= 10
            
        # Deduct for low personal pronoun usage
        if metrics['personal_pronouns_per_1000_words'] < 5:
            score -= 10
            
        # Deduct for no questions
        if metrics['questions_per_1000_words'] < 1:
            score -= 5
        
        return {
            'humanity_score': max(0, score),
            'metrics': metrics,
            'ai_patterns_found': ai_patterns_found,
            'recommendations': self._get_improvement_recommendations(metrics, ai_patterns_found)
        }
    
    def _get_improvement_recommendations(self, metrics: Dict[str, float], 
                                       ai_patterns: List[str]) -> List[str]:
        """Get recommendations to improve humanity score"""
        recommendations = []
        
        if ai_patterns:
            recommendations.append(f"Remove AI patterns: {', '.join(ai_patterns[:3])}")
        
        if metrics['sentence_length_stddev'] < 3:
            recommendations.append("Vary sentence lengths more (mix short and long)")
        
        if metrics['personal_pronouns_per_1000_words'] < 5:
            recommendations.append("Use more personal pronouns (eu, você, nós)")
        
        if metrics['questions_per_1000_words'] < 1:
            recommendations.append("Add questions to engage the reader")
        
        if metrics['contraction_rate'] < 5:
            recommendations.append("Use more contractions (pra, tá, né)")
        
        return recommendations