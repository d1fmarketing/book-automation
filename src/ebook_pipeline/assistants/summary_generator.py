#!/usr/bin/env python3
"""
SummaryGenerator: Automatic summary generation for chapters and sections
"""
import re
from typing import Dict, List, Any, Optional, Tuple
import logging
import nltk
from collections import Counter
import yaml
import json
from pathlib import Path

logger = logging.getLogger(__name__)

# Download required NLTK data
try:
    nltk.data.find('tokenizers/punkt')
    nltk.data.find('corpus/stopwords')
except LookupError:
    nltk.download('punkt', quiet=True)
    nltk.download('stopwords', quiet=True)


class SummaryGenerator:
    """Generate contextual summaries for chapters and sections"""
    
    def __init__(self):
        self.stopwords = set(nltk.corpus.stopwords.words('portuguese'))
        self.stopwords.update(nltk.corpus.stopwords.words('english'))
        self.story_bible = self._load_story_bible()
        self.context = self._load_context()
        
    def _load_story_bible(self) -> Dict[str, Any]:
        """Load story bible"""
        path = Path("context/story-bible.yaml")
        if path.exists():
            with open(path, 'r', encoding='utf-8') as f:
                return yaml.safe_load(f) or {}
        return {}
    
    def _load_context(self) -> Dict[str, Any]:
        """Load current context"""
        path = Path("context/CONTEXT.md")
        if path.exists():
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()
            # Basic parsing
            return {'raw': content}
        return {}
    
    def generate_summary(self, text: str, summary_type: str = "chapter",
                        max_length: int = 150) -> Dict[str, Any]:
        """Generate summary of given text"""
        
        if summary_type == "chapter":
            return self._generate_chapter_summary(text, max_length)
        elif summary_type == "section":
            return self._generate_section_summary(text, max_length)
        elif summary_type == "paragraph":
            return self._generate_paragraph_summary(text, max_length)
        elif summary_type == "book":
            return self._generate_book_summary(text, max_length)
        else:
            return self._generate_generic_summary(text, max_length)
    
    def _generate_chapter_summary(self, text: str, max_length: int) -> Dict[str, Any]:
        """Generate comprehensive chapter summary"""
        
        # Extract key elements
        sentences = nltk.sent_tokenize(text)
        
        summary = {
            'summary': self._extract_summary(sentences, max_length),
            'key_points': self._extract_key_points(text),
            'characters_mentioned': self._extract_characters(text),
            'locations_mentioned': self._extract_locations(text),
            'key_events': self._extract_events(text),
            'emotional_arc': self._analyze_emotional_arc(text),
            'plot_developments': self._extract_plot_developments(text),
            'themes': self._extract_themes(text),
            'word_count': len(text.split()),
            'reading_time': self._estimate_reading_time(text)
        }
        
        return summary
    
    def _generate_section_summary(self, text: str, max_length: int) -> Dict[str, Any]:
        """Generate section summary"""
        sentences = nltk.sent_tokenize(text)
        
        return {
            'summary': self._extract_summary(sentences, max_length),
            'main_topic': self._identify_main_topic(text),
            'key_concepts': self._extract_key_concepts(text),
            'examples': self._extract_examples(text),
            'word_count': len(text.split())
        }
    
    def _generate_paragraph_summary(self, text: str, max_length: int) -> Dict[str, Any]:
        """Generate single paragraph summary"""
        # For paragraphs, extract the main idea
        sentences = nltk.sent_tokenize(text)
        
        if len(sentences) <= 2:
            summary = text
        else:
            # Get first and most important sentence
            important_sent = self._find_most_important_sentence(sentences)
            summary = important_sent
        
        return {
            'summary': summary[:max_length],
            'type': self._classify_paragraph_type(text),
            'key_terms': self._extract_key_terms(text, limit=5)
        }
    
    def _generate_book_summary(self, text: str, max_length: int) -> Dict[str, Any]:
        """Generate book-level summary"""
        # This would typically work with multiple chapters
        return {
            'summary': self._extract_summary(nltk.sent_tokenize(text), max_length),
            'genre': self._identify_genre(text),
            'main_characters': self._extract_all_characters(text),
            'setting': self._extract_setting(text),
            'central_conflict': self._identify_central_conflict(text),
            'themes': self._extract_themes(text),
            'tone': self._analyze_tone(text)
        }
    
    def _generate_generic_summary(self, text: str, max_length: int) -> Dict[str, Any]:
        """Generate generic summary"""
        sentences = nltk.sent_tokenize(text)
        
        return {
            'summary': self._extract_summary(sentences, max_length),
            'key_points': self._extract_key_points(text),
            'word_count': len(text.split())
        }
    
    def _extract_summary(self, sentences: List[str], max_length: int) -> str:
        """Extract summary using sentence ranking"""
        if not sentences:
            return ""
        
        if len(sentences) <= 3:
            return ' '.join(sentences)[:max_length]
        
        # Rank sentences by importance
        scores = self._score_sentences(sentences)
        
        # Sort sentences by score
        ranked = sorted(enumerate(sentences), key=lambda x: scores[x[0]], reverse=True)
        
        # Take top sentences until we reach max_length
        summary_sentences = []
        current_length = 0
        
        for idx, sent in ranked:
            sent_length = len(sent.split())
            if current_length + sent_length <= max_length:
                summary_sentences.append((idx, sent))
                current_length += sent_length
        
        # Sort by original order
        summary_sentences.sort(key=lambda x: x[0])
        
        return ' '.join([sent for _, sent in summary_sentences])
    
    def _score_sentences(self, sentences: List[str]) -> List[float]:
        """Score sentences by importance"""
        # Word frequency
        word_freq = self._calculate_word_frequency(sentences)
        
        scores = []
        for sent in sentences:
            words = [w.lower() for w in sent.split() 
                    if w.lower() not in self.stopwords and len(w) > 3]
            
            if not words:
                scores.append(0)
                continue
            
            # Average word frequency
            score = sum(word_freq.get(w, 0) for w in words) / len(words)
            
            # Boost for position (first and last sentences)
            if sentences.index(sent) == 0:
                score *= 1.2
            elif sentences.index(sent) == len(sentences) - 1:
                score *= 1.1
            
            # Boost for sentences with key terms
            key_terms = ['importante', 'principal', 'crucial', 'fundamental', 
                        'essencial', 'resultado', 'conclusão', 'descoberta']
            if any(term in sent.lower() for term in key_terms):
                score *= 1.3
            
            scores.append(score)
        
        return scores
    
    def _calculate_word_frequency(self, sentences: List[str]) -> Dict[str, float]:
        """Calculate word frequency scores"""
        word_count = Counter()
        
        for sent in sentences:
            words = [w.lower() for w in sent.split() 
                    if w.lower() not in self.stopwords and len(w) > 3]
            word_count.update(words)
        
        # Normalize frequencies
        max_freq = max(word_count.values()) if word_count else 1
        
        return {word: freq / max_freq for word, freq in word_count.items()}
    
    def _extract_key_points(self, text: str) -> List[str]:
        """Extract key points from text"""
        key_points = []
        
        # Look for enumerated points
        enum_patterns = [
            r'(?:^|\n)\s*(?:\d+[\).]|[a-z][\).]|\*|\-)\s*(.+?)(?=\n|$)',
            r'(?:Primeiro|Segundo|Terceiro|Primeiro),?\s*(.+?)(?=\.|;|$)',
            r'(?:First|Second|Third|Finally),?\s*(.+?)(?=\.|;|$)'
        ]
        
        for pattern in enum_patterns:
            matches = re.findall(pattern, text, re.MULTILINE | re.IGNORECASE)
            key_points.extend(matches)
        
        # Look for emphasized points
        emphasis_patterns = [
            r'(?:importante|crucial|fundamental|essencial)\s*(?:é|:)?\s*(.+?)(?=\.|$)',
            r'(?:lembre-se|note|observe|repare)\s*(?:que|:)?\s*(.+?)(?=\.|$)'
        ]
        
        for pattern in emphasis_patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            key_points.extend(matches)
        
        # Deduplicate and clean
        seen = set()
        unique_points = []
        for point in key_points:
            point = point.strip()
            if point and point.lower() not in seen and len(point) > 20:
                seen.add(point.lower())
                unique_points.append(point)
        
        return unique_points[:5]  # Top 5 key points
    
    def _extract_characters(self, text: str) -> List[str]:
        """Extract mentioned characters"""
        characters = []
        
        # Get character names from story bible
        story_characters = self.story_bible.get('characters', {})
        
        for char_id, char_data in story_characters.items():
            char_name = char_data.get('name', char_id)
            if char_name.lower() in text.lower():
                characters.append(char_name)
            
            # Check aliases
            for alias in char_data.get('aliases', []):
                if alias.lower() in text.lower():
                    if char_name not in characters:
                        characters.append(char_name)
                    break
        
        # Also look for capitalized names not in story bible
        name_pattern = r'\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b'
        potential_names = re.findall(name_pattern, text)
        
        for name in potential_names:
            if name not in characters and self._is_likely_character_name(name, text):
                characters.append(name)
        
        return characters
    
    def _is_likely_character_name(self, name: str, text: str) -> bool:
        """Check if a capitalized word is likely a character name"""
        # Simple heuristics
        name_lower = name.lower()
        
        # Skip common non-names
        non_names = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
                    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
                    'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo']
        
        if name_lower in non_names:
            return False
        
        # Check if it appears with character-like verbs
        character_verbs = ['disse', 'falou', 'perguntou', 'respondeu', 'pensou',
                          'olhou', 'sorriu', 'suspirou', 'gritou', 'murmurou']
        
        for verb in character_verbs:
            if f"{name} {verb}" in text or f"{verb} {name}" in text:
                return True
        
        return False
    
    def _extract_locations(self, text: str) -> List[str]:
        """Extract mentioned locations"""
        locations = []
        
        # Get locations from story bible
        world = self.story_bible.get('world', {})
        story_locations = world.get('locations', {})
        
        for loc_id, loc_data in story_locations.items():
            loc_name = loc_data.get('name', loc_id)
            if loc_name.lower() in text.lower():
                locations.append(loc_name)
        
        # Common location indicators
        location_patterns = [
            r'(?:em|no|na|ao)\s+([A-Z][a-z]+(?:\s+[a-z]+)*)',
            r'(?:foi para|chegou em|partiu de)\s+([A-Z][a-z]+)',
        ]
        
        for pattern in location_patterns:
            matches = re.findall(pattern, text)
            locations.extend(matches)
        
        # Deduplicate
        return list(set(locations))
    
    def _extract_events(self, text: str) -> List[str]:
        """Extract key events from text"""
        events = []
        
        # Action verb patterns
        event_patterns = [
            r'(?:quando|então|depois|em seguida)\s+(.+?)(?=\.|,|$)',
            r'(?:descobriu|encontrou|revelou|percebeu)\s+(?:que\s+)?(.+?)(?=\.|$)',
            r'(?:aconteceu|ocorreu|sucedeu)\s+(?:que\s+)?(.+?)(?=\.|$)'
        ]
        
        for pattern in event_patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            events.extend(matches)
        
        # Clean and filter
        events = [e.strip() for e in events if len(e.strip()) > 20]
        
        return events[:5]
    
    def _analyze_emotional_arc(self, text: str) -> Dict[str, Any]:
        """Analyze emotional progression in text"""
        # Simplified emotion detection
        emotions = {
            'joy': ['feliz', 'alegre', 'contente', 'satisfeito', 'radiante', 'sorriso'],
            'sadness': ['triste', 'melancólico', 'lágrima', 'chorar', 'deprimido'],
            'anger': ['raiva', 'furioso', 'irritado', 'bravo', 'indignado'],
            'fear': ['medo', 'assustado', 'terror', 'pânico', 'receio'],
            'surprise': ['surpreso', 'espantado', 'chocado', 'atônito', 'perplexo'],
            'love': ['amor', 'paixão', 'carinho', 'afeto', 'adorar']
        }
        
        # Count emotions in different parts
        sentences = nltk.sent_tokenize(text)
        parts = {
            'beginning': ' '.join(sentences[:len(sentences)//3]),
            'middle': ' '.join(sentences[len(sentences)//3:2*len(sentences)//3]),
            'end': ' '.join(sentences[2*len(sentences)//3:])
        }
        
        arc = {}
        for part_name, part_text in parts.items():
            part_emotions = Counter()
            for emotion, keywords in emotions.items():
                count = sum(1 for keyword in keywords if keyword in part_text.lower())
                if count > 0:
                    part_emotions[emotion] = count
            
            if part_emotions:
                arc[part_name] = part_emotions.most_common(1)[0][0]
            else:
                arc[part_name] = 'neutral'
        
        return arc
    
    def _extract_plot_developments(self, text: str) -> List[str]:
        """Extract plot developments"""
        developments = []
        
        # Plot development indicators
        patterns = [
            r'(?:revelou-se que|descobriu-se que)\s+(.+?)(?=\.|$)',
            r'(?:o segredo era|a verdade era)\s+(.+?)(?=\.|$)',
            r'(?:tudo mudou quando|virou quando)\s+(.+?)(?=\.|$)',
            r'(?:plot twist:|reviravolta:)\s*(.+?)(?=\.|$)'
        ]
        
        for pattern in patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            developments.extend(matches)
        
        return developments[:3]
    
    def _extract_themes(self, text: str) -> List[str]:
        """Extract themes from text"""
        # Common themes and their indicators
        theme_indicators = {
            'love': ['amor', 'paixão', 'romance', 'coração', 'sentimento'],
            'friendship': ['amizade', 'amigo', 'companheiro', 'parceria', 'lealdade'],
            'betrayal': ['traição', 'trair', 'enganar', 'mentira', 'falsidade'],
            'redemption': ['redenção', 'perdão', 'segunda chance', 'mudar', 'transformar'],
            'power': ['poder', 'controle', 'dominar', 'autoridade', 'força'],
            'sacrifice': ['sacrifício', 'abrir mão', 'renunciar', 'doar-se'],
            'identity': ['identidade', 'quem sou', 'descobrir-se', 'verdadeiro eu'],
            'family': ['família', 'pai', 'mãe', 'filho', 'irmão', 'laços']
        }
        
        themes = []
        text_lower = text.lower()
        
        for theme, indicators in theme_indicators.items():
            count = sum(1 for indicator in indicators if indicator in text_lower)
            if count >= 2:  # At least 2 indicators
                themes.append(theme)
        
        return themes
    
    def _extract_key_concepts(self, text: str) -> List[str]:
        """Extract key concepts (for technical content)"""
        # Look for defined terms
        concepts = []
        
        patterns = [
            r'(?:define-se|definimos)\s+(\w+)\s+como',
            r'(\w+)\s+(?:é|significa|representa)\s+(?:um|uma)',
            r'(?:conceito de|ideia de)\s+(\w+)',
            r'(?:chamamos de|conhecido como)\s+(\w+)'
        ]
        
        for pattern in patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            concepts.extend(matches)
        
        # Also extract frequently mentioned technical terms
        words = [w for w in text.split() if len(w) > 5 and w[0].isupper()]
        word_count = Counter(words)
        
        for word, count in word_count.most_common(5):
            if count > 2 and word not in concepts:
                concepts.append(word)
        
        return concepts[:7]
    
    def _extract_examples(self, text: str) -> List[str]:
        """Extract examples from text"""
        examples = []
        
        patterns = [
            r'(?:por exemplo|exemplo:)\s*(.+?)(?=\.|$)',
            r'(?:como|tipo)\s+(.+?)(?=\.|$)',
            r'(?:imagine|imagina)\s+(.+?)(?=\.|$)',
            r'(?:veja o caso de|considere)\s+(.+?)(?=\.|$)'
        ]
        
        for pattern in patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            examples.extend(matches)
        
        return [ex.strip() for ex in examples if len(ex.strip()) > 20][:3]
    
    def _identify_main_topic(self, text: str) -> str:
        """Identify main topic of section"""
        # Get most frequent significant words
        words = [w.lower() for w in text.split() 
                if w.lower() not in self.stopwords and len(w) > 4]
        
        if not words:
            return "general"
        
        word_count = Counter(words)
        main_words = [word for word, _ in word_count.most_common(3)]
        
        return ' '.join(main_words)
    
    def _classify_paragraph_type(self, text: str) -> str:
        """Classify paragraph type"""
        text_lower = text.lower()
        
        if any(q in text_lower for q in ['?', 'por que', 'como', 'quando', 'onde']):
            return 'question'
        elif any(d in text for d in ['"', '"', '"']):
            return 'dialogue'
        elif any(a in text_lower for a in ['primeiro', 'segundo', 'passo 1', '1.', '2.']):
            return 'instructional'
        elif any(e in text_lower for e in ['por exemplo', 'como', 'imagine']):
            return 'example'
        elif len(text.split('.')) > 3:
            return 'explanatory'
        else:
            return 'narrative'
    
    def _extract_key_terms(self, text: str, limit: int = 10) -> List[str]:
        """Extract key terms from text"""
        # Remove stopwords and get significant terms
        words = [w.lower() for w in text.split() 
                if w.lower() not in self.stopwords and len(w) > 3]
        
        word_count = Counter(words)
        
        return [word for word, _ in word_count.most_common(limit)]
    
    def _find_most_important_sentence(self, sentences: List[str]) -> str:
        """Find most important sentence in list"""
        if not sentences:
            return ""
        
        scores = self._score_sentences(sentences)
        max_idx = scores.index(max(scores))
        
        return sentences[max_idx]
    
    def _estimate_reading_time(self, text: str) -> int:
        """Estimate reading time in minutes"""
        words = len(text.split())
        # Average reading speed: 250 words per minute
        return max(1, round(words / 250))
    
    def _identify_genre(self, text: str) -> str:
        """Identify likely genre (simplified)"""
        genre_indicators = {
            'technical': ['código', 'função', 'algoritmo', 'sistema', 'programação'],
            'fiction': ['personagem', 'história', 'aventura', 'mistério', 'romance'],
            'self-help': ['você pode', 'melhore', 'sucesso', 'hábito', 'mindset'],
            'business': ['negócio', 'empresa', 'mercado', 'cliente', 'estratégia'],
            'educational': ['aprender', 'ensinar', 'conceito', 'exemplo', 'exercício']
        }
        
        text_lower = text.lower()
        genre_scores = {}
        
        for genre, indicators in genre_indicators.items():
            score = sum(1 for indicator in indicators if indicator in text_lower)
            if score > 0:
                genre_scores[genre] = score
        
        if genre_scores:
            return max(genre_scores.items(), key=lambda x: x[1])[0]
        
        return 'general'
    
    def _extract_all_characters(self, text: str) -> List[Dict[str, Any]]:
        """Extract all characters with roles"""
        characters = self._extract_characters(text)
        
        char_info = []
        for char in characters:
            info = {
                'name': char,
                'mentions': text.lower().count(char.lower()),
                'role': self._determine_character_role(char, text)
            }
            char_info.append(info)
        
        # Sort by mentions
        char_info.sort(key=lambda x: x['mentions'], reverse=True)
        
        return char_info
    
    def _determine_character_role(self, character: str, text: str) -> str:
        """Determine character's role in story"""
        mentions = text.lower().count(character.lower())
        
        if mentions > 10:
            return 'protagonist'
        elif mentions > 5:
            return 'major'
        else:
            return 'minor'
    
    def _extract_setting(self, text: str) -> Dict[str, Any]:
        """Extract setting information"""
        locations = self._extract_locations(text)
        
        # Time indicators
        time_patterns = [
            r'(?:em|no ano de)\s+(\d{4})',
            r'(?:século|century)\s+([IVXLCDM]+|\d+)',
            r'(?:manhã|tarde|noite|madrugada)',
            r'(?:verão|inverno|primavera|outono)'
        ]
        
        time_mentions = []
        for pattern in time_patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            time_mentions.extend(matches)
        
        return {
            'locations': locations,
            'time_period': time_mentions[0] if time_mentions else 'contemporary',
            'atmosphere': self._determine_atmosphere(text)
        }
    
    def _determine_atmosphere(self, text: str) -> str:
        """Determine story atmosphere"""
        atmosphere_words = {
            'dark': ['escuro', 'sombrio', 'negro', 'trevas', 'medo'],
            'light': ['luz', 'brilhante', 'claro', 'sol', 'iluminado'],
            'mysterious': ['mistério', 'enigma', 'secreto', 'oculto', 'estranho'],
            'romantic': ['amor', 'paixão', 'romance', 'coração', 'beijo'],
            'tense': ['tensão', 'nervoso', 'ansiedade', 'pressão', 'stress']
        }
        
        text_lower = text.lower()
        atmosphere_scores = {}
        
        for atmosphere, words in atmosphere_words.items():
            score = sum(1 for word in words if word in text_lower)
            if score > 0:
                atmosphere_scores[atmosphere] = score
        
        if atmosphere_scores:
            return max(atmosphere_scores.items(), key=lambda x: x[1])[0]
        
        return 'neutral'
    
    def _identify_central_conflict(self, text: str) -> str:
        """Identify central conflict (simplified)"""
        conflict_patterns = [
            r'(?:problema|conflito|desafio)\s+(?:é|era)\s+(.+?)(?=\.|$)',
            r'(?:precisa|precisava)\s+(.+?)(?=\.|$)',
            r'(?:luta|batalha|enfrenta)\s+(?:contra|com)\s+(.+?)(?=\.|$)'
        ]
        
        for pattern in conflict_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                return match.group(1).strip()
        
        return "Not clearly defined"
    
    def _analyze_tone(self, text: str) -> str:
        """Analyze overall tone"""
        tone_indicators = {
            'formal': ['portanto', 'contudo', 'mediante', 'conforme'],
            'informal': ['né', 'tá', 'pra', 'cara', 'tipo'],
            'humorous': ['haha', 'kkk', 'rsrs', 'piada', 'engraçado'],
            'serious': ['grave', 'sério', 'importante', 'crucial'],
            'optimistic': ['esperança', 'positivo', 'melhor', 'sucesso'],
            'pessimistic': ['problema', 'difícil', 'impossível', 'fracasso']
        }
        
        text_lower = text.lower()
        tone_scores = Counter()
        
        for tone, indicators in tone_indicators.items():
            score = sum(1 for indicator in indicators if indicator in text_lower)
            if score > 0:
                tone_scores[tone] = score
        
        if tone_scores:
            return tone_scores.most_common(1)[0][0]
        
        return 'neutral'
    
    def generate_bullet_summary(self, text: str, num_bullets: int = 5) -> List[str]:
        """Generate bullet point summary"""
        # Extract key points
        key_points = self._extract_key_points(text)
        
        if key_points:
            return key_points[:num_bullets]
        
        # Fall back to extracting most important sentences
        sentences = nltk.sent_tokenize(text)
        scores = self._score_sentences(sentences)
        
        # Get top sentences
        ranked = sorted(enumerate(sentences), key=lambda x: scores[x[0]], reverse=True)
        
        bullets = []
        for idx, sent in ranked[:num_bullets]:
            # Shorten if too long
            if len(sent) > 100:
                sent = sent[:97] + "..."
            bullets.append(f"• {sent}")
        
        return bullets
    
    def generate_tweet_summary(self, text: str, max_chars: int = 280) -> str:
        """Generate tweet-length summary"""
        # Get the essence in very few words
        sentences = nltk.sent_tokenize(text)
        
        if not sentences:
            return ""
        
        # Find most important sentence
        important = self._find_most_important_sentence(sentences)
        
        if len(important) <= max_chars:
            return important
        
        # Shorten intelligently
        words = important.split()
        summary = ""
        
        for word in words:
            if len(summary) + len(word) + 1 < max_chars - 3:  # Reserve space for "..."
                summary += word + " "
            else:
                break
        
        return summary.strip() + "..."