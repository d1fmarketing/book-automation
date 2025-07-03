#!/usr/bin/env python3
"""
Premium Pipeline Controller: Enhanced orchestrator with visual enhancements
Uses the premium format agent for professional output
"""

import asyncio
import logging
import sys
from pathlib import Path
from typing import Dict, List, Any, Optional
from datetime import datetime
import json

# Import all agents (use premium format agent)
from .agents.content_agent import ContentAgent
from .agents.format_agent_premium import PremiumFormatAgent, PremiumFormatConfig
from .agents.quality_agent import QualityAgent
from .agents.monitor_agent import MonitorAgent
from .agents.publish_agent import PublishAgent

# Import orchestrator
from .orchestrator.websocket_manager import WebSocketManager

logger = logging.getLogger('PremiumPipelineController')


class PremiumPipelineController:
    """
    Enhanced pipeline controller with premium visual features
    Orchestrates all 5 agents with professional output quality
    """
    
    def __init__(self, project_path: str = ".", enable_websocket: bool = True):
        self.project_path = Path(project_path)
        
        # WebSocket manager for inter-agent communication
        self.websocket_manager = None
        if enable_websocket:
            self.websocket_manager = WebSocketManager()
            
        # Initialize all agents (using premium format agent)
        self.content_agent = ContentAgent(project_path, self.websocket_manager)
        self.format_agent = PremiumFormatAgent(project_path, self.websocket_manager)
        self.quality_agent = QualityAgent(project_path, self.websocket_manager)
        self.monitor_agent = MonitorAgent(project_path, self.websocket_manager)
        self.publish_agent = PublishAgent(project_path, self.websocket_manager)
        
        # Pipeline state
        self.pipeline_state = {
            "status": "idle",
            "current_stage": "",
            "start_time": None,
            "end_time": None,
            "results": {},
            "premium_features": True
        }
        
        # Premium configuration
        self.config = {
            "auto_fix": True,
            "max_quality_attempts": 3,
            "publish_platforms": ["local"],
            "format_config": PremiumFormatConfig(
                enable_callout_boxes=True,
                enable_syntax_highlighting=True,
                enable_headers_footers=True,
                enable_drop_caps=True,
                enable_gradients=True
            )
        }
        
    async def initialize(self):
        """Initialize the pipeline and all agents"""
        logger.info("🎨 Initializing Premium Pipeline Controller...")
        
        # Start WebSocket server if enabled
        if self.websocket_manager:
            await self.websocket_manager.start_server()
            await asyncio.sleep(1)  # Give server time to start
            
        # Initialize all agents
        await self.monitor_agent.initialize()
        await self.content_agent.initialize()
        await self.format_agent.initialize()
        await self.quality_agent.initialize()
        await self.publish_agent.initialize()
        
        logger.info("✅ Premium Pipeline Controller initialized successfully")
        
    async def shutdown(self):
        """Shutdown the pipeline gracefully"""
        logger.info("Shutting down Premium Pipeline Controller...")
        
        if self.websocket_manager:
            await self.websocket_manager.stop_server()
            
        logger.info("Pipeline Controller shutdown complete")
        
    async def run_pipeline(self, project_name: Optional[str] = None, 
                          publish_platforms: Optional[List[str]] = None,
                          use_enhanced_content: bool = True) -> Dict[str, Any]:
        """
        Run the complete premium pipeline with visual enhancements
        """
        
        # Start pipeline monitoring
        monitor_task = asyncio.create_task(
            self.monitor_agent.monitor_pipeline()
        )
        
        # Update pipeline state
        self.pipeline_state["status"] = "running"
        self.pipeline_state["start_time"] = datetime.now()
        
        try:
            # Stage 1: Content Generation with Enhancements
            logger.info("📚 Stage 1: Content Processing (Enhanced)")
            self.pipeline_state["current_stage"] = "content"
            
            # Process enhanced content if available
            if use_enhanced_content:
                await self._use_enhanced_chapters()
            
            content_result = await self.content_agent.process_book(project_name)
            self.pipeline_state["results"]["content"] = content_result
            
            if not content_result.get("success"):
                raise Exception("Content processing failed")
                
            html_path = content_result.get("html_path")
            logger.info(f"✅ Content processed: {html_path}")
            
            # Stage 2: Premium PDF Formatting
            logger.info("🎨 Stage 2: Premium PDF Formatting")
            self.pipeline_state["current_stage"] = "format"
            
            format_result = await self.format_agent.format_pdf(
                html_path,
                config=self.config["format_config"]
            )
            self.pipeline_state["results"]["format"] = format_result
            
            if not format_result.get("success"):
                raise Exception("PDF formatting failed")
                
            pdf_path = format_result.get("pdf_path")
            logger.info(f"✅ Premium PDF generated: {pdf_path}")
            
            # Stage 3: Quality Assurance Loop
            logger.info("🔍 Stage 3: Quality Assurance")
            self.pipeline_state["current_stage"] = "quality"
            
            quality_attempts = 0
            quality_passed = False
            
            while quality_attempts < self.config["max_quality_attempts"] and not quality_passed:
                quality_attempts += 1
                logger.info(f"Quality check attempt {quality_attempts}")
                
                quality_report = await self.quality_agent.quality_loop(
                    pdf_path,
                    fix_callback=self._quality_fix_callback if self.config["auto_fix"] else None
                )
                
                self.pipeline_state["results"]["quality"] = quality_report
                quality_passed = quality_report.passed
                
                if not quality_passed and self.config["auto_fix"]:
                    # Apply fixes and regenerate
                    logger.info("Applying quality fixes...")
                    fix_result = await self.format_agent.apply_quality_fixes(quality_report)
                    if fix_result.get("pdf_path"):
                        pdf_path = fix_result["pdf_path"]
                        
            if not quality_passed:
                logger.warning("Quality checks did not pass after maximum attempts")
                
            # Stage 4: Publishing
            logger.info("📤 Stage 4: Publishing")
            self.pipeline_state["current_stage"] = "publish"
            
            platforms = publish_platforms or self.config["publish_platforms"]
            
            publish_result = await self.publish_agent.publish_book(
                pdf_path,
                platforms=platforms
            )
            self.pipeline_state["results"]["publish"] = publish_result
            
            # Complete pipeline
            self.pipeline_state["status"] = "completed"
            self.pipeline_state["end_time"] = datetime.now()
            
            # Calculate total time
            total_time = (self.pipeline_state["end_time"] - 
                         self.pipeline_state["start_time"]).total_seconds()
            
            # Final results
            final_results = {
                "success": True,
                "total_time": total_time,
                "pdf_path": pdf_path,
                "quality_passed": quality_passed,
                "quality_attempts": quality_attempts,
                "published_to": platforms,
                "premium_features": {
                    "callout_boxes": True,
                    "syntax_highlighting": True,
                    "professional_typography": True,
                    "headers_footers": True,
                    "gradients": True
                },
                "stages": self.pipeline_state["results"]
            }
            
            logger.info(f"✅ Premium Pipeline completed in {total_time:.2f} seconds!")
            logger.info(f"📍 Final PDF: {pdf_path}")
            
            return final_results
            
        except Exception as e:
            logger.error(f"Pipeline failed: {str(e)}")
            self.pipeline_state["status"] = "failed"
            self.pipeline_state["error"] = str(e)
            raise
            
        finally:
            # Stop monitoring
            monitor_task.cancel()
            
    async def _use_enhanced_chapters(self):
        """Use enhanced chapters if available"""
        chapters_dir = self.project_path / "pipeline-book" / "chapters"
        
        # Check for enhanced versions
        for chapter_file in chapters_dir.glob("chapter-*-enhanced.md"):
            original_name = chapter_file.name.replace("-enhanced", "")
            original_path = chapters_dir / original_name
            
            # Back up original
            if original_path.exists():
                backup_path = chapters_dir / f"{original_name}.backup"
                original_path.rename(backup_path)
                
            # Use enhanced version
            chapter_file.rename(original_path)
            logger.info(f"Using enhanced version of {original_name}")
            
    async def _quality_fix_callback(self, quality_report: Dict[str, Any]):
        """Callback for quality fixes"""
        logger.info("Quality fix callback triggered")
        # The format agent will handle the actual fixes
        pass


