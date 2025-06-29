#!/usr/bin/env python3
"""
Wrapper script for image generation
Calls the actual generate_images module from the ebook_pipeline
"""
import sys
import os

# Add the src directory to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

# Import and run the actual module
from src.ebook_pipeline.generators.generate_images import main

if __name__ == "__main__":
    main()