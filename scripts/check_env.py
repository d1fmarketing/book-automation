#!/usr/bin/env python3
"""
Bootstrap environment check script
Confirms all required dependencies are available
"""
import sys
import os
import subprocess
from pathlib import Path

def check_python_version():
    """Check if Python version is >= 3.11"""
    version = sys.version_info
    if version.major < 3 or (version.major == 3 and version.minor < 11):
        print(f"❌ Python 3.11+ required, but found {version.major}.{version.minor}.{version.micro}")
        return False
    print(f"✅ Python {version.major}.{version.minor}.{version.micro} found")
    return True

def check_pandoc():
    """Check if pandoc is in PATH"""
    try:
        result = subprocess.run(['pandoc', '--version'], capture_output=True, text=True)
        if result.returncode == 0:
            print("✅ pandoc found in PATH")
            return True
    except FileNotFoundError:
        pass
    
    print("❌ pandoc not found in PATH")
    print("   Install with: brew install pandoc (macOS) or apt install pandoc (Linux)")
    return False

def check_ideogram_api_key():
    """Check if IDEOGRAM_API_KEY is set"""
    if os.environ.get('IDEOGRAM_API_KEY'):
        print("✅ IDEOGRAM_API_KEY is set")
        return True
    else:
        print("⚠️  IDEOGRAM_API_KEY not set (optional for image generation)")
        print("   Set with: export IDEOGRAM_API_KEY=your_key_here")
        return True  # Optional, so don't fail

def check_node():
    """Check if Node.js is installed"""
    try:
        result = subprocess.run(['node', '--version'], capture_output=True, text=True)
        if result.returncode == 0:
            print(f"✅ Node.js {result.stdout.strip()} found")
            return True
    except FileNotFoundError:
        pass
    
    print("❌ Node.js not found")
    print("   Install from: https://nodejs.org/")
    return False

def main():
    """Run all environment checks"""
    print("🔍 Checking environment for book-automation pipeline...\n")
    
    checks = [
        check_python_version(),
        check_pandoc(),
        check_node(),
        check_ideogram_api_key()
    ]
    
    if all(checks):
        print("\n✅ All checks passed! Environment is ready.")
        sys.exit(0)
    else:
        print("\n❌ Some checks failed. Please install missing dependencies.")
        sys.exit(1)

if __name__ == "__main__":
    main()