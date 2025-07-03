#!/usr/bin/env python3
"""
Premium Format Agent: Uses the enhanced PDF generator with visual enhancements
Integrates with generate-premium-pdf.js for professional output
"""

import os
import json
import logging
import subprocess
import asyncio
from pathlib import Path
from typing import Dict, Any, Optional
from dataclasses import dataclass
import aiofiles

logger = logging.getLogger('PremiumFormatAgent')


@dataclass
class PremiumFormatConfig:
    """Enhanced PDF formatting configuration with visual features"""
    page_size: str = "6in 9in"
    margins: Dict[str, str] = None
    font_family: str = "Inter, -apple-system, BlinkMacSystemFont, sans-serif"
    font_size: str = "11pt"
    line_height: float = 1.8
    
    # Visual enhancements
    enable_callout_boxes: bool = True
    enable_syntax_highlighting: bool = True
    enable_headers_footers: bool = True
    enable_drop_caps: bool = True
    enable_gradients: bool = True
    
    # Theme configuration
    primary_gradient: list = None
    secondary_gradient: list = None
    accent_color: str = "#FFD700"
    code_theme: str = "prism"
    
    def __post_init__(self):
        if self.margins is None:
            self.margins = {
                "top": "1in",
                "bottom": "0.75in",
                "left": "0.75in",
                "right": "0.75in"
            }
        if self.primary_gradient is None:
            self.primary_gradient = ["#667eea", "#764ba2"]
        if self.secondary_gradient is None:
            self.secondary_gradient = ["#f093fb", "#f5576c"]


