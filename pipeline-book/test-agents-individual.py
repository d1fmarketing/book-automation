#!/usr/bin/env python3
"""
Test each agent individually
"""

import asyncio
import sys
import os

# Add parent directory to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from ebook_pipeline.agents.content_agent import ContentAgent
from ebook_pipeline.agents.format_agent import FormatAgent
from ebook_pipeline.agents.quality_agent import QualityAgent
from ebook_pipeline.agents.monitor_agent import MonitorAgent
from ebook_pipeline.agents.publish_agent import PublishAgent


async def test_content_agent():
    """Test Content Agent"""
    print("\n" + "="*50)
    print("Testing Content Agent")
    print("="*50)
    
    agent = ContentAgent(".")
    await agent.initialize()
    
    # Test loading metadata
    metadata = await agent.load_metadata()
    print(f"✅ Loaded metadata: {metadata.get('title')}")
    
    # Test loading chapters
    chapters = await agent.load_chapters()
    print(f"✅ Loaded {len(chapters)} chapters")
    
    for ch in chapters[:2]:  # Show first 2
        print(f"   - Chapter {ch.number}: {ch.title} ({ch.word_count} words)")
        
    return True


async def test_monitor_agent():
    """Test Monitor Agent"""
    print("\n" + "="*50)
    print("Testing Monitor Agent")
    print("="*50)
    
    agent = MonitorAgent(".")
    await agent.initialize()
    
    # Start a test pipeline
    pipeline_id = await agent.start_pipeline("test-project")
    print(f"✅ Started pipeline: {pipeline_id}")
    
    # Update some statuses
    await agent.update_agent_status("content", "running")
    await agent.update_agent_status("content", "completed", {"chapters": 5})
    
    # Get dashboard data
    dashboard = await agent.get_dashboard_data()
    print(f"✅ Dashboard data retrieved")
    print(f"   - Current pipeline: {dashboard['current_pipeline']['pipeline_id']}")
    print(f"   - Progress: {dashboard['current_pipeline']['progress_percent']}%")
    
    await agent.complete_pipeline()
    
    return True


async def test_format_agent():
    """Test Format Agent basic functionality"""
    print("\n" + "="*50)
    print("Testing Format Agent")
    print("="*50)
    
    agent = FormatAgent(".")
    await agent.initialize()
    
    # Test CSS generation
    css = agent._generate_css()
    print(f"✅ Generated CSS ({len(css)} characters)")
    print(f"   - Has page setup: {'@page' in css}")
    print(f"   - Has drop caps: {'first-letter' in css}")
    print(f"   - Ultra-thin: {'font-weight: 100' in css}")
    
    return True


async def test_quality_agent():
    """Test Quality Agent basic functionality"""
    print("\n" + "="*50)
    print("Testing Quality Agent")
    print("="*50)
    
    agent = QualityAgent(".")
    await agent.initialize()
    
    # Test thresholds
    print(f"✅ Quality thresholds configured:")
    print(f"   - Min pages: {agent.quality_thresholds['min_pages']}")
    print(f"   - Max pages: {agent.quality_thresholds['max_pages']}")
    print(f"   - Cover min size: {agent.quality_thresholds['cover_min_size_kb']} KB")
    
    return True


async def test_publish_agent():
    """Test Publish Agent basic functionality"""
    print("\n" + "="*50)
    print("Testing Publish Agent")
    print("="*50)
    
    agent = PublishAgent(".")
    await agent.initialize()
    
    # Test metadata loading
    metadata = await agent.load_metadata()
    print(f"✅ Loaded publishing metadata:")
    print(f"   - Title: {metadata.title}")
    print(f"   - Author: {metadata.author}")
    print(f"   - Categories: {', '.join(metadata.categories)}")
    
    # Test available platforms
    print(f"✅ Available platforms: {', '.join(agent.platforms.keys())}")
    
    return True


async def main():
    """Run all tests"""
    print("🧪 Testing Individual Agents\n")
    
    tests = [
        test_content_agent,
        test_monitor_agent,
        test_format_agent,
        test_quality_agent,
        test_publish_agent
    ]
    
    results = []
    for test in tests:
        try:
            result = await test()
            results.append(result)
        except Exception as e:
            print(f"❌ Test failed: {e}")
            results.append(False)
            
    # Summary
    print("\n" + "="*50)
    print("Test Summary")
    print("="*50)
    
    passed = sum(results)
    total = len(results)
    
    print(f"✅ Passed: {passed}/{total}")
    
    if passed == total:
        print("\n🎉 All agents are working correctly!")
    else:
        print("\n⚠️  Some tests failed. Check the output above.")
        

if __name__ == "__main__":
    asyncio.run(main())