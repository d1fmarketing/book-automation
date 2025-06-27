#!/usr/bin/env python3
"""
Run OmniCreator-X Pipeline
"""
import os
import sys

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from agents.omnicreator import main

if __name__ == "__main__":
    main()