async def main():
    """Run the premium pipeline from command line"""
    import argparse
    
    parser = argparse.ArgumentParser(description="Premium Ebook Pipeline with Visual Enhancements")
    parser.add_argument("project", nargs="?", default="pipeline-book", 
                       help="Project name or path")
    parser.add_argument("--publish", nargs="*", 
                       default=["local"],
                       help="Publishing platforms")
    parser.add_argument("--no-websocket", action="store_true",
                       help="Disable WebSocket server")
    
    args = parser.parse_args()
    
    # Setup logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    # Create and run pipeline
    controller = PremiumPipelineController(
        project_path=args.project,
        enable_websocket=not args.no_websocket
    )
    
    try:
        await controller.initialize()
        results = await controller.run_pipeline(
            project_name=args.project,
            publish_platforms=args.publish
        )
        
        # Save results
        results_path = Path(args.project) / "build" / "metrics" / f"premium_pipeline_{int(datetime.now().timestamp())}.json"
        results_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(results_path, 'w') as f:
            json.dump(results, f, indent=2, default=str)
            
        print(f"\n✅ Premium Pipeline completed successfully!")
        print(f"📊 Results saved to: {results_path}")
        print(f"📕 PDF: {results['pdf_path']}")
        
    finally:
        await controller.shutdown()


if __name__ == "__main__":
    asyncio.run(main())