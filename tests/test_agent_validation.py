#!/usr/bin/env python3
"""
Validates that the Context Guardian agent setup is correct
"""
import os
import sys
from pathlib import Path

def validate_agent_setup():
    """Validate that all required files for the agent are present"""
    required_files = [
        "context/AGENT-DIRECTIVE.md",
        "context/story-bible.yaml",
        "context/CONTEXT.md",
        "context/WRITING-RULES.md",
        "scripts/continuity-check.py",
        "scripts/analyze-chapters.py",
        "scripts/generate-context.py",
        ".husky/pre-commit",
        "Makefile"
    ]
    
    missing_files = []
    for file_path in required_files:
        if not Path(file_path).exists():
            missing_files.append(file_path)
    
    if missing_files:
        print("❌ Missing required files for Context Guardian:")
        for file in missing_files:
            print(f"   - {file}")
        return False
    
    print("✅ All required Context Guardian files present")
    return True

def validate_git_hooks():
    """Check if git hooks are properly installed"""
    husky_dir = Path(".husky")
    if not husky_dir.exists():
        print("❌ Husky hooks not installed")
        return False
    
    pre_commit = husky_dir / "pre-commit"
    if not pre_commit.exists():
        print("❌ Pre-commit hook not found")
        return False
    
    # Check if hook is executable
    if not os.access(pre_commit, os.X_OK):
        print("❌ Pre-commit hook is not executable")
        return False
    
    print("✅ Git hooks properly configured")
    return True

def validate_context_tracking():
    """Check if context tracking is working"""
    context_dir = Path("context")
    
    # Check for session tracking
    session_file = context_dir / ".session"
    if session_file.exists():
        with open(session_file, 'r') as f:
            session_num = f.read().strip()
            print(f"✅ Context tracking active (Session #{session_num})")
    else:
        print("⚠️  No active session found - run 'make session-start'")
    
    return True

def validate_continuity_reports():
    """Check if continuity checking generates reports"""
    report_file = Path("context/continuity-report.json")
    if report_file.exists():
        import json
        with open(report_file, 'r') as f:
            report = json.load(f)
            errors = report.get('summary', {}).get('errors', 0)
            warnings = report.get('summary', {}).get('warnings', 0)
            print(f"✅ Continuity report found: {errors} errors, {warnings} warnings")
    else:
        print("ℹ️  No continuity report yet - run 'make check-continuity'")
    
    return True

def main():
    """Run all validation checks"""
    print("🔍 Validating Context Guardian Agent Setup\n")
    
    checks = [
        ("File Structure", validate_agent_setup),
        ("Git Hooks", validate_git_hooks),
        ("Context Tracking", validate_context_tracking),
        ("Continuity Reports", validate_continuity_reports)
    ]
    
    all_passed = True
    for check_name, check_func in checks:
        print(f"\n{check_name}:")
        try:
            if not check_func():
                all_passed = False
        except Exception as e:
            print(f"❌ Error in {check_name}: {e}")
            all_passed = False
    
    print("\n" + "="*50)
    if all_passed:
        print("✅ Context Guardian agent is properly configured!")
        print("\nNext steps:")
        print("1. Copy content from context/AGENT-DIRECTIVE.md as system prompt")
        print("2. Run 'make session-start' before writing")
        print("3. The agent will enforce continuity automatically")
        sys.exit(0)
    else:
        print("❌ Some checks failed. Please fix the issues above.")
        sys.exit(1)

if __name__ == "__main__":
    main()