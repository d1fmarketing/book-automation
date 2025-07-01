#!/usr/bin/env python3
"""
Grammar Integration for AI Writing Assistant
Provides Python interface to LanguageTool
"""

import requests
import json
import re
from typing import List, Dict, Any, Optional, Tuple
import logging

logger = logging.getLogger(__name__)


class GrammarIntegration:
    """Integrates LanguageTool grammar checking with the writing assistant"""
    
    def __init__(self, api_url: str = "http://localhost:8081/v2", language: str = "pt-BR"):
        self.api_url = api_url
        self.language = language
        self.session = requests.Session()
        self.custom_dictionary = []
        self.disabled_rules = [
            "WHITESPACE_RULE",
            "UPPERCASE_SENTENCE_START",
            "FRAGMENT_TWO_ARTICLES"
        ]
        
    def check_server(self) -> bool:
        """Check if LanguageTool server is available"""
        try:
            response = self.session.get(f"{self.api_url}/languages")
            languages = [lang["code"] for lang in response.json()]
            return self.language in languages
        except Exception as e:
            logger.error(f"LanguageTool server not available: {e}")
            return False
    
    def check_text(self, text: str, context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Check text for grammar and style issues"""
        if not text.strip():
            return {"matches": [], "stats": {}}
        
        # Remove markdown formatting for checking
        plain_text = self._markdown_to_plain_text(text)
        
        # Split text if too long (LanguageTool has a 20KB limit)
        chunks = self._split_text(plain_text, max_length=20000)
        all_matches = []
        
        for i, chunk in enumerate(chunks):
            offset = sum(len(c) for c in chunks[:i])
            
            try:
                params = {
                    "text": chunk,
                    "language": self.language,
                    "disabledRules": ",".join(self.disabled_rules),
                    "enabledCategories": "GRAMMAR,STYLE,PUNCTUATION",
                    "level": "picky"
                }
                
                response = self.session.post(
                    f"{self.api_url}/check",
                    data=params,
                    headers={"Content-Type": "application/x-www-form-urlencoded"}
                )
                
                if response.status_code == 200:
                    data = response.json()
                    # Adjust offsets for chunk position
                    for match in data.get("matches", []):
                        match["offset"] += offset
                        if not self._should_ignore_match(match, plain_text):
                            all_matches.append(match)
                            
            except Exception as e:
                logger.error(f"Grammar check failed: {e}")
        
        return {
            "matches": all_matches,
            "stats": self._calculate_stats(all_matches)
        }
    
    def _markdown_to_plain_text(self, markdown: str) -> str:
        """Convert markdown to plain text for grammar checking"""
        text = markdown
        
        # Remove code blocks
        text = re.sub(r'```[\s\S]*?```', '', text)
        text = re.sub(r'`[^`]+`', '', text)
        
        # Remove images
        text = re.sub(r'!\[[^\]]*\]\([^)]+\)', '', text)
        
        # Remove links but keep text
        text = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', text)
        
        # Remove emphasis markers
        text = re.sub(r'[*_]{1,2}([^*_]+)[*_]{1,2}', r'\1', text)
        
        # Remove headers
        text = re.sub(r'^#+\s+', '', text, flags=re.MULTILINE)
        
        # Remove horizontal rules
        text = re.sub(r'^-{3,}$', '', text, flags=re.MULTILINE)
        
        # Remove blockquotes
        text = re.sub(r'^>\s+', '', text, flags=re.MULTILINE)
        
        # Remove list markers
        text = re.sub(r'^[*+-]\s+', '', text, flags=re.MULTILINE)
        text = re.sub(r'^\d+\.\s+', '', text, flags=re.MULTILINE)
        
        return text.strip()
    
    def _split_text(self, text: str, max_length: int = 20000) -> List[str]:
        """Split text into chunks for processing"""
        if len(text) <= max_length:
            return [text]
        
        chunks = []
        sentences = re.split(r'(?<=[.!?])\s+', text)
        current_chunk = ""
        
        for sentence in sentences:
            if len(current_chunk) + len(sentence) > max_length:
                if current_chunk:
                    chunks.append(current_chunk.strip())
                current_chunk = sentence
            else:
                current_chunk += " " + sentence if current_chunk else sentence
        
        if current_chunk:
            chunks.append(current_chunk.strip())
        
        return chunks
    
    def _should_ignore_match(self, match: Dict[str, Any], text: str) -> bool:
        """Determine if a match should be ignored"""
        # Ignore if in custom dictionary
        matched_text = text[match["offset"]:match["offset"] + match["length"]]
        if matched_text.lower() in self.custom_dictionary:
            return True
        
        # Ignore specific false-positive prone rules
        ignored_rules = [
            "MORFOLOGIK_RULE_PT_BR",  # Often flags proper names
            "PT_AGREEMENT_REPLACE",    # Sometimes wrong for creative writing
        ]
        
        if match.get("rule", {}).get("id") in ignored_rules:
            return True
        
        # Ignore capitalized words that might be names
        if matched_text and matched_text[0].isupper() and match["rule"]["category"]["id"] == "TYPOS":
            return True
        
        return False
    
    def _calculate_stats(self, matches: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Calculate statistics from matches"""
        stats = {
            "total": len(matches),
            "by_category": {},
            "by_severity": {
                "error": 0,
                "warning": 0,
                "style": 0,
                "suggestion": 0
            }
        }
        
        for match in matches:
            # By category
            category = match["rule"]["category"]["name"]
            stats["by_category"][category] = stats["by_category"].get(category, 0) + 1
            
            # By severity
            category_id = match["rule"]["category"]["id"]
            if category_id in ["GRAMMAR", "TYPOS"]:
                stats["by_severity"]["error"] += 1
            elif category_id == "PUNCTUATION":
                stats["by_severity"]["warning"] += 1
            elif category_id == "STYLE":
                stats["by_severity"]["style"] += 1
            else:
                stats["by_severity"]["suggestion"] += 1
        
        return stats
    
    def get_suggestions(self, match: Dict[str, Any]) -> List[str]:
        """Get suggestions for a grammar match"""
        return [r["value"] for r in match.get("replacements", [])]
    
    def format_match_for_display(self, match: Dict[str, Any]) -> Dict[str, Any]:
        """Format a match for display in the UI"""
        return {
            "type": self._get_match_type(match),
            "message": match["message"],
            "offset": match["offset"],
            "length": match["length"],
            "suggestions": self.get_suggestions(match),
            "rule_id": match["rule"]["id"],
            "category": match["rule"]["category"]["name"],
            "context": {
                "text": match["context"]["text"],
                "offset": match["context"]["offset"],
                "length": match["context"]["length"]
            }
        }
    
    def _get_match_type(self, match: Dict[str, Any]) -> str:
        """Get the type/severity of a match"""
        category_id = match["rule"]["category"]["id"]
        if category_id in ["GRAMMAR", "TYPOS"]:
            return "error"
        elif category_id == "PUNCTUATION":
            return "warning"
        elif category_id == "STYLE":
            return "style"
        else:
            return "info"
    
    def add_to_dictionary(self, words: List[str]):
        """Add words to custom dictionary"""
        self.custom_dictionary.extend([w.lower() for w in words])
    
    def set_disabled_rules(self, rules: List[str]):
        """Set rules to disable"""
        self.disabled_rules = rules
    
    def auto_fix_simple_issues(self, text: str) -> Tuple[str, int]:
        """Auto-fix simple, unambiguous grammar issues"""
        result = self.check_text(text)
        if not result["matches"]:
            return text, 0
        
        # Sort matches by offset (descending) to avoid position shifts
        matches = sorted(result["matches"], key=lambda m: m["offset"], reverse=True)
        
        fixed_text = text
        fixed_count = 0
        
        auto_fixable_rules = [
            "REPEATED_WORDS",           # Double words
            "COMMA_PARENTHESIS_WHITESPACE",  # Space after comma
            "DOUBLE_PUNCTUATION",       # Double punctuation
            "UNPAIRED_BRACKETS",        # Unpaired brackets
        ]
        
        for match in matches:
            if (match["rule"]["id"] in auto_fixable_rules and 
                len(match.get("replacements", [])) == 1):
                
                replacement = match["replacements"][0]["value"]
                start = match["offset"]
                end = start + match["length"]
                
                # Apply fix
                fixed_text = fixed_text[:start] + replacement + fixed_text[end:]
                fixed_count += 1
        
        return fixed_text, fixed_count
    
    def check_readability(self, text: str) -> Dict[str, Any]:
        """Calculate readability metrics"""
        sentences = re.split(r'[.!?]+', text)
        words = text.split()
        
        if not sentences or not words:
            return {"error": "Text too short for analysis"}
        
        # Basic readability metrics
        avg_sentence_length = len(words) / len(sentences)
        
        # Complex word count (3+ syllables, simplified)
        complex_words = sum(1 for word in words if len(word) > 8)
        
        # Fog Index approximation
        fog_index = 0.4 * (avg_sentence_length + (complex_words / len(words) * 100))
        
        return {
            "sentence_count": len(sentences),
            "word_count": len(words),
            "avg_sentence_length": round(avg_sentence_length, 1),
            "complex_word_percentage": round(complex_words / len(words) * 100, 1),
            "fog_index": round(fog_index, 1),
            "readability_level": self._get_readability_level(fog_index)
        }
    
    def _get_readability_level(self, fog_index: float) -> str:
        """Get readability level from Fog Index"""
        if fog_index < 8:
            return "Very Easy"
        elif fog_index < 10:
            return "Easy"
        elif fog_index < 12:
            return "Standard"
        elif fog_index < 14:
            return "Fairly Difficult"
        elif fog_index < 16:
            return "Difficult"
        else:
            return "Very Difficult"