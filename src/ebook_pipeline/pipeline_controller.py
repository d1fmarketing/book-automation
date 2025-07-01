#!/usr/bin/env python3
"""
Pipeline Controller: Main orchestrator that coordinates all 5 agents
This is the central controller that implements the complete pipeline flow
"""

import asyncio
import logging
import sys
from pathlib import Path
from typing import Dict, List, Any, Optional
from datetime import datetime
import json

# Import all agents
from .agents.content_agent import ContentAgent
from .agents.format_agent import FormatAgent, FormatConfig
from .agents.quality_agent import QualityAgent
from .agents.monitor_agent import MonitorAgent
from .agents.publish_agent import PublishAgent

# Import orchestrator
from .orchestrator.websocket_manager import WebSocketManager

logger = logging.getLogger('PipelineController')


class PipelineController:
    """
    Main pipeline controller that orchestrates all 5 agents
    Implements the complete book creation workflow
    """
    
    def __init__(self, project_path: str = ".", enable_websocket: bool = True):
        self.project_path = Path(project_path)
        
        # WebSocket manager for inter-agent communication
        self.websocket_manager = None
        if enable_websocket:
            self.websocket_manager = WebSocketManager()
            
        # Initialize all 5 agents
        self.content_agent = ContentAgent(project_path, self.websocket_manager)
        self.format_agent = FormatAgent(project_path, self.websocket_manager)
        self.quality_agent = QualityAgent(project_path, self.websocket_manager)
        self.monitor_agent = MonitorAgent(project_path, self.websocket_manager)
        self.publish_agent = PublishAgent(project_path, self.websocket_manager)
        
        # Pipeline state
        self.pipeline_state = {
            "status": "idle",
            "current_stage": "",
            "start_time": None,
            "end_time": None,
            "results": {}
        }
        
        # Configuration
        self.config = {
            "auto_fix": True,
            "max_quality_attempts": 3,
            "publish_platforms": ["local"],
            "format_config": FormatConfig()
        }
        
    async def initialize(self):
        """Initialize the pipeline and all agents"""
        logger.info("Initializing Pipeline Controller...")
        
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
        
        logger.info("Pipeline Controller initialized successfully")
        
    async def shutdown(self):
        """Shutdown the pipeline gracefully"""
        logger.info("Shutting down Pipeline Controller...")
        
        if self.websocket_manager:
            await self.websocket_manager.stop_server()
            
        logger.info("Pipeline Controller shutdown complete")
        
    async def run_pipeline(self, project_name: Optional[str] = None, 
                          publish_platforms: Optional[List[str]] = None) -> Dict[str, Any]:
        """
        Run the complete pipeline: Content -> Format -> Quality -> Publish
        This is the main method that orchestrates all agents
        """
        
        # Start pipeline monitoring
        pipeline_id = await self.monitor_agent.start_pipeline(
            project_name or self.project_path.name
        )
        
        self.pipeline_state["status"] = "running"
        self.pipeline_state["start_time"] = datetime.now()
        
        try:
            # ========================================
            # STAGE 1: Content Processing
            # ========================================
            logger.info("=" * 50)
            logger.info("STAGE 1: Content Processing")
            logger.info("=" * 50)
            
            self.pipeline_state["current_stage"] = "content"
            await self.monitor_agent.update_agent_status("content", "running")
            
            content_result = await self.content_agent.process_book()
            
            if content_result["status"] != "success":
                raise Exception(f"Content processing failed: {content_result}")
                
            self.pipeline_state["results"]["content"] = content_result
            await self.monitor_agent.update_agent_status("content", "completed", {
                "chapters": content_result["statistics"]["chapters"],
                "words": content_result["statistics"]["total_words"],
                "images": content_result["statistics"]["images"]
            })
            
            html_path = content_result["html_path"]
            logger.info(f"✅ Content processing complete: {html_path}")
            
            # ========================================
            # STAGE 2: Format to PDF
            # ========================================
            logger.info("\n" + "=" * 50)
            logger.info("STAGE 2: PDF Formatting")
            logger.info("=" * 50)
            
            self.pipeline_state["current_stage"] = "format"
            await self.monitor_agent.update_agent_status("format", "running")
            
            format_result = await self.format_agent.format_pdf(
                html_path, 
                self.config["format_config"]
            )
            
            if format_result["status"] != "success":
                raise Exception(f"PDF formatting failed: {format_result}")
                
            self.pipeline_state["results"]["format"] = format_result
            await self.monitor_agent.update_agent_status("format", "completed", {
                "pdf_path": format_result["pdf_path"],
                "size_mb": format_result["size_bytes"] / 1024 / 1024
            })
            
            pdf_path = format_result["pdf_path"]
            logger.info(f"✅ PDF formatting complete: {pdf_path}")
            
            # ========================================
            # STAGE 3: Quality Assurance
            # ========================================
            logger.info("\n" + "=" * 50)
            logger.info("STAGE 3: Quality Assurance")
            logger.info("=" * 50)
            
            self.pipeline_state["current_stage"] = "quality"
            await self.monitor_agent.update_agent_status("quality", "running")
            
            # Quality loop with auto-fix
            quality_attempts = 0
            quality_passed = False
            
            while quality_attempts < self.config["max_quality_attempts"]:
                quality_attempts += 1
                logger.info(f"Quality check attempt {quality_attempts}/{self.config['max_quality_attempts']}")
                
                quality_result = await self.quality_agent.validate_pdf(
                    pdf_path,
                    auto_fix=self.config["auto_fix"]
                )
                
                if quality_result["status"] == "success":
                    quality_passed = True
                    break
                    
                # If auto-fix is enabled and we have issues, regenerate PDF
                if self.config["auto_fix"] and quality_attempts < self.config["max_quality_attempts"]:
                    logger.info("Regenerating PDF with fixes...")
                    
                    # Trigger format agent to regenerate
                    await self.monitor_agent.update_agent_status("format", "running", {
                        "reason": "quality_fix",
                        "attempt": quality_attempts + 1
                    })
                    
                    format_result = await self.format_agent.format_pdf(
                        html_path,
                        self.config["format_config"]
                    )
                    
                    if format_result["status"] == "success":
                        pdf_path = format_result["pdf_path"]
                        await self.monitor_agent.update_agent_status("format", "completed", {
                            "regenerated": True
                        })
                        
            if not quality_passed:
                raise Exception(f"Quality checks failed after {quality_attempts} attempts")
                
            self.pipeline_state["results"]["quality"] = quality_result
            await self.monitor_agent.update_agent_status("quality", "completed", {
                "passed": True,
                "attempts": quality_attempts
            })
            
            logger.info(f"✅ Quality assurance passed after {quality_attempts} attempt(s)")
            
            # ========================================
            # STAGE 4: Publishing
            # ========================================
            logger.info("\n" + "=" * 50)
            logger.info("STAGE 4: Publishing")
            logger.info("=" * 50)
            
            self.pipeline_state["current_stage"] = "publish"
            await self.monitor_agent.update_agent_status("publish", "running")
            
            # Use provided platforms or default
            platforms = publish_platforms or self.config["publish_platforms"]
            
            publish_result = await self.publish_agent.publish_book(
                pdf_path,
                platforms
            )
            
            if publish_result["status"] != "success":
                logger.warning(f"Publishing had issues: {publish_result}")
                
            self.pipeline_state["results"]["publish"] = publish_result
            await self.monitor_agent.update_agent_status("publish", "completed", {
                "platforms": platforms,
                "successful": publish_result["summary"]["platforms_succeeded"]
            })
            
            logger.info(f"✅ Publishing complete: {publish_result['summary']['platforms_succeeded']}/{len(platforms)} platforms")
            
            # ========================================
            # Pipeline Complete
            # ========================================
            self.pipeline_state["status"] = "completed"
            self.pipeline_state["end_time"] = datetime.now()
            
            await self.monitor_agent.complete_pipeline(success=True)
            
            # Generate final summary
            duration = (self.pipeline_state["end_time"] - self.pipeline_state["start_time"]).total_seconds()
            
            summary = {
                "pipeline_id": pipeline_id,
                "status": "success",
                "duration_seconds": duration,
                "stages_completed": ["content", "format", "quality", "publish"],
                "final_pdf": pdf_path,
                "statistics": {
                    "chapters": content_result["statistics"]["chapters"],
                    "total_words": content_result["statistics"]["total_words"],
                    "pdf_size_mb": format_result["size_bytes"] / 1024 / 1024,
                    "quality_attempts": quality_attempts,
                    "platforms_published": publish_result["summary"]["platforms_succeeded"]
                },
                "results": self.pipeline_state["results"]
            }
            
            logger.info("\n" + "=" * 50)
            logger.info("🎉 PIPELINE COMPLETE!")
            logger.info("=" * 50)
            logger.info(f"Duration: {duration:.2f} seconds")
            logger.info(f"Final PDF: {pdf_path}")
            logger.info(f"Published to: {publish_result['summary']['platforms_succeeded']} platform(s)")
            
            return summary
            
        except Exception as e:
            # Handle pipeline failure
            logger.error(f"Pipeline failed: {e}")
            
            self.pipeline_state["status"] = "failed"
            self.pipeline_state["end_time"] = datetime.now()
            
            # Record error in monitor
            current_stage = self.pipeline_state["current_stage"]
            if current_stage:
                await self.monitor_agent.record_error(current_stage, str(e))
                await self.monitor_agent.update_agent_status(current_stage, "error")
                
            await self.monitor_agent.complete_pipeline(success=False)
            
            return {
                "pipeline_id": pipeline_id,
                "status": "failed",
                "error": str(e),
                "stage_failed": current_stage,
                "results": self.pipeline_state["results"]
            }
            
    async def configure(self, config: Dict[str, Any]):
        """Update pipeline configuration"""
        self.config.update(config)
        logger.info(f"Pipeline configuration updated: {config}")
        
    async def get_status(self) -> Dict[str, Any]:
        """Get current pipeline status"""
        status = {
            "pipeline_state": self.pipeline_state,
            "agent_status": {},
            "websocket_status": None
        }
        
        # Get monitor data
        if self.monitor_agent:
            dashboard_data = await self.monitor_agent.get_dashboard_data()
            status["agent_status"] = dashboard_data.get("agent_status", {})
            
        # Get WebSocket status
        if self.websocket_manager:
            status["websocket_status"] = await self.websocket_manager.get_status()
            
        return status


