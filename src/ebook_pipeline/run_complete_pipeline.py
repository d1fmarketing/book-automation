#!/usr/bin/env python3
"""
Complete Pipeline Runner - Connects all agents with WebSocket
Uses enhanced content agent with image generation
"""

import asyncio
import logging
import sys
import os
from pathlib import Path
from typing import Dict, List, Any, Optional

# Add parent directory to Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from ebook_pipeline.pipeline_controller import PipelineController
from ebook_pipeline.agents.content_agent_enhanced import ContentAgentEnhanced

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('pipeline.log')
    ]
)

logger = logging.getLogger('CompletePipeline')


class CompletePipelineController(PipelineController):
    """Extended pipeline controller with enhanced content agent"""
    
    def __init__(self, project_path: str = ".", enable_websocket: bool = True):
        super().__init__(project_path, enable_websocket)
        
        # Replace content agent with enhanced version
        self.content_agent = ContentAgentEnhanced(project_path, self.websocket_manager)
        
        # Update configuration for clean PDF
        self.config.update({
            "pdf_generator": "clean",  # Use clean PDF generator
            "enable_ai_images": True,
            "visual_qa": True
        })
    
    async def run_pipeline(self, project_name: Optional[str] = None, 
                          publish_platforms: Optional[List[str]] = None) -> Dict[str, Any]:
        """
        Run the complete pipeline with enhanced features
        """
        logger.info("=" * 70)
        logger.info("🚀 STARTING COMPLETE PIPELINE WITH ALL AGENTS")
        logger.info("=" * 70)
        
        # Call parent implementation
        result = await super().run_pipeline(project_name, publish_platforms)
        
        # Additional processing if needed
        if result["status"] == "success":
            logger.info("\n" + "=" * 70)
            logger.info("🎯 ADDITIONAL ENHANCEMENTS")
            logger.info("=" * 70)
            
            # Run visual QA
            if self.config.get("visual_qa"):
                await self._run_visual_qa(result["final_pdf"])
            
            # Generate clean PDF if needed
            if self.config.get("pdf_generator") == "clean":
                clean_pdf = await self._generate_clean_pdf()
                if clean_pdf:
                    result["clean_pdf"] = clean_pdf
        
        return result
    
    async def _run_visual_qa(self, pdf_path: str):
        """Run visual QA check on the PDF"""
        logger.info("📸 Running Visual QA Check...")
        
        try:
            script_path = self.project_path / "scripts" / "quality" / "visual-qa-check.js"
            if script_path.exists():
                process = await asyncio.create_subprocess_exec(
                    'node', str(script_path), pdf_path,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE
                )
                stdout, stderr = await process.communicate()
                
                if process.returncode == 0:
                    logger.info("✅ Visual QA passed!")
                else:
                    logger.warning(f"⚠️  Visual QA issues: {stderr.decode()}")
            else:
                logger.warning("Visual QA script not found")
                
        except Exception as e:
            logger.error(f"Visual QA error: {e}")
    
    async def _generate_clean_pdf(self) -> Optional[str]:
        """Generate clean PDF without gradients"""
        logger.info("📄 Generating Clean PDF (Adobe-compatible)...")
        
        try:
            script_path = self.project_path / "scripts" / "generation" / "generate-clean-pdf.js"
            if script_path.exists():
                process = await asyncio.create_subprocess_exec(
                    'node', str(script_path),
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                    cwd=str(self.project_path)
                )
                stdout, stderr = await process.communicate()
                
                if process.returncode == 0:
                    clean_pdf_path = self.project_path / "build" / "dist" / "ebook-clean.pdf"
                    if clean_pdf_path.exists():
                        logger.info(f"✅ Clean PDF generated: {clean_pdf_path}")
                        return str(clean_pdf_path)
                else:
                    logger.error(f"Clean PDF generation failed: {stderr.decode()}")
            else:
                logger.warning("Clean PDF generator not found")
                
        except Exception as e:
            logger.error(f"Clean PDF error: {e}")
            
        return None


async def main():
    """Main entry point"""
    import argparse
    
    parser = argparse.ArgumentParser(
        description="Run the complete ebook pipeline with all agents connected"
    )
    parser.add_argument(
        "project_path", 
        nargs="?",
        default=".",
        help="Path to the book project (default: current directory)"
    )
    parser.add_argument(
        "--platforms", 
        nargs="+", 
        default=["local"],
        help="Publishing platforms (local, kdp, apple, google)"
    )
    parser.add_argument(
        "--no-websocket", 
        action="store_true",
        help="Disable WebSocket server"
    )
    parser.add_argument(
        "--skip-images",
        action="store_true",
        help="Skip AI image generation"
    )
    
    args = parser.parse_args()
    
    # Create controller
    controller = CompletePipelineController(
        args.project_path,
        enable_websocket=not args.no_websocket
    )
    
    # Configure
    if args.skip_images:
        controller.config["enable_ai_images"] = False
    
    try:
        # Initialize
        await controller.initialize()
        
        logger.info("\n" + "🎯 " * 30)
        logger.info("COMPLETE PIPELINE SYSTEM")
        logger.info("All 5 Agents Connected via WebSocket")
        logger.info("🎯 " * 30 + "\n")
        
        # Run pipeline
        result = await controller.run_pipeline(
            project_name=Path(args.project_path).name,
            publish_platforms=args.platforms
        )
        
        # Summary
        if result["status"] == "success":
            logger.info("\n" + "🌟 " * 30)
            logger.info("PIPELINE COMPLETE - ALL AGENTS EXECUTED SUCCESSFULLY!")
            logger.info("🌟 " * 30)
            logger.info(f"\n📚 Final PDF: {result['final_pdf']}")
            if "clean_pdf" in result:
                logger.info(f"📄 Clean PDF: {result['clean_pdf']}")
            logger.info(f"📊 Statistics:")
            logger.info(f"   - Chapters: {result['statistics']['chapters']}")
            logger.info(f"   - Words: {result['statistics']['total_words']:,}")
            logger.info(f"   - PDF Size: {result['statistics']['pdf_size_mb']:.2f} MB")
            logger.info(f"   - Quality Checks: {result['statistics']['quality_attempts']}")
            logger.info(f"   - Published to: {result['statistics']['platforms_published']} platform(s)")
            
            # Save detailed report
            import json
            report_path = Path(args.project_path) / "build" / "pipeline-complete-report.json"
            report_path.parent.mkdir(exist_ok=True)
            
            with open(report_path, 'w') as f:
                json.dump(result, f, indent=2, default=str)
            
            logger.info(f"\n📋 Detailed report: {report_path}")
        else:
            logger.error("\n❌ PIPELINE FAILED")
            logger.error(f"Error: {result.get('error', 'Unknown error')}")
            logger.error(f"Failed at stage: {result.get('stage_failed', 'Unknown')}")
        
        return result
        
    except KeyboardInterrupt:
        logger.info("\n⚠️  Pipeline interrupted by user")
        return {"status": "interrupted"}
        
    except Exception as e:
        logger.error(f"\n💥 Fatal error: {e}", exc_info=True)
        return {"status": "error", "error": str(e)}
        
    finally:
        # Cleanup
        await controller.shutdown()
        logger.info("\n👋 Pipeline shutdown complete")


if __name__ == "__main__":
    # Run the pipeline
    result = asyncio.run(main())
    
    # Exit with appropriate code
    exit_code = 0 if result.get("status") == "success" else 1
    sys.exit(exit_code)