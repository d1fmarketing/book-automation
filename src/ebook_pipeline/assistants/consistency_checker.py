#!/usr/bin/env python3
"""
ConsistencyChecker: Detects inconsistencies in real-time
"""
import re
import json
import yaml
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple, Set
import logging
from datetime import datetime
import difflib

logger = logging.getLogger(__name__)


class Inconsistency:
    """Represents a detected inconsistency"""
    def __init__(self, type: str, text: str, expected: str, found: str,
                 reason: str, severity: str = "warning", 
                 position: Tuple[int, int] = None, source: str = None):
        self.type = type  # character, timeline, fact, location, etc.
        self.text = text
        self.expected = expected
        self.found = found
        self.reason = reason
        self.severity = severity  # info, warning, error
        self.position = position
        self.source = source  # Where the truth comes from


class ConsistencyChecker:
    """Real-time consistency checking against story bible and previous chapters"""
    
    def __init__(self):
        self.story_bible = self._load_story_bible()
        self.chapter_summaries = self._load_chapter_summaries()
        self.continuity_report = self._load_continuity_report()
        self.context = self._load_context()
        
        # Build quick lookup indices
        self.character_index = self._build_character_index()
        self.location_index = self._build_location_index()
        self.fact_index = self._build_fact_index()
        self.timeline_index = self._build_timeline_index()
        
    def _load_story_bible(self) -> Dict[str, Any]:
        """Load story bible configuration"""
        bible_path = Path("context/story-bible.yaml")
        if bible_path.exists():
            with open(bible_path, 'r', encoding='utf-8') as f:
                return yaml.safe_load(f) or {}
        return {}
    
    def _load_chapter_summaries(self) -> Dict[str, Any]:
        """Load chapter summaries"""
        summaries_path = Path("context/chapter-summaries.json")
        if summaries_path.exists():
            with open(summaries_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        return {}
    
    def _load_continuity_report(self) -> Dict[str, Any]:
        """Load continuity report"""
        report_path = Path("context/continuity-report.json")
        if report_path.exists():
            with open(report_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        return {}
    
    def _load_context(self) -> Dict[str, Any]:
        """Load current context"""
        context_path = Path("context/CONTEXT.md")
        if context_path.exists():
            with open(context_path, 'r', encoding='utf-8') as f:
                content = f.read()
            return self._parse_context(content)
        return {}
    
    def _parse_context(self, content: str) -> Dict[str, Any]:
        """Parse context from markdown"""
        context = {
            'current_chapter': 1,
            'character_status': {},
            'active_plot_threads': [],
            'established_facts': []
        }
        
        # Extract current chapter
        chapter_match = re.search(r'\*\*Current Chapter\*\*:\s*(\d+)', content)
        if chapter_match:
            context['current_chapter'] = int(chapter_match.group(1))
        
        # Extract character status
        char_section = re.search(r'### Character Status\s*\n(.*?)(?=\n###|\n##|\Z)', 
                                content, re.DOTALL)
        if char_section:
            lines = char_section.group(1).strip().split('\n')
            for line in lines:
                if ':' in line:
                    parts = line.split(':', 1)
                    if len(parts) == 2:
                        char_name = parts[0].strip('- *')
                        status = parts[1].strip()
                        context['character_status'][char_name] = status
        
        return context
    
    def _build_character_index(self) -> Dict[str, Dict[str, Any]]:
        """Build character lookup index"""
        index = {}
        
        characters = self.story_bible.get('characters', {})
        for char_id, char_data in characters.items():
            # Index by ID
            index[char_id] = char_data
            
            # Index by name and aliases
            if 'name' in char_data:
                index[char_data['name'].lower()] = char_data
            
            for alias in char_data.get('aliases', []):
                index[alias.lower()] = char_data
        
        return index
    
    def _build_location_index(self) -> Dict[str, Dict[str, Any]]:
        """Build location lookup index"""
        index = {}
        
        world = self.story_bible.get('world', {})
        locations = world.get('locations', {})
        
        for loc_id, loc_data in locations.items():
            index[loc_id] = loc_data
            if 'name' in loc_data:
                index[loc_data['name'].lower()] = loc_data
        
        return index
    
    def _build_fact_index(self) -> List[Dict[str, Any]]:
        """Build fact index from story bible and summaries"""
        facts = []
        
        # Facts from story bible
        rules = self.story_bible.get('world', {}).get('rules', [])
        for rule in rules:
            facts.append({
                'fact': rule,
                'source': 'story-bible',
                'type': 'world_rule'
            })
        
        # Facts from chapter summaries  
        for chapter_id, summary in self.chapter_summaries.items():
            for fact in summary.get('key_facts', []):
                facts.append({
                    'fact': fact,
                    'source': f'chapter-{chapter_id}',
                    'type': 'established_fact'
                })
        
        return facts
    
    def _build_timeline_index(self) -> List[Dict[str, Any]]:
        """Build timeline index"""
        timeline = []
        
        # From story bible
        plot = self.story_bible.get('plot', {})
        for event in plot.get('timeline', []):
            timeline.append({
                'event': event.get('event', ''),
                'chapter': event.get('chapter', 0),
                'description': event.get('description', ''),
                'source': 'story-bible'
            })
        
        # From chapter summaries
        for chapter_id, summary in self.chapter_summaries.items():
            for event in summary.get('events', []):
                timeline.append({
                    'event': event,
                    'chapter': int(chapter_id),
                    'source': f'chapter-{chapter_id}'
                })
        
        # Sort by chapter
        timeline.sort(key=lambda x: x['chapter'])
        
        return timeline
    
    def check_consistency(self, text: str, context: Dict[str, Any] = None) -> List[Inconsistency]:
        """Check text for inconsistencies"""
        inconsistencies = []
        
        # Check character consistency
        inconsistencies.extend(self._check_character_consistency(text))
        
        # Check location consistency
        inconsistencies.extend(self._check_location_consistency(text))
        
        # Check fact consistency
        inconsistencies.extend(self._check_fact_consistency(text))
        
        # Check timeline consistency
        if context:
            inconsistencies.extend(self._check_timeline_consistency(text, context))
        
        # Check name consistency
        inconsistencies.extend(self._check_name_consistency(text))
        
        # Check for contradictions
        inconsistencies.extend(self._check_contradictions(text))
        
        return inconsistencies
    
    def _check_character_consistency(self, text: str) -> List[Inconsistency]:
        """Check character descriptions and attributes"""
        inconsistencies = []
        
        for char_name, char_data in self.character_index.items():
            if char_name in text.lower():
                # Check physical descriptions
                if 'appearance' in char_data:
                    for attr, value in char_data['appearance'].items():
                        inconsistencies.extend(
                            self._check_attribute_consistency(
                                text, char_name, attr, value, 'character'
                            )
                        )
                
                # Check personality traits
                if 'personality' in char_data:
                    traits = char_data['personality']
                    # Check for contradicting behaviors
                    opposite_traits = {
                        'tímido': ['extrovertido', 'barulhento', 'chamativo'],
                        'corajoso': ['covarde', 'medroso', 'tímido'],
                        'calmo': ['nervoso', 'agitado', 'impaciente'],
                        'honesto': ['mentiroso', 'enganador', 'desonesto']
                    }
                    
                    for trait in traits:
                        opposites = opposite_traits.get(trait.lower(), [])
                        for opposite in opposites:
                            if opposite in text.lower() and char_name in text.lower():
                                # Check if they're in same context
                                char_pos = text.lower().find(char_name)
                                opposite_pos = text.lower().find(opposite)
                                if abs(char_pos - opposite_pos) < 200:  # Within ~200 chars
                                    inconsistencies.append(Inconsistency(
                                        type='character_trait',
                                        text=opposite,
                                        expected=f"{char_name} is {trait}",
                                        found=f"described as {opposite}",
                                        reason=f"Contradicts established personality",
                                        severity='warning',
                                        source='story-bible'
                                    ))
        
        return inconsistencies
    
    def _check_attribute_consistency(self, text: str, entity_name: str, 
                                   attr: str, expected_value: str, 
                                   entity_type: str) -> List[Inconsistency]:
        """Check specific attribute consistency"""
        inconsistencies = []
        
        # Common attribute patterns
        patterns = {
            'hair': [
                r'cabelo\s+(\w+)',
                r'cabelos\s+(\w+)',
                r'(\w+)\s+cabelo',
                r'fios\s+(\w+)'
            ],
            'eyes': [
                r'olhos\s+(\w+)',
                r'olhar\s+(\w+)',
                r'íris\s+(\w+)'
            ],
            'height': [
                r'(\w+)\s+de\s+altura',
                r'(\w+)\s+alto',
                r'altura\s+(\w+)'
            ]
        }
        
        # Color mappings
        color_groups = {
            'loiro': ['loiro', 'louro', 'dourado', 'amarelo'],
            'castanho': ['castanho', 'marrom', 'chocolate'],
            'preto': ['preto', 'negro', 'escuro', 'ébano'],
            'ruivo': ['ruivo', 'vermelho', 'acobreado'],
            'azul': ['azul', 'azulado', 'cerúleo'],
            'verde': ['verde', 'esverdeado', 'esmeralda'],
            'castanho': ['castanho', 'marrom', 'avelã']
        }
        
        # Get patterns for this attribute
        attr_patterns = patterns.get(attr, [])
        
        # Find entity mentions
        entity_positions = [m.start() for m in re.finditer(
            re.escape(entity_name), text, re.IGNORECASE
        )]
        
        for pos in entity_positions:
            # Check surrounding text (within 100 chars)
            start = max(0, pos - 100)
            end = min(len(text), pos + 100)
            context = text[start:end]
            
            for pattern in attr_patterns:
                match = re.search(pattern, context, re.IGNORECASE)
                if match:
                    found_value = match.group(1)
                    
                    # Check if it matches expected
                    if not self._values_match(found_value, expected_value, color_groups):
                        inconsistencies.append(Inconsistency(
                            type=f'{entity_type}_{attr}',
                            text=found_value,
                            expected=expected_value,
                            found=found_value,
                            reason=f"{entity_name}'s {attr} should be {expected_value}",
                            severity='error',
                            position=(start + match.start(), start + match.end()),
                            source='story-bible'
                        ))
        
        return inconsistencies
    
    def _values_match(self, found: str, expected: str, 
                     groups: Dict[str, List[str]] = None) -> bool:
        """Check if values match, considering synonyms"""
        found = found.lower()
        expected = expected.lower()
        
        if found == expected:
            return True
        
        # Check synonym groups
        if groups:
            for group_values in groups.values():
                if found in group_values and expected in group_values:
                    return True
        
        # Check partial matches
        if found in expected or expected in found:
            return True
        
        return False
    
    def _check_location_consistency(self, text: str) -> List[Inconsistency]:
        """Check location descriptions"""
        inconsistencies = []
        
        for loc_name, loc_data in self.location_index.items():
            if loc_name in text.lower():
                # Check location attributes
                if 'description' in loc_data:
                    # Extract key descriptors
                    descriptors = self._extract_descriptors(loc_data['description'])
                    
                    # Check if contradicting descriptors appear
                    loc_positions = [m.start() for m in re.finditer(
                        re.escape(loc_name), text, re.IGNORECASE
                    )]
                    
                    for pos in loc_positions:
                        context = text[max(0, pos-150):min(len(text), pos+150)]
                        
                        # Check for contradictions
                        if 'moderno' in descriptors and 'antigo' in context.lower():
                            inconsistencies.append(Inconsistency(
                                type='location_description',
                                text='antigo',
                                expected='moderno',
                                found='antigo',
                                reason=f"{loc_name} is described as modern",
                                severity='warning',
                                source='story-bible'
                            ))
        
        return inconsistencies
    
    def _extract_descriptors(self, description: str) -> Set[str]:
        """Extract key descriptors from description"""
        descriptors = set()
        
        # Common descriptors to look for
        descriptor_words = [
            'moderno', 'antigo', 'grande', 'pequeno', 'novo', 'velho',
            'limpo', 'sujo', 'organizado', 'bagunçado', 'iluminado', 'escuro',
            'quente', 'frio', 'úmido', 'seco', 'barulhento', 'silencioso'
        ]
        
        description_lower = description.lower()
        for word in descriptor_words:
            if word in description_lower:
                descriptors.add(word)
        
        return descriptors
    
    def _check_fact_consistency(self, text: str) -> List[Inconsistency]:
        """Check consistency with established facts"""
        inconsistencies = []
        
        for fact_data in self.fact_index:
            fact = fact_data['fact']
            
            # Simple contradiction detection
            # This is basic - in production, use NLP for better detection
            contradictions = self._find_contradictions(text, fact)
            
            for contradiction in contradictions:
                inconsistencies.append(Inconsistency(
                    type='fact_contradiction',
                    text=contradiction['text'],
                    expected=fact,
                    found=contradiction['text'],
                    reason=f"Contradicts established fact from {fact_data['source']}",
                    severity='error',
                    source=fact_data['source']
                ))
        
        return inconsistencies
    
    def _find_contradictions(self, text: str, fact: str) -> List[Dict[str, Any]]:
        """Find potential contradictions to a fact"""
        contradictions = []
        
        # Basic contradiction patterns
        # In production, use more sophisticated NLP
        
        # Extract key elements from fact
        if 'não' in fact or 'nunca' in fact:
            # Fact states something doesn't happen/exist
            # Check if text says it does
            negated_thing = re.sub(r'.*(?:não|nunca)\s+', '', fact)
            if negated_thing in text and 'não' not in text[max(0, text.find(negated_thing)-20):text.find(negated_thing)]:
                contradictions.append({
                    'text': negated_thing,
                    'position': text.find(negated_thing)
                })
        
        return contradictions
    
    def _check_timeline_consistency(self, text: str, context: Dict[str, Any]) -> List[Inconsistency]:
        """Check timeline consistency"""
        inconsistencies = []
        
        current_chapter = context.get('current_chapter', 1)
        
        # Look for temporal references
        temporal_patterns = [
            r'(?:ontem|yesterday)',
            r'(?:amanhã|tomorrow)',
            r'(?:semana passada|last week)',
            r'(?:próxima semana|next week)',
            r'(?:mês passado|last month)',
            r'(?:próximo mês|next month)',
            r'(?:ano passado|last year)',
            r'(?:próximo ano|next year)',
            r'(?:há|atrás)\s+(\d+)\s+(?:dia|dias|day|days)',
            r'(?:em|in)\s+(\d+)\s+(?:dia|dias|day|days)',
        ]
        
        for pattern in temporal_patterns:
            matches = re.finditer(pattern, text, re.IGNORECASE)
            for match in matches:
                # Check if this temporal reference makes sense
                # given the current position in the timeline
                
                # This is simplified - in production, parse dates properly
                if 'passad' in match.group() or 'atrás' in match.group():
                    # Reference to past
                    # Check if referencing something that hasn't happened yet
                    for event in self.timeline_index:
                        if event['chapter'] > current_chapter:
                            if any(word in event['event'].lower() for word in text[max(0, match.start()-100):match.end()+100].lower().split()):
                                inconsistencies.append(Inconsistency(
                                    type='timeline',
                                    text=match.group(),
                                    expected=f"Event in chapter {event['chapter']}",
                                    found=f"Referenced as past in chapter {current_chapter}",
                                    reason="Referencing future event as past",
                                    severity='error',
                                    position=(match.start(), match.end()),
                                    source='timeline'
                                ))
        
        return inconsistencies
    
    def _check_name_consistency(self, text: str) -> List[Inconsistency]:
        """Check character name consistency"""
        inconsistencies = []
        
        # Look for potential misspellings
        all_names = []
        for char_data in self.character_index.values():
            if 'name' in char_data:
                all_names.append(char_data['name'])
        
        # Find words that might be misspelled names
        words = re.findall(r'\b[A-Z]\w+\b', text)  # Capitalized words
        
        for word in words:
            if word not in all_names:
                # Check similarity to known names
                for name in all_names:
                    similarity = difflib.SequenceMatcher(None, word.lower(), name.lower()).ratio()
                    if 0.8 < similarity < 1.0:  # Similar but not exact
                        inconsistencies.append(Inconsistency(
                            type='name_spelling',
                            text=word,
                            expected=name,
                            found=word,
                            reason=f"Possible misspelling of '{name}'",
                            severity='warning'
                        ))
        
        return inconsistencies
    
    def _check_contradictions(self, text: str) -> List[Inconsistency]:
        """Check for internal contradictions within the text"""
        inconsistencies = []
        
        sentences = text.split('.')
        
        # Look for contradicting statements
        for i, sent1 in enumerate(sentences):
            for j, sent2 in enumerate(sentences[i+1:], i+1):
                # Skip if too far apart (more than 10 sentences)
                if j - i > 10:
                    break
                
                # Simple contradiction patterns
                if self._sentences_contradict(sent1, sent2):
                    inconsistencies.append(Inconsistency(
                        type='internal_contradiction',
                        text=sent2.strip(),
                        expected=sent1.strip(),
                        found=sent2.strip(),
                        reason="Contradicts earlier statement",
                        severity='warning'
                    ))
        
        return inconsistencies
    
    def _sentences_contradict(self, sent1: str, sent2: str) -> bool:
        """Check if two sentences contradict each other"""
        # Simplified contradiction detection
        # In production, use NLP for semantic analysis
        
        sent1_lower = sent1.lower()
        sent2_lower = sent2.lower()
        
        # Pattern: X is Y vs X is not Y
        subject_patterns = [
            r'(\w+)\s+(?:é|está|foi)\s+(\w+)',
            r'(\w+)\s+(?:não|nunca)\s+(?:é|está|foi)\s+(\w+)'
        ]
        
        for pattern in subject_patterns:
            match1 = re.search(pattern, sent1_lower)
            match2 = re.search(pattern, sent2_lower)
            
            if match1 and match2:
                if match1.group(1) == match2.group(1):  # Same subject
                    # Check if one negates the other
                    if ('não' in sent1_lower) != ('não' in sent2_lower):
                        if match1.group(2) == match2.group(2):  # Same predicate
                            return True
        
        return False
    
    def get_character_info(self, character_name: str) -> Optional[Dict[str, Any]]:
        """Get character information for reference"""
        return self.character_index.get(character_name.lower())
    
    def get_location_info(self, location_name: str) -> Optional[Dict[str, Any]]:
        """Get location information for reference"""
        return self.location_index.get(location_name.lower())
    
    def get_timeline_events(self, chapter: int = None) -> List[Dict[str, Any]]:
        """Get timeline events, optionally filtered by chapter"""
        if chapter is None:
            return self.timeline_index
        return [e for e in self.timeline_index if e['chapter'] == chapter]
    
    def validate_new_fact(self, fact: str) -> List[str]:
        """Validate if a new fact contradicts existing facts"""
        warnings = []
        
        for existing_fact in self.fact_index:
            if self._facts_contradict(fact, existing_fact['fact']):
                warnings.append(
                    f"May contradict: '{existing_fact['fact']}' "
                    f"(from {existing_fact['source']})"
                )
        
        return warnings
    
    def _facts_contradict(self, fact1: str, fact2: str) -> bool:
        """Check if two facts potentially contradict"""
        # Simplified check - in production use semantic analysis
        
        # If facts share key terms but have opposite polarity
        key_terms1 = set(re.findall(r'\b\w{4,}\b', fact1.lower()))
        key_terms2 = set(re.findall(r'\b\w{4,}\b', fact2.lower()))
        
        shared_terms = key_terms1 & key_terms2
        
        if len(shared_terms) >= 2:  # Share at least 2 significant words
            # Check polarity
            neg1 = any(neg in fact1.lower() for neg in ['não', 'nunca', 'jamais'])
            neg2 = any(neg in fact2.lower() for neg in ['não', 'nunca', 'jamais'])
            
            if neg1 != neg2:  # Different polarity
                return True
        
        return False