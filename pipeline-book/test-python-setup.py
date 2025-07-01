#!/usr/bin/env python3
"""
Test Python setup for the pipeline
"""

import sys
import os

# Add parent directory to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

print("🔍 Testing Python environment for pipeline...")
print(f"Python version: {sys.version}")
print(f"Python path: {sys.executable}")

# Test imports
try:
    print("\n📦 Testing agent imports...")
    
    from ebook_pipeline.agents.content_agent import ContentAgent
    print("✅ Content Agent imported")
    
    from ebook_pipeline.agents.format_agent import FormatAgent
    print("✅ Format Agent imported")
    
    from ebook_pipeline.agents.quality_agent import QualityAgent
    print("✅ Quality Agent imported")
    
    from ebook_pipeline.agents.monitor_agent import MonitorAgent
    print("✅ Monitor Agent imported")
    
    from ebook_pipeline.agents.publish_agent import PublishAgent
    print("✅ Publish Agent imported")
    
    from ebook_pipeline.orchestrator.websocket_manager import WebSocketManager
    print("✅ WebSocket Manager imported")
    
    from ebook_pipeline.pipeline_controller import PipelineController
    print("✅ Pipeline Controller imported")
    
    print("\n🎉 All imports successful! Environment is ready.")
    
    # Check for required directories
    print("\n📁 Checking project structure...")
    dirs_to_check = ['chapters', 'assets/images', 'scripts/generation', 'scripts/quality']
    
    for dir_path in dirs_to_check:
        full_path = os.path.join(os.path.dirname(__file__), dir_path)
        if os.path.exists(full_path):
            print(f"✅ {dir_path} exists")
        else:
            print(f"❌ {dir_path} missing")
            
    # Check for metadata.yaml
    metadata_path = os.path.join(os.path.dirname(__file__), 'metadata.yaml')
    if os.path.exists(metadata_path):
        print("✅ metadata.yaml exists")
    else:
        print("❌ metadata.yaml missing")
        
except ImportError as e:
    print(f"\n❌ Import error: {e}")
    print("\n💡 Make sure you're running from the correct directory")
    sys.exit(1)
except Exception as e:
    print(f"\n❌ Error: {e}")
    sys.exit(1)