# Convenience function for running pipeline
async def run_complete_pipeline(project_path: str, 
                               publish_platforms: Optional[List[str]] = None,
                               enable_websocket: bool = True) -> Dict[str, Any]:
    """
    Convenience function to run the complete pipeline
    """
    controller = PipelineController(project_path, enable_websocket)
    
    try:
        await controller.initialize()
        result = await controller.run_pipeline(
            project_name=Path(project_path).name,
            publish_platforms=publish_platforms
        )
        return result
        
    finally:
        await controller.shutdown()


# CLI execution
if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Run the complete ebook pipeline")
    parser.add_argument("project_path", help="Path to the book project")
    parser.add_argument("--platforms", nargs="+", default=["local"],
                       help="Publishing platforms (local, kdp, apple, google)")
    parser.add_argument("--no-websocket", action="store_true",
                       help="Disable WebSocket server")
    
    args = parser.parse_args()
    
    # Configure logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    # Run pipeline
    result = asyncio.run(run_complete_pipeline(
        args.project_path,
        args.platforms,
        not args.no_websocket
    ))
    
    # Save result
    result_file = Path(args.project_path) / "build" / "pipeline-result.json"
    result_file.parent.mkdir(exist_ok=True)
    
    with open(result_file, 'w') as f:
        json.dump(result, f, indent=2, default=str)
        
    print(f"\nPipeline result saved to: {result_file}")
    
    # Exit with appropriate code
    sys.exit(0 if result["status"] == "success" else 1)