class PremiumFormatAgent:
    """
    Enhanced Format Agent using premium PDF generator with visual features
    """
    
    def __init__(self, project_path: str = ".", websocket_manager=None):
        self.project_path = Path(project_path)
        self.websocket_manager = websocket_manager
        self.build_dir = self.project_path / "build"
        self.dist_dir = self.build_dir / "dist"
        self.temp_dir = self.build_dir / "temp"
        self.format_config = PremiumFormatConfig()
        
        # Path to premium generator
        self.premium_generator_path = self.project_path / "pipeline-book" / "scripts" / "generation" / "generate-premium-pdf.js"
        
    async def initialize(self):
        """Initialize the format agent"""
        await self._ensure_directories()
        await self._send_status("initialized", {"agent": "format_premium"})
        
    async def _ensure_directories(self):
        """Ensure all required directories exist"""
        for dir_path in [self.build_dir, self.dist_dir, self.temp_dir]:
            dir_path.mkdir(parents=True, exist_ok=True)
            
    async def _send_status(self, status: str, data: Dict[str, Any] = None):
        """Send status update via websocket"""
        if self.websocket_manager:
            message = {
                "type": "status_update",
                "source": "format_agent_premium",
                "target": "controller",
                "data": {
                    "status": status,
                    "details": data or {}
                }
            }
            await self.websocket_manager.broadcast(message)
            
    async def format_pdf(self, html_path: str, config: Optional[PremiumFormatConfig] = None) -> Dict[str, Any]:
        """
        Format HTML to premium PDF with visual enhancements
        """
        if config:
            self.format_config = config
            
        await self._send_status("formatting_started", {"html_path": html_path})
        
        try:
            # Update metadata with visual theme
            await self._update_metadata_theme()
            
            # Check if we should use the premium generator
            if await self._should_use_premium():
                # Use the Node.js premium generator
                output_path = await self._generate_premium_pdf()
            else:
                # Fall back to standard generation
                output_path = await self._generate_standard_pdf(html_path)
            
            # Get file info
            file_stats = output_path.stat()
            
            result = {
                "success": True,
                "pdf_path": str(output_path),
                "file_size": file_stats.st_size,
                "format_config": {
                    "page_size": self.format_config.page_size,
                    "visual_enhancements": {
                        "callout_boxes": self.format_config.enable_callout_boxes,
                        "syntax_highlighting": self.format_config.enable_syntax_highlighting,
                        "headers_footers": self.format_config.enable_headers_footers,
                        "drop_caps": self.format_config.enable_drop_caps,
                        "gradients": self.format_config.enable_gradients
                    }
                }
            }
            
            await self._send_status("formatting_completed", result)
            return result
            
        except Exception as e:
            logger.error(f"Premium formatting failed: {str(e)}")
            await self._send_status("formatting_failed", {"error": str(e)})
            raise
            
    async def _should_use_premium(self) -> bool:
        """Check if we should use the premium generator"""
        # Check if premium generator exists
        if not self.premium_generator_path.exists():
            logger.warning("Premium generator not found, falling back to standard")
            return False
            
        # Check if any visual enhancements are enabled
        return any([
            self.format_config.enable_callout_boxes,
            self.format_config.enable_syntax_highlighting,
            self.format_config.enable_headers_footers,
            self.format_config.enable_drop_caps,
            self.format_config.enable_gradients
        ])
        
    async def _update_metadata_theme(self):
        """Update metadata.yaml with visual theme settings"""
        metadata_path = self.project_path / "pipeline-book" / "metadata.yaml"
        
        if not metadata_path.exists():
            return
            
        # Read current metadata
        async with aiofiles.open(metadata_path, 'r') as f:
            content = await f.read()
            
        # Check if visual_theme section exists
        if "visual_theme:" not in content:
            # Add visual theme section
            theme_section = f"""
# Visual Enhancement Theme (Premium Features)
visual_theme:
  primary_gradient: {json.dumps(self.format_config.primary_gradient)}
  secondary_gradient: {json.dumps(self.format_config.secondary_gradient)}
  accent_color: "{self.format_config.accent_color}"
  code_theme: "{self.format_config.code_theme}"
  
  typography:
    drop_caps: {str(self.format_config.enable_drop_caps).lower()}
    chapter_number_style: "gradient"
    
  page_elements:
    section_dividers: true
    chapter_images: true
"""
            async with aiofiles.open(metadata_path, 'a') as f:
                await f.write(theme_section)
                
    async def _generate_premium_pdf(self) -> Path:
        """Generate PDF using the premium Node.js generator"""
        logger.info("Using premium PDF generator with visual enhancements")
        
        # Change to pipeline-book directory
        original_cwd = os.getcwd()
        os.chdir(self.project_path / "pipeline-book")
        
        try:
            # Run the premium generator
            process = await asyncio.create_subprocess_exec(
                'node', 'scripts/generation/generate-premium-pdf.js',
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await process.communicate()
            
            if process.returncode != 0:
                raise Exception(f"Premium PDF generation failed: {stderr.decode()}")
                
            logger.info("Premium PDF generated successfully")
            
            # The premium generator outputs to build/dist/premium-ebook.pdf
            output_path = self.project_path / "pipeline-book" / "build" / "dist" / "premium-ebook.pdf"
            
            if not output_path.exists():
                raise Exception("Premium PDF not found after generation")
                
            return output_path
            
        finally:
            os.chdir(original_cwd)
            
    async def _generate_standard_pdf(self, html_path: str) -> Path:
        """Fallback to standard PDF generation"""
        logger.info("Using standard PDF generator")
        
        # Implementation would go here - for now, raise an exception
        raise NotImplementedError("Standard PDF generation not implemented in premium agent")
        
    async def apply_quality_fixes(self, quality_report: Dict[str, Any]) -> Dict[str, Any]:
        """Apply fixes based on quality report"""
        logger.info("Applying quality fixes based on report")
        
        # The premium generator handles most quality issues automatically
        # but we can regenerate if needed
        
        if not quality_report.get("passed", True):
            # Regenerate the PDF
            output_path = await self._generate_premium_pdf()
            
            return {
                "success": True,
                "pdf_path": str(output_path),
                "fixes_applied": ["regenerated_with_premium_generator"]
            }
            
        return {
            "success": True,
            "fixes_applied": []
        }


# Make this agent available as the default format agent
FormatAgent = PremiumFormatAgent