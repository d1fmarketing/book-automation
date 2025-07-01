#!/usr/bin/env python3
"""
SmartAutoComplete: Context-aware auto-completion for writing
"""
import re
import yaml
import json
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple
import logging
from collections import defaultdict, Counter
import random
import nltk

logger = logging.getLogger(__name__)

# Download required NLTK data
try:
    nltk.data.find('tokenizers/punkt')
except LookupError:
    nltk.download('punkt', quiet=True)
try:
    nltk.data.find('taggers/averaged_perceptron_tagger')
except LookupError:
    nltk.download('averaged_perceptron_tagger', quiet=True)


class SmartAutoComplete:
    """Intelligent auto-completion based on context and style"""
    
    def __init__(self):
        self.story_bible = self._load_story_bible()
        self.voice_templates = self._load_voice_templates()
        self.personal_stories = self._load_personal_stories()
        self.chapter_summaries = self._load_chapter_summaries()
        
        # Build completion models
        self.phrase_completions = self._build_phrase_completions()
        self.character_phrases = self._build_character_phrases()
        self.transition_phrases = self._build_transition_phrases()
        
        # Learn from existing chapters
        self.learned_patterns = self._learn_from_chapters()
        
    def _load_story_bible(self) -> Dict[str, Any]:
        """Load story bible"""
        path = Path("context/story-bible.yaml")
        if path.exists():
            with open(path, 'r', encoding='utf-8') as f:
                return yaml.safe_load(f) or {}
        return {}
    
    def _load_voice_templates(self) -> Dict[str, Any]:
        """Load voice templates"""
        path = Path("context/humanization/voice-templates.yaml")
        if path.exists():
            with open(path, 'r', encoding='utf-8') as f:
                return yaml.safe_load(f) or {}
        return {}
    
    def _load_personal_stories(self) -> Dict[str, Any]:
        """Load personal stories bank"""
        path = Path("context/humanization/personal-stories.yaml")
        if path.exists():
            with open(path, 'r', encoding='utf-8') as f:
                return yaml.safe_load(f) or {}
        return {}
    
    def _load_chapter_summaries(self) -> Dict[str, Any]:
        """Load chapter summaries"""
        path = Path("context/chapter-summaries.json")
        if path.exists():
            with open(path, 'r', encoding='utf-8') as f:
                return json.load(f)
        return {}
    
    def _build_phrase_completions(self) -> Dict[str, List[str]]:
        """Build phrase completion patterns"""
        completions = defaultdict(list)
        
        # From voice templates
        voice_variations = self.voice_templates.get('voice_variations', {})
        for voice_type, voice_data in voice_variations.items():
            # Add phrases
            for phrase in voice_data.get('phrases', []):
                words = phrase.split()
                if len(words) > 2:
                    prefix = ' '.join(words[:2])
                    completion = ' '.join(words[2:])
                    completions[prefix.lower()].append(completion)
            
            # Add sentence starters
            for starter in voice_data.get('sentence_starters', []):
                completions['<start>'].append(starter)
            
            # Add transitions
            for transition in voice_data.get('transitions', []):
                completions['<transition>'].append(transition)
        
        # Common patterns
        common_patterns = {
            'por exemplo': [', ', ', como ', ', tipo ', ', assim como '],
            'isso significa': [' que ', ' dizer que ', ' basicamente que '],
            'o problema': [' é que ', ' principal é ', ' aqui é ', ' era que '],
            'a solução': [' é simples: ', ' mais elegante é ', ' que encontrei foi '],
            'vamos': [' começar ', ' ver como ', ' implementar ', ' ao código '],
            'primeiro': [', precisamos ', ', vamos ', ', é importante ', ' passo '],
            'depois': [' disso, ', ' de tudo, ', ', é só ', ' que '],
            'na verdade': [', ', ', o que acontece é que ', ', isso significa que '],
            'ou seja': [', ', ': ', ' - ', ', basicamente '],
            'por isso': [' que ', ', ', ' mesmo que ', ', sempre '],
            'então': [', ', ' vamos ', ' é só ', ' basta '],
            'mas': [' não ', ' também ', ' calma, ', ' espera, '],
            'porque': [' ', ' assim ', ' senão ', ' isso '],
            'quando': [' você ', ' a gente ', ' isso ', ' tudo '],
            'se': [' você ', ' quiser ', ' não ', ' isso '],
            'como': [' fazer ', ' isso ', ' você ', ' se '],
            'para': [' isso ', ' fazer ', ' que ', ' você '],
            'agora': [', ', ' vamos ', ' é ', ' que '],
            'antes': [' de ', ' disso ', ', ', ' que '],
            'durante': [' o ', ' a ', ' esse ', ' todo '],
            'talvez': [' você ', ' seja ', ' não ', ' isso '],
            'provavelmente': [' vai ', ' não ', ' é ', ' você '],
            'certamente': [' ', ' vai ', ' não ', ' é '],
            'obviamente': [', ', ' que ', ' isso ', ' não '],
            'claro': [' que ', ', ', '! ', '. '],
            'sim': [', ', '. ', '! ', ', mas '],
            'não': [', ', '. ', '! ', ' é ', ' sei '],
            'exatamente': ['! ', '. ', ' isso', ' o que '],
            'perfeito': ['! ', '. ', ' para ', ', '],
            'ótimo': ['! ', '. ', ' para ', ', então '],
            'legal': ['! ', ', ', ' né?', ' demais!'],
            'interessante': ['. ', ', ', ' né?', '...'],
            'importante': [': ', ' é ', ' notar ', ' lembrar '],
            'lembre': ['-se ', ' que ', ': ', ' sempre '],
            'note': [' que ', ': ', ' bem ', ' isso '],
            'veja': [' bem', ' só', ' que ', ' como '],
            'olha': [' só', ', ', ' que ', ' isso '],
            'repara': [' que ', ' só ', ' nisso', ' bem '],
            'percebe': ['? ', ' que ', ' como ', ' isso '],
            'entende': ['? ', ' que ', ' como ', ' o que '],
            'sacou': ['? ', ' né?', ' a ideia?', ' o esquema?'],
            'beleza': ['? ', ', ', ' então', ' né?'],
            'tranquilo': ['? ', ', ', ' né?', ' então'],
            'fechou': ['? ', '! ', ' então', ' né?'],
            'bora': [' lá', ' fazer', ' implementar', ' codar'],
            'partiu': [' fazer', ' implementar', ' codar', '!'],
            'mão na': [' massa', ' massa!', ' massa?', ' massa.'],
            'hora de': [' codar', ' implementar', ' fazer', ' testar'],
            'vamos lá': [', ', ' então', ' pessoal', '!'],
        }
        
        for prefix, endings in common_patterns.items():
            completions[prefix].extend(endings)
        
        return dict(completions)
    
    def _build_character_phrases(self) -> Dict[str, List[str]]:
        """Build character-specific phrases"""
        character_phrases = {}
        
        characters = self.story_bible.get('characters', {})
        for char_id, char_data in characters.items():
            name = char_data.get('name', char_id)
            phrases = []
            
            # Build phrases based on personality
            personality = char_data.get('personality', [])
            
            if 'engraçado' in personality or 'humor' in personality:
                phrases.extend([
                    ' brincou',
                    ' riu',
                    ' fez uma piada',
                    ' piscou'
                ])
            
            if 'sério' in personality or 'formal' in personality:
                phrases.extend([
                    ' franziu a testa',
                    ' pensou por um momento',
                    ' respondeu formalmente',
                    ' manteve a compostura'
                ])
            
            if 'nervoso' in personality or 'ansioso' in personality:
                phrases.extend([
                    ' hesitou',
                    ' gaguejou',
                    ' olhou para os lados',
                    ' mexeu as mãos nervosamente'
                ])
            
            character_phrases[name.lower()] = phrases
        
        return character_phrases
    
    def _build_transition_phrases(self) -> Dict[str, List[str]]:
        """Build context-aware transition phrases"""
        transitions = {
            'contrast': [
                'Mas ', 'Porém ', 'No entanto, ', 'Por outro lado, ',
                'Só que ', 'Acontece que ', 'O problema é que '
            ],
            'continuation': [
                'E ', 'Além disso, ', 'Também ', 'E mais: ',
                'Ah, e ', 'Sem falar que ', 'E olha só, '
            ],
            'example': [
                'Por exemplo, ', 'Tipo, ', 'Como ', 'Veja: ',
                'Imagina só: ', 'Pensa comigo: ', 'É como '
            ],
            'conclusion': [
                'Então, ', 'Assim, ', 'Por isso ', 'Logo, ',
                'No final, ', 'Resumindo: ', 'Ou seja, '
            ],
            'time': [
                'Depois, ', 'Em seguida, ', 'Então ', 'Aí ',
                'Nesse momento, ', 'Quando ', 'Enquanto isso, '
            ],
            'emphasis': [
                'Realmente, ', 'De fato, ', 'Com certeza, ', 'Sem dúvida, ',
                'Olha, ', 'Cara, ', 'Sério, '
            ]
        }
        
        return transitions
    
    def _learn_from_chapters(self) -> Dict[str, Any]:
        """Learn patterns from existing chapters"""
        patterns = {
            'common_phrases': Counter(),
            'sentence_starters': Counter(),
            'paragraph_starters': Counter(),
            'common_transitions': Counter()
        }
        
        # Analyze chapter summaries for patterns
        for chapter_id, summary in self.chapter_summaries.items():
            text = summary.get('summary', '')
            
            # Extract sentences
            sentences = nltk.sent_tokenize(text)
            
            for sent in sentences:
                words = sent.split()
                
                # Sentence starters
                if words:
                    starter = words[0]
                    patterns['sentence_starters'][starter] += 1
                
                # Common 2-3 word phrases
                for i in range(len(words) - 2):
                    phrase2 = ' '.join(words[i:i+2])
                    phrase3 = ' '.join(words[i:i+3])
                    patterns['common_phrases'][phrase2] += 1
                    patterns['common_phrases'][phrase3] += 1
        
        return patterns
    
    def get_completions(self, text: str, cursor_position: int, 
                       context: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        """Get auto-completion suggestions"""
        # Get text before cursor
        text_before = text[:cursor_position].strip()
        text_after = text[cursor_position:].strip()
        
        suggestions = []
        
        # Get last few words
        words = text_before.split()
        last_word = words[-1] if words else ""
        last_two = ' '.join(words[-2:]) if len(words) >= 2 else last_word
        last_three = ' '.join(words[-3:]) if len(words) >= 3 else last_two
        
        # 1. Check for exact phrase matches
        if last_three.lower() in self.phrase_completions:
            for completion in self.phrase_completions[last_three.lower()]:
                suggestions.append({
                    'text': completion,
                    'type': 'phrase',
                    'confidence': 0.9
                })
        
        if last_two.lower() in self.phrase_completions:
            for completion in self.phrase_completions[last_two.lower()]:
                suggestions.append({
                    'text': completion,
                    'type': 'phrase',
                    'confidence': 0.8
                })
        
        # 2. Character-specific completions
        for char_name, phrases in self.character_phrases.items():
            if char_name in text_before.lower():
                # Check if we just typed the character name
                if last_word.lower() == char_name or last_two.lower().endswith(char_name):
                    for phrase in phrases[:3]:  # Top 3
                        suggestions.append({
                            'text': phrase,
                            'type': 'character',
                            'confidence': 0.7
                        })
        
        # 3. Context-aware suggestions
        if context:
            suggestions.extend(self._get_contextual_suggestions(
                text_before, text_after, context
            ))
        
        # 4. Transition suggestions
        if text_before.endswith('.') or text_before.endswith('!') or text_before.endswith('?'):
            suggestions.extend(self._get_transition_suggestions(text_before, context))
        
        # 5. Story injection suggestions
        if self._should_inject_story(text_before, context):
            suggestions.extend(self._get_story_suggestions(context))
        
        # 6. Voice-specific suggestions
        suggestions.extend(self._get_voice_suggestions(text_before, context))
        
        # Remove duplicates and sort by confidence
        seen = set()
        unique_suggestions = []
        for sugg in sorted(suggestions, key=lambda x: x['confidence'], reverse=True):
            if sugg['text'] not in seen:
                seen.add(sugg['text'])
                unique_suggestions.append(sugg)
        
        return unique_suggestions[:10]  # Top 10 suggestions
    
    def _get_contextual_suggestions(self, text_before: str, text_after: str,
                                   context: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Get suggestions based on current context"""
        suggestions = []
        
        # Current chapter type
        chapter_type = context.get('chapter_type', 'general')
        
        # Suggest based on chapter type
        if chapter_type == 'introduction' and not text_before:
            suggestions.extend([
                {'text': 'Você já se perguntou ', 'type': 'starter', 'confidence': 0.8},
                {'text': 'Imagine ', 'type': 'starter', 'confidence': 0.8},
                {'text': 'Tudo começou quando ', 'type': 'starter', 'confidence': 0.7}
            ])
        
        # If we're in dialogue
        if '"' in text_before[-50:] or '"' in text_before[-50:]:
            suggestions.extend([
                {'text': '", disse ', 'type': 'dialogue', 'confidence': 0.7},
                {'text': '". ', 'type': 'dialogue', 'confidence': 0.7},
                {'text': '", perguntou ', 'type': 'dialogue', 'confidence': 0.6}
            ])
        
        return suggestions
    
    def _get_transition_suggestions(self, text_before: str, 
                                   context: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        """Get transition phrase suggestions"""
        suggestions = []
        
        # Determine what type of transition might be needed
        last_sentence = text_before.split('.')[-2] if '.' in text_before else text_before
        
        # Simple heuristics for transition type
        if '?' in last_sentence:
            # After a question, likely need an answer or continuation
            transition_type = 'continuation'
        elif any(word in last_sentence.lower() for word in ['mas', 'porém', 'entretanto']):
            # After contrast, likely need resolution
            transition_type = 'conclusion'
        else:
            # Default to variety
            transition_type = random.choice(['continuation', 'example', 'time'])
        
        transitions = self.transition_phrases.get(transition_type, [])
        for trans in transitions[:3]:
            suggestions.append({
                'text': trans,
                'type': 'transition',
                'confidence': 0.6
            })
        
        return suggestions
    
    def _should_inject_story(self, text_before: str, context: Dict[str, Any]) -> bool:
        """Determine if it's a good place to inject a personal story"""
        # Simple heuristics
        word_count = len(text_before.split())
        
        # Every ~400 words
        if word_count > 0 and word_count % 400 < 50:
            # Check if we just finished explaining something technical
            technical_words = ['função', 'código', 'algoritmo', 'sistema', 'método']
            if any(word in text_before[-200:].lower() for word in technical_words):
                return True
        
        return False
    
    def _get_story_suggestions(self, context: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Get personal story suggestions"""
        suggestions = []
        
        story_categories = self.personal_stories.get('story_categories', {})
        
        # Pick appropriate category
        if context.get('mood') == 'technical':
            stories = story_categories.get('failures', {}).get('learning_moments', [])
        else:
            stories = story_categories.get('daily_life', {}).get('relatable_moments', [])
        
        if stories:
            story = random.choice(stories)
            story_text = story.get('story', '')
            
            # Simple placeholder filling
            story_text = story_text.replace('{topic}', 'isso')
            story_text = story_text.replace('{situation}', 'projeto')
            
            suggestions.append({
                'text': f"\n\n{story_text}",
                'type': 'story',
                'confidence': 0.5
            })
        
        return suggestions
    
    def _get_voice_suggestions(self, text_before: str, 
                               context: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Get voice-appropriate suggestions"""
        suggestions = []
        
        voice_type = context.get('voice_type', 'conversational_expert')
        voice_data = self.voice_templates.get('voice_variations', {}).get(voice_type, {})
        
        # If at sentence end, suggest voice-appropriate starter
        if text_before.endswith('.'):
            starters = voice_data.get('sentence_starters', [])
            for starter in starters[:2]:
                suggestions.append({
                    'text': f" {starter}",
                    'type': 'voice',
                    'confidence': 0.5
                })
        
        return suggestions
    
    def learn_from_text(self, text: str, accepted: bool = True):
        """Learn from user's writing patterns"""
        if not accepted:
            return
        
        # Extract patterns
        sentences = nltk.sent_tokenize(text)
        
        for sent in sentences:
            words = sent.split()
            
            # Learn sentence starters
            if words:
                self.learned_patterns['sentence_starters'][words[0]] += 1
            
            # Learn common phrases
            for i in range(len(words) - 2):
                phrase = ' '.join(words[i:i+3])
                self.learned_patterns['common_phrases'][phrase] += 1
    
    def get_inline_suggestion(self, text: str, cursor_position: int) -> Optional[str]:
        """Get single best inline suggestion (ghost text)"""
        completions = self.get_completions(text, cursor_position)
        
        if completions and completions[0]['confidence'] > 0.7:
            return completions[0]['text']
        
        return None
    
    def explain_suggestion(self, suggestion: Dict[str, Any]) -> str:
        """Explain why a suggestion was made"""
        explanations = {
            'phrase': "Common phrase completion",
            'character': "Character-specific action",
            'transition': "Transitional phrase",
            'starter': "Sentence starter",
            'dialogue': "Dialogue tag",
            'story': "Personal story injection",
            'voice': "Voice-consistent phrase"
        }
        
        return explanations.get(suggestion['type'], "Contextual suggestion")