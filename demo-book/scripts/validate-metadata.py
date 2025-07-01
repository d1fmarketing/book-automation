#!/usr/bin/env python3
"""
Validate metadata.yaml for book automation pipeline
Ensures all required fields are present and properly formatted
"""

import os
import sys
import yaml
from typing import Dict, List, Tuple, Optional
from pathlib import Path


class MetadataValidator:
    """Validates book metadata configuration"""
    
    REQUIRED_FIELDS = {
        'book': {
            'title': str,
            'author': str,
            'isbn': (str, type(None)),  # Optional
            'publisher': (str, type(None)),
            'publication_date': (str, type(None)),
            'language': str,
            'genre': str,
            'description': str,
            'keywords': list
        },
        'pdf': {
            'page_size': str,
            'margins': dict,
            'font_family': str,
            'font_size': (int, float),
            'line_height': (int, float),
            'include_toc': bool,
            'include_page_numbers': bool,
            'chapter_starts_new_page': bool
        },
        'epub': {
            'cover_image': str,
            'stylesheet': str,
            'include_toc': bool,
            'chapter_split': bool
        },
        'build': {
            'output_dir': str,
            'temp_dir': str,
            'filename_base': str
        }
    }
    
    VALID_PAGE_SIZES = ['A4', 'A5', 'Letter', '6x9', '5x8', '8.5x11']
    VALID_LANGUAGES = ['en', 'pt', 'es', 'fr', 'de', 'it']
    
    def __init__(self, metadata_path: str = 'metadata.yaml'):
        self.metadata_path = Path(metadata_path)
        self.errors: List[str] = []
        self.warnings: List[str] = []
        self.metadata: Optional[Dict] = None
    
    def validate(self) -> Tuple[bool, List[str], List[str]]:
        """
        Validate metadata file
        Returns: (is_valid, errors, warnings)
        """
        # Check file exists
        if not self.metadata_path.exists():
            self.errors.append(f"Metadata file not found: {self.metadata_path}")
            return False, self.errors, self.warnings
        
        # Load YAML
        try:
            with open(self.metadata_path, 'r', encoding='utf-8') as f:
                self.metadata = yaml.safe_load(f)
        except yaml.YAMLError as e:
            self.errors.append(f"Invalid YAML format: {e}")
            return False, self.errors, self.warnings
        except Exception as e:
            self.errors.append(f"Error reading metadata file: {e}")
            return False, self.errors, self.warnings
        
        # Validate structure
        self._validate_structure()
        
        # Validate specific fields
        self._validate_book_section()
        self._validate_pdf_section()
        self._validate_epub_section()
        self._validate_build_section()
        
        # Check environment variables
        self._check_environment()
        
        return len(self.errors) == 0, self.errors, self.warnings
    
    def _validate_structure(self):
        """Validate overall structure and required sections"""
        if not isinstance(self.metadata, dict):
            self.errors.append("Metadata must be a dictionary")
            return
        
        # Check required top-level sections
        for section in ['book', 'pdf', 'epub', 'build']:
            if section not in self.metadata:
                self.errors.append(f"Missing required section: {section}")
            elif not isinstance(self.metadata[section], dict):
                self.errors.append(f"Section '{section}' must be a dictionary")
    
    def _validate_book_section(self):
        """Validate book metadata"""
        if 'book' not in self.metadata:
            return
        
        book = self.metadata['book']
        
        # Check required fields
        for field, expected_type in self.REQUIRED_FIELDS['book'].items():
            if field not in book:
                self.errors.append(f"Missing required field: book.{field}")
            else:
                self._check_type(f"book.{field}", book[field], expected_type)
        
        # Validate specific fields
        if 'language' in book and book['language'] not in self.VALID_LANGUAGES:
            self.warnings.append(
                f"Unusual language code: {book['language']}. "
                f"Common codes: {', '.join(self.VALID_LANGUAGES)}"
            )
        
        if 'isbn' in book and book['isbn']:
            self._validate_isbn(book['isbn'])
        
        if 'keywords' in book and isinstance(book['keywords'], list):
            if len(book['keywords']) < 3:
                self.warnings.append("Consider adding more keywords for better discoverability")
            if len(book['keywords']) > 10:
                self.warnings.append("Too many keywords may dilute effectiveness")
    
    def _validate_pdf_section(self):
        """Validate PDF settings"""
        if 'pdf' not in self.metadata:
            return
        
        pdf = self.metadata['pdf']
        
        # Check required fields
        for field, expected_type in self.REQUIRED_FIELDS['pdf'].items():
            if field not in pdf:
                self.errors.append(f"Missing required field: pdf.{field}")
            else:
                self._check_type(f"pdf.{field}", pdf[field], expected_type)
        
        # Validate page size
        if 'page_size' in pdf and pdf['page_size'] not in self.VALID_PAGE_SIZES:
            self.errors.append(
                f"Invalid page size: {pdf['page_size']}. "
                f"Valid sizes: {', '.join(self.VALID_PAGE_SIZES)}"
            )
        
        # Validate margins
        if 'margins' in pdf and isinstance(pdf['margins'], dict):
            required_margins = ['top', 'bottom', 'left', 'right']
            for margin in required_margins:
                if margin not in pdf['margins']:
                    self.errors.append(f"Missing margin: pdf.margins.{margin}")
                elif not isinstance(pdf['margins'][margin], str):
                    self.errors.append(f"Margin must be a string with units: pdf.margins.{margin}")
                elif not any(pdf['margins'][margin].endswith(unit) for unit in ['in', 'mm', 'cm', 'pt']):
                    self.errors.append(f"Margin must include units (in/mm/cm/pt): pdf.margins.{margin}")
        
        # Validate font settings
        if 'font_size' in pdf:
            if not 8 <= pdf['font_size'] <= 24:
                self.warnings.append(f"Unusual font size: {pdf['font_size']}pt. Typical range: 10-14pt")
        
        if 'line_height' in pdf:
            if not 1.0 <= pdf['line_height'] <= 2.0:
                self.warnings.append(f"Unusual line height: {pdf['line_height']}. Typical range: 1.2-1.6")
    
    def _validate_epub_section(self):
        """Validate EPUB settings"""
        if 'epub' not in self.metadata:
            return
        
        epub = self.metadata['epub']
        
        # Check required fields
        for field, expected_type in self.REQUIRED_FIELDS['epub'].items():
            if field not in epub:
                self.errors.append(f"Missing required field: epub.{field}")
            else:
                self._check_type(f"epub.{field}", epub[field], expected_type)
        
        # Check referenced files exist
        if 'cover_image' in epub:
            cover_path = Path(epub['cover_image'])
            if not cover_path.exists():
                self.errors.append(f"Cover image not found: {epub['cover_image']}")
            elif cover_path.stat().st_size > 5 * 1024 * 1024:  # 5MB
                self.warnings.append("Cover image is larger than 5MB. Consider optimizing.")
        
        if 'stylesheet' in epub:
            css_path = Path(epub['stylesheet'])
            if not css_path.exists():
                self.errors.append(f"Stylesheet not found: {epub['stylesheet']}")
    
    def _validate_build_section(self):
        """Validate build settings"""
        if 'build' not in self.metadata:
            return
        
        build = self.metadata['build']
        
        # Check required fields
        for field, expected_type in self.REQUIRED_FIELDS['build'].items():
            if field not in build:
                self.errors.append(f"Missing required field: build.{field}")
            else:
                self._check_type(f"build.{field}", build[field], expected_type)
        
        # Check directories are writable
        for dir_field in ['output_dir', 'temp_dir']:
            if dir_field in build:
                dir_path = Path(build[dir_field])
                try:
                    dir_path.mkdir(parents=True, exist_ok=True)
                    # Test write permissions
                    test_file = dir_path / '.write_test'
                    test_file.touch()
                    test_file.unlink()
                except Exception as e:
                    self.errors.append(f"Cannot write to {dir_field}: {build[dir_field]} - {e}")
    
    def _validate_isbn(self, isbn: str):
        """Validate ISBN format"""
        # Remove hyphens and spaces
        isbn_clean = isbn.replace('-', '').replace(' ', '')
        
        if len(isbn_clean) == 10:
            # ISBN-10 validation
            if not isbn_clean[:-1].isdigit():
                self.errors.append("ISBN-10 must contain only digits (except last character)")
        elif len(isbn_clean) == 13:
            # ISBN-13 validation
            if not isbn_clean.isdigit():
                self.errors.append("ISBN-13 must contain only digits")
            if not isbn_clean.startswith(('978', '979')):
                self.warnings.append("ISBN-13 typically starts with 978 or 979")
        else:
            self.errors.append("ISBN must be 10 or 13 digits long")
    
    def _check_type(self, field_path: str, value, expected_type):
        """Check if value matches expected type"""
        if isinstance(expected_type, tuple):
            # Multiple allowed types
            if not any(isinstance(value, t) for t in expected_type):
                self.errors.append(
                    f"Field '{field_path}' has wrong type. "
                    f"Expected one of {expected_type}, got {type(value).__name__}"
                )
        else:
            if not isinstance(value, expected_type):
                self.errors.append(
                    f"Field '{field_path}' has wrong type. "
                    f"Expected {expected_type.__name__}, got {type(value).__name__}"
                )
    
    def _check_environment(self):
        """Check required environment variables"""
        # Check from workflow rules
        required_env = ['AGENT_CLI_TEXT_MODEL']
        
        for env_var in required_env:
            if not os.environ.get(env_var):
                self.warnings.append(f"Environment variable not set: {env_var}")
    
    def print_report(self):
        """Print validation report"""
        print("=== Metadata Validation Report ===\n")
        
        if self.errors:
            print(f"❌ Found {len(self.errors)} error(s):")
            for error in self.errors:
                print(f"  • {error}")
            print()
        
        if self.warnings:
            print(f"⚠️  Found {len(self.warnings)} warning(s):")
            for warning in self.warnings:
                print(f"  • {warning}")
            print()
        
        if not self.errors and not self.warnings:
            print("✅ Metadata validation passed!")
        
        return len(self.errors) == 0


def main():
    """Main entry point"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Validate book metadata')
    parser.add_argument(
        'metadata_file',
        nargs='?',
        default='metadata.yaml',
        help='Path to metadata.yaml file (default: metadata.yaml)'
    )
    parser.add_argument(
        '--quiet', '-q',
        action='store_true',
        help='Only show errors, not warnings'
    )
    parser.add_argument(
        '--json',
        action='store_true',
        help='Output as JSON'
    )
    
    args = parser.parse_args()
    
    validator = MetadataValidator(args.metadata_file)
    is_valid, errors, warnings = validator.validate()
    
    if args.json:
        import json
        result = {
            'valid': is_valid,
            'errors': errors,
            'warnings': warnings if not args.quiet else []
        }
        print(json.dumps(result, indent=2))
    else:
        if args.quiet:
            validator.warnings = []
        validator.print_report()
    
    sys.exit(0 if is_valid else 1)


if __name__ == '__main__':
    main()