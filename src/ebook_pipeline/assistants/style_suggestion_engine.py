#!/usr/bin/env python3
"""
StyleSuggestionEngine: Real-time style suggestions based on writing rules
"""
import re
import yaml
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple
import logging
from difflib import SequenceMatcher
import nltk
from collections import Counter

logger = logging.getLogger(__name__)

# Download required NLTK data if not present
try:
    nltk.data.find('tokenizers/punkt')
except LookupError:
    nltk.download('punkt', quiet=True)


class StyleSuggestion:
    """Represents a single style suggestion"""
    def __init__(self, text: str, suggestion: str, reason: str, 
                 severity: str = "info", position: Tuple[int, int] = None):
        self.text = text
        self.suggestion = suggestion
        self.reason = reason
        self.severity = severity  # info, warning, error
        self.position = position  # (start, end) character positions


class StyleSuggestionEngine:
    """Engine for providing real-time style suggestions"""
    
    def __init__(self):
        self.writing_rules = self._load_writing_rules()
        self.forbidden_words = self._get_forbidden_words()
        self.voice_config = self._load_voice_config()
        
    def _load_writing_rules(self) -> Dict[str, Any]:
        """Load writing rules from configuration"""
        rules_path = Path("context/WRITING-RULES.md")
        if rules_path.exists():
            # Parse markdown file for rules
            with open(rules_path, 'r', encoding='utf-8') as f:
                content = f.read()
            return self._parse_writing_rules(content)
        return {}
    
    def _parse_writing_rules(self, content: str) -> Dict[str, Any]:
        """Parse writing rules from markdown content"""
        rules = {
            'forbidden_words': [],
            'sentence_length': {'min': 5, 'max': 30, 'avg': 15},
            'paragraph_length': {'min': 3, 'max': 5},
            'style_preferences': {}
        }
        
        # Extract forbidden words
        forbidden_section = re.search(r'### Forbidden Words:?\s*\n(.*?)(?=\n###|\n##|\Z)', 
                                     content, re.DOTALL)
        if forbidden_section:
            lines = forbidden_section.group(1).strip().split('\n')
            for line in lines:
                match = re.search(r'-\s*"?(\w+)"?', line)
                if match:
                    rules['forbidden_words'].append(match.group(1).lower())
        
        return rules
    
    def _get_forbidden_words(self) -> List[str]:
        """Get list of forbidden words from rules"""
        return self.writing_rules.get('forbidden_words', [
            'very', 'really', 'just', 'suddenly', 'somehow',
            'basically', 'actually', 'literally', 'totally'
        ])
    
    def _load_voice_config(self) -> Dict[str, Any]:
        """Load voice configuration"""
        config_path = Path("context/humanization/voice-templates.yaml")
        if config_path.exists():
            with open(config_path, 'r', encoding='utf-8') as f:
                return yaml.safe_load(f)
        return {}
    
    def analyze_text(self, text: str, context: Dict[str, Any] = None) -> List[StyleSuggestion]:
        """Analyze text and return style suggestions"""
        suggestions = []
        
        # Check forbidden words
        suggestions.extend(self._check_forbidden_words(text))
        
        # Check sentence structure
        suggestions.extend(self._check_sentence_structure(text))
        
        # Check paragraph structure
        suggestions.extend(self._check_paragraph_structure(text))
        
        # Check for AI patterns
        suggestions.extend(self._check_ai_patterns(text))
        
        # Check style consistency
        if context:
            suggestions.extend(self._check_style_consistency(text, context))
        
        # Check for repetition
        suggestions.extend(self._check_repetition(text))
        
        # Suggest improvements
        suggestions.extend(self._suggest_improvements(text))
        
        return suggestions
    
    def _check_forbidden_words(self, text: str) -> List[StyleSuggestion]:
        """Check for forbidden words"""
        suggestions = []
        text_lower = text.lower()
        
        for word in self.forbidden_words:
            pattern = rf'\b{re.escape(word)}\b'
            matches = list(re.finditer(pattern, text_lower))
            
            for match in matches:
                start, end = match.span()
                original_word = text[start:end]
                
                # Get alternative
                alternative = self._get_word_alternative(word)
                
                suggestion = StyleSuggestion(
                    text=original_word,
                    suggestion=alternative,
                    reason=f"'{word}' is a forbidden word - consider alternatives",
                    severity="warning",
                    position=(start, end)
                )
                suggestions.append(suggestion)
        
        return suggestions
    
    def _get_word_alternative(self, word: str) -> str:
        """Get alternative for forbidden word"""
        alternatives = {
            'very': 'extremely|quite|remarkably',
            'really': 'truly|genuinely|indeed',
            'just': '[remove or be specific]',
            'suddenly': '[show the surprise through action]',
            'somehow': '[be specific about how]',
            'basically': 'essentially|fundamentally',
            'actually': '[often unnecessary]',
            'literally': '[usually unnecessary]',
            'totally': 'completely|entirely'
        }
        return alternatives.get(word, '[find alternative]')
    
    def _check_sentence_structure(self, text: str) -> List[StyleSuggestion]:
        """Check sentence length and structure"""
        suggestions = []
        sentences = nltk.sent_tokenize(text)
        
        for i, sentence in enumerate(sentences):
            words = sentence.split()
            word_count = len(words)
            
            # Check sentence length
            if word_count < 5:
                if not re.match(r'^(Yes|No|Maybe|Exactly|Bingo|É isso)\.?$', sentence.strip()):
                    suggestions.append(StyleSuggestion(
                        text=sentence,
                        suggestion="Consider expanding this sentence",
                        reason=f"Very short sentence ({word_count} words)",
                        severity="info"
                    ))
            elif word_count > 30:
                suggestions.append(StyleSuggestion(
                    text=sentence[:50] + "...",
                    suggestion="Consider breaking into multiple sentences",
                    reason=f"Long sentence ({word_count} words)",
                    severity="warning"
                ))
            
            # Check sentence starters
            if i > 0 and sentence.strip():
                first_word = words[0] if words else ""
                if first_word.lower() in ['the', 'this', 'that', 'it']:
                    # Count how many sentences start the same way
                    same_starts = sum(1 for s in sentences[:i] 
                                    if s.strip().lower().startswith(first_word.lower()))
                    if same_starts > 2:
                        suggestions.append(StyleSuggestion(
                            text=first_word,
                            suggestion="Vary sentence beginnings",
                            reason="Too many sentences start with '{}'".format(first_word),
                            severity="info"
                        ))
        
        return suggestions
    
    def _check_paragraph_structure(self, text: str) -> List[StyleSuggestion]:
        """Check paragraph length and structure"""
        suggestions = []
        paragraphs = text.split('\n\n')
        
        for i, para in enumerate(paragraphs):
            if not para.strip():
                continue
                
            sentences = nltk.sent_tokenize(para)
            sent_count = len(sentences)
            
            if sent_count == 1 and len(para.split()) > 50:
                suggestions.append(StyleSuggestion(
                    text=para[:50] + "...",
                    suggestion="Break into multiple sentences",
                    reason="Single-sentence paragraph is too long",
                    severity="warning"
                ))
            elif sent_count > 7:
                suggestions.append(StyleSuggestion(
                    text=f"Paragraph {i+1}",
                    suggestion="Consider splitting this paragraph",
                    reason=f"Long paragraph ({sent_count} sentences)",
                    severity="info"
                ))
        
        # Check paragraph variety
        if len(paragraphs) > 3:
            para_lengths = [len(nltk.sent_tokenize(p)) for p in paragraphs if p.strip()]
            if para_lengths and all(3 <= length <= 5 for length in para_lengths):
                suggestions.append(StyleSuggestion(
                    text="Overall structure",
                    suggestion="Vary paragraph lengths more",
                    reason="All paragraphs have similar length (3-5 sentences)",
                    severity="info"
                ))
        
        return suggestions
    
    def _check_ai_patterns(self, text: str) -> List[StyleSuggestion]:
        """Check for common AI writing patterns"""
        suggestions = []
        
        # Load anti-patterns
        anti_patterns_path = Path("context/humanization/anti-patterns.yaml")
        if anti_patterns_path.exists():
            with open(anti_patterns_path, 'r', encoding='utf-8') as f:
                anti_patterns = yaml.safe_load(f)
            
            forbidden = anti_patterns.get('forbidden_phrases', {})
            
            # Check academic markers
            for phrase in forbidden.get('academic_markers', []):
                if re.search(rf'\b{re.escape(phrase)}\b', text, re.IGNORECASE):
                    suggestions.append(StyleSuggestion(
                        text=phrase,
                        suggestion=f"Remove '{phrase}' - too formal",
                        reason="This phrase is commonly used by AI",
                        severity="warning"
                    ))
            
            # Check overused transitions
            for phrase in forbidden.get('overused_transitions', []):
                if phrase.lower() in text.lower():
                    suggestions.append(StyleSuggestion(
                        text=phrase,
                        suggestion=f"Replace '{phrase}' with simpler alternative",
                        reason="Overused AI transition phrase",
                        severity="warning"
                    ))
        
        return suggestions
    
    def _check_style_consistency(self, text: str, context: Dict[str, Any]) -> List[StyleSuggestion]:
        """Check consistency with established style"""
        suggestions = []
        
        # Get target voice from context
        target_voice = context.get('voice', 'conversational_expert')
        chapter_type = context.get('chapter_type', 'general')
        
        # Check if text matches expected voice
        if target_voice == 'conversational_expert':
            # Should have personal pronouns
            pronouns = ['eu', 'você', 'nós', 'a gente']
            pronoun_count = sum(text.lower().count(p) for p in pronouns)
            
            if pronoun_count == 0 and len(text.split()) > 100:
                suggestions.append(StyleSuggestion(
                    text="Overall tone",
                    suggestion="Add personal pronouns (eu, você, nós) for conversational tone",
                    reason="Text lacks conversational elements",
                    severity="info"
                ))
        
        # Check for questions (engagement)
        if '?' not in text and len(text.split()) > 200:
            suggestions.append(StyleSuggestion(
                text="Engagement",
                suggestion="Consider adding a question to engage the reader",
                reason="No questions found in long text",
                severity="info"
            ))
        
        return suggestions
    
    def _check_repetition(self, text: str) -> List[StyleSuggestion]:
        """Check for word and phrase repetition"""
        suggestions = []
        
        # Check word repetition
        words = re.findall(r'\b\w+\b', text.lower())
        word_counts = Counter(words)
        
        # Ignore common words
        common_words = {'o', 'a', 'de', 'que', 'e', 'é', 'para', 'um', 'uma', 
                       'com', 'não', 'em', 'se', 'na', 'por', 'mais', 'os', 'as'}
        
        for word, count in word_counts.items():
            if word not in common_words and len(word) > 4 and count > 3:
                # Check if repetitions are close together
                positions = [m.start() for m in re.finditer(rf'\b{re.escape(word)}\b', text.lower())]
                if len(positions) > 1:
                    distances = [positions[i+1] - positions[i] for i in range(len(positions)-1)]
                    if any(d < 100 for d in distances):  # Within 100 characters
                        suggestions.append(StyleSuggestion(
                            text=word,
                            suggestion=f"'{word}' appears {count} times - consider synonyms",
                            reason="Word repetition detected",
                            severity="info"
                        ))
        
        # Check phrase repetition
        sentences = nltk.sent_tokenize(text)
        for i in range(len(sentences) - 1):
            for j in range(i + 1, min(i + 5, len(sentences))):  # Check next 5 sentences
                similarity = SequenceMatcher(None, sentences[i][:20], sentences[j][:20]).ratio()
                if similarity > 0.8:  # 80% similar starts
                    suggestions.append(StyleSuggestion(
                        text=sentences[j][:30] + "...",
                        suggestion="Vary sentence structure",
                        reason="Similar sentence beginning detected",
                        severity="info"
                    ))
        
        return suggestions
    
    def _suggest_improvements(self, text: str) -> List[StyleSuggestion]:
        """Suggest general improvements"""
        suggestions = []
        
        # Check for passive voice (Portuguese)
        passive_patterns = [
            r'\b(?:foi|foram|é|são|era|eram|será|serão)\s+\w+(?:ado|ada|ido|ida|ados|adas|idos|idas)\b',
            r'\b(?:está|estão|estava|estavam)\s+sendo\s+\w+(?:ado|ada|ido|ida)\b'
        ]
        
        for pattern in passive_patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            if len(matches) > 2:  # More than 2 passive constructions
                suggestions.append(StyleSuggestion(
                    text="Passive voice",
                    suggestion="Consider using more active voice",
                    reason=f"Found {len(matches)} passive constructions",
                    severity="info"
                ))
                break
        
        # Check for weak verbs
        weak_verbs = ['ser', 'estar', 'ter', 'haver', 'fazer']
        verb_pattern = r'\b(?:' + '|'.join(weak_verbs) + r')\b'
        weak_verb_count = len(re.findall(verb_pattern, text.lower()))
        total_verbs = len(re.findall(r'\b\w+(?:ar|er|ir|ando|endo|indo)\b', text.lower()))
        
        if total_verbs > 0 and weak_verb_count / total_verbs > 0.3:
            suggestions.append(StyleSuggestion(
                text="Verb choice",
                suggestion="Use more specific, action-oriented verbs",
                reason="High proportion of weak verbs",
                severity="info"
            ))
        
        return suggestions
    
    def get_autocomplete_suggestions(self, text: str, cursor_position: int,
                                   context: Dict[str, Any] = None) -> List[str]:
        """Get autocomplete suggestions based on context"""
        # Get text before cursor
        text_before = text[:cursor_position]
        
        # Get last few words
        words = text_before.split()
        if not words:
            return []
        
        last_words = ' '.join(words[-3:]) if len(words) >= 3 else ' '.join(words)
        
        suggestions = []
        
        # Get voice-appropriate suggestions
        if context:
            voice_type = context.get('voice_type', 'general')
            voice_templates = self.voice_config.get('voice_variations', {})
            
            if voice_type in voice_templates:
                voice = voice_templates[voice_type]
                
                # Check if we're at a good point for a phrase
                if text_before.rstrip().endswith('.'):
                    suggestions.extend(voice.get('sentence_starters', []))
                elif text_before.rstrip().endswith(','):
                    suggestions.extend(voice.get('transitions', []))
        
        # Common continuations based on patterns
        pattern_suggestions = {
            'por exemplo': [', como', ', tipo', ', assim como'],
            'isso significa': [' que', ' dizer que', ' basicamente que'],
            'o problema': [' é que', ' principal é', ' aqui é'],
            'a solução': [' é simples:', ' mais elegante é', ' que encontrei foi'],
            'vamos': [' começar', ' ver como', ' implementar', ' ao código'],
            'primeiro': [', precisamos', ', vamos', ', é importante'],
            'depois': [' disso,', ' de tudo,', ', é só', ' que'],
        }
        
        for pattern, completions in pattern_suggestions.items():
            if last_words.lower().endswith(pattern):
                suggestions.extend(completions)
        
        # Remove duplicates and limit
        seen = set()
        unique_suggestions = []
        for s in suggestions:
            if s not in seen:
                seen.add(s)
                unique_suggestions.append(s)
        
        return unique_suggestions[:5]  # Return top 5 suggestions
    
    def highlight_issues(self, text: str) -> Dict[str, Any]:
        """Return text with issues highlighted for UI display"""
        suggestions = self.analyze_text(text)
        
        # Group by severity
        errors = [s for s in suggestions if s.severity == "error"]
        warnings = [s for s in suggestions if s.severity == "warning"]
        info = [s for s in suggestions if s.severity == "info"]
        
        # Create highlights
        highlights = []
        
        for suggestion in suggestions:
            if suggestion.position:
                highlights.append({
                    'start': suggestion.position[0],
                    'end': suggestion.position[1],
                    'severity': suggestion.severity,
                    'message': suggestion.reason,
                    'suggestion': suggestion.suggestion
                })
        
        return {
            'text': text,
            'highlights': highlights,
            'summary': {
                'errors': len(errors),
                'warnings': len(warnings),
                'info': len(info)
            },
            'suggestions': suggestions
        }