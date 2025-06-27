#!/usr/bin/env python3
"""
Smoke tests for continuity checking system
"""
import os
import sys
import json
import tempfile
import shutil
from pathlib import Path
import subprocess

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

def create_test_chapter(directory, filename, content):
    """Create a test chapter file"""
    filepath = Path(directory) / filename
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    return filepath

def run_continuity_check(chapters_dir):
    """Run continuity check and return exit code"""
    # Save current directory
    original_dir = os.getcwd()
    
    try:
        # Change to chapters directory parent
        os.chdir(chapters_dir.parent)
        
        # Run the continuity check
        result = subprocess.run(
            [sys.executable, 'scripts/continuity-check.py'],
            capture_output=True,
            text=True
        )
        
        return result.returncode, result.stdout, result.stderr
        
    finally:
        os.chdir(original_dir)

def test_good_continuity():
    """Test that good content returns exit code 0"""
    with tempfile.TemporaryDirectory() as tmpdir:
        tmppath = Path(tmpdir)
        chapters_dir = tmppath / "chapters"
        chapters_dir.mkdir()
        
        # Create context directory for report
        context_dir = tmppath / "context"
        context_dir.mkdir()
        
        # Create scripts directory and copy script
        scripts_dir = tmppath / "scripts"
        scripts_dir.mkdir()
        shutil.copy('scripts/continuity-check.py', scripts_dir)
        
        # Create consistent chapters
        create_test_chapter(chapters_dir, "chapter-01.md", """---
chap: 01
title: "Introduction"
---
# Chapter 1

Alice has blue eyes and brown hair.
She lives in the small town.""")
        
        create_test_chapter(chapters_dir, "chapter-02.md", """---
chap: 02
title: "Development"
---
# Chapter 2

Alice's blue eyes sparkled. Her brown hair flowed.
The small town was quiet.""")
        
        exit_code, stdout, stderr = run_continuity_check(chapters_dir)
        
        assert exit_code == 0, f"Expected exit code 0, got {exit_code}. Stderr: {stderr}"
        print("✓ Good continuity test passed")

def test_character_inconsistency():
    """Test that character inconsistency returns exit code 1"""
    with tempfile.TemporaryDirectory() as tmpdir:
        tmppath = Path(tmpdir)
        chapters_dir = tmppath / "chapters"
        chapters_dir.mkdir()
        
        # Create context directory
        context_dir = tmppath / "context"
        context_dir.mkdir()
        
        # Create scripts directory
        scripts_dir = tmppath / "scripts"
        scripts_dir.mkdir()
        shutil.copy('scripts/continuity-check.py', scripts_dir)
        
        # Create inconsistent chapters
        create_test_chapter(chapters_dir, "chapter-01.md", """---
chap: 01
title: "Introduction"
---
# Chapter 1

Alice's eyes were blue like the ocean.""")
        
        create_test_chapter(chapters_dir, "chapter-02.md", """---
chap: 02
title: "Contradiction"
---
# Chapter 2

Alice's eyes were green as emeralds.""")
        
        exit_code, stdout, stderr = run_continuity_check(chapters_dir)
        
        assert exit_code == 1, f"Expected exit code 1, got {exit_code}"
        
        print("✓ Character inconsistency test passed")

def test_empty_chapters():
    """Test handling of empty chapters directory"""
    with tempfile.TemporaryDirectory() as tmpdir:
        tmppath = Path(tmpdir)
        chapters_dir = tmppath / "chapters"
        chapters_dir.mkdir()
        
        # Create context directory
        context_dir = tmppath / "context"
        context_dir.mkdir()
        
        # Create scripts directory
        scripts_dir = tmppath / "scripts"
        scripts_dir.mkdir()
        shutil.copy('scripts/continuity-check.py', scripts_dir)
        
        exit_code, stdout, stderr = run_continuity_check(chapters_dir)
        
        # Should pass with no chapters
        assert exit_code == 0, f"Expected exit code 0 for empty chapters, got {exit_code}"
        print("✓ Empty chapters test passed")

def test_missing_frontmatter():
    """Test handling of chapters without frontmatter"""
    with tempfile.TemporaryDirectory() as tmpdir:
        tmppath = Path(tmpdir)
        chapters_dir = tmppath / "chapters"
        chapters_dir.mkdir()
        
        # Create context directory
        context_dir = tmppath / "context"
        context_dir.mkdir()
        
        # Create scripts directory
        scripts_dir = tmppath / "scripts"
        scripts_dir.mkdir()
        shutil.copy('scripts/continuity-check.py', scripts_dir)
        
        # Create chapter without frontmatter
        create_test_chapter(chapters_dir, "chapter-01.md", """# Chapter 1

This chapter has no frontmatter.
Alice appears here.""")
        
        exit_code, stdout, stderr = run_continuity_check(chapters_dir)
        
        # Should handle gracefully
        assert exit_code in [0, 1], f"Script crashed with exit code {exit_code}. Stderr: {stderr}"
        print("✓ Missing frontmatter test passed")

def main():
    """Run all tests"""
    print("Running continuity check smoke tests...\n")
    
    tests = [
        test_good_continuity,
        test_character_inconsistency,
        test_empty_chapters,
        test_missing_frontmatter
    ]
    
    failed = 0
    for test in tests:
        try:
            test()
        except AssertionError as e:
            print(f"✗ {test.__name__} failed: {e}")
            failed += 1
        except Exception as e:
            print(f"✗ {test.__name__} error: {e}")
            failed += 1
    
    print(f"\n{len(tests) - failed}/{len(tests)} tests passed")
    
    if failed > 0:
        sys.exit(1)
    else:
        print("\n✅ All smoke tests passed!")
        sys.exit(0)

if __name__ == "__main__":
    main()