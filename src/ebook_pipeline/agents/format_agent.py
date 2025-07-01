#!/usr/bin/env python3
"""
Format Agent: Responsible for converting HTML to professionally formatted PDF
Integrates generate-pdf-final.js and handles all formatting requirements
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

logger = logging.getLogger('FormatAgent')


@dataclass
class FormatConfig:
    """PDF formatting configuration"""
    page_size: str = "6in 9in"  # Professional book size
    margins: Dict[str, str] = None
    font_family: str = "Georgia, serif"
    font_size: str = "11pt"
    line_height: float = 1.6
    drop_caps: bool = True
    ultra_thin: bool = True
    
    def __post_init__(self):
        if self.margins is None:
            self.margins = {
                "top": "0.75in",
                "bottom": "0.75in", 
                "left": "0.75in",
                "right": "0.75in"
            }


class FormatAgent:
    """
    Agent responsible for PDF formatting and generation
    Integrates scripts/generation/generate-pdf-final.js
    """
    
    def __init__(self, project_path: str = ".", websocket_manager=None):
        self.project_path = Path(project_path)
        self.websocket_manager = websocket_manager
        self.build_dir = self.project_path / "build"
        self.dist_dir = self.build_dir / "dist"
        
        # Path to the working PDF generator script
        self.pdf_generator_script = self.project_path / "scripts" / "generation" / "generate-pdf-final.js"
        
        # Default format configuration
        self.format_config = FormatConfig()
        
    async def initialize(self):
        """Initialize the format agent"""
        logger.info("Initializing Format Agent...")
        
        # Ensure output directories exist
        self.build_dir.mkdir(exist_ok=True)
        self.dist_dir.mkdir(exist_ok=True)
        
        # Check if PDF generator script exists
        if not self.pdf_generator_script.exists():
            logger.warning(f"PDF generator script not found at: {self.pdf_generator_script}")
            # We'll create a wrapper or use direct puppeteer
            
        await self._notify_status("initialized", {"agent": "format"})
        
    async def _notify_status(self, status: str, data: Dict[str, Any]):
        """Send status update via websocket if available"""
        if self.websocket_manager:
            await self.websocket_manager.broadcast({
                "type": "status",
                "source": "format",
                "target": "all",
                "data": {
                    "agent": "format",
                    "status": status,
                    **data
                }
            })
            
    def _generate_css(self) -> str:
        """Generate CSS based on format configuration"""
        css = f"""
        /* Page setup */
        @page {{
            size: {self.format_config.page_size};
            margin: {self.format_config.margins['top']} {self.format_config.margins['right']} 
                    {self.format_config.margins['bottom']} {self.format_config.margins['left']};
        }}
        
        @page :first {{
            margin: 0;
        }}
        
        /* Reset */
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}
        
        /* Base typography */
        body {{
            font-family: {self.format_config.font_family};
            font-size: {self.format_config.font_size};
            line-height: {self.format_config.line_height};
            color: #1A1A1A;
            background: white;
        }}
        """
        
        # Ultra-thin styling
        if self.format_config.ultra_thin:
            css += """
        /* Ultra-thin typography */
        body {
            font-weight: 300;
        }
        
        h1, h2, h3, h4, h5, h6 {
            font-weight: 100;
        }
        
        .chapter-number {
            font-weight: 100;
        }
        """
        
        # Page styles
        css += """
        /* Cover page */
        .cover {
            page-break-after: always;
            width: 6in;
            height: 9in;
            position: relative;
            overflow: hidden;
        }
        
        .cover img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: block;
        }
        
        /* Interior pages */
        .page {
            page-break-after: always;
            min-height: 7.5in;
        }
        
        /* Title page */
        .title-page {
            text-align: center;
            padding-top: 3in;
        }
        
        .title-page h1 {
            font-size: 36pt;
            font-weight: 100;
            margin-bottom: 0.5em;
        }
        
        .title-page .subtitle {
            font-size: 18pt;
            font-weight: 300;
            color: #555;
            margin-bottom: 3in;
        }
        
        .title-page .author {
            font-size: 16pt;
            font-weight: 400;
        }
        
        /* Chapters */
        .chapter {
            page-break-before: always;
        }
        
        .chapter-number {
            font-size: 72pt;
            line-height: 1;
            color: #0066CC;
            margin-bottom: 0.25em;
        }
        
        .chapter h1 {
            font-size: 24pt;
            font-weight: 300;
            margin-bottom: 1.5em;
        }
        
        /* Paragraphs */
        p {
            text-indent: 1.5em;
            margin-bottom: 0.5em;
            text-align: justify;
            hyphens: auto;
        }
        
        p.first-paragraph {
            text-indent: 0;
        }
        """
        
        # Drop caps
        if self.format_config.drop_caps:
            css += """
        /* Drop caps */
        .first-paragraph::first-letter {
            font-size: 48pt;
            line-height: 1;
            font-weight: 300;
            float: left;
            color: #0066CC;
            margin: -0.1em 0.05em -0.1em 0;
        }
        """
        
        # Images
        css += """
        /* Chapter images */
        .chapter-image {
            display: block;
            width: 100%;
            max-width: 4.5in;
            height: auto;
            margin: 1.5em auto;
            page-break-inside: avoid;
        }
        
        /* Ensure images don't break */
        img {
            page-break-inside: avoid;
            page-break-before: auto;
            page-break-after: auto;
        }
        """
        
        return css
        
    async def enhance_html(self, html_path: str) -> str:
        """Enhance HTML with proper formatting CSS"""
        logger.info(f"Enhancing HTML from: {html_path}")
        
        # Read the HTML content
        async with aiofiles.open(html_path, 'r', encoding='utf-8') as f:
            html_content = await f.read()
            
        # Generate CSS
        css = self._generate_css()
        
        # Insert CSS into HTML
        if '<style>' in html_content:
            # Replace existing style
            html_content = html_content.replace('<style>', f'<style>\n{css}\n')
        else:
            # Add style tag in head
            html_content = html_content.replace('</head>', f'<style>\n{css}\n</style>\n</head>')
            
        # Save enhanced HTML
        enhanced_path = self.build_dir / "formatted.html"
        async with aiofiles.open(enhanced_path, 'w', encoding='utf-8') as f:
            await f.write(html_content)
            
        await self._notify_status("html_enhanced", {
            "original": html_path,
            "enhanced": str(enhanced_path)
        })
        
        return str(enhanced_path)
        
    async def generate_pdf_nodejs(self, html_path: str, output_path: str) -> bool:
        """Generate PDF using the Node.js script"""
        logger.info("Generating PDF using Node.js script...")
        
        # Use the existing working script
        if self.pdf_generator_script.exists():
            cmd = ['node', str(self.pdf_generator_script)]
            
            # Run the script
            process = await asyncio.create_subprocess_exec(
                *cmd,
                cwd=str(self.project_path),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await process.communicate()
            
            if process.returncode == 0:
                logger.info("PDF generated successfully via Node.js")
                # Find the generated PDF
                possible_paths = [
                    self.project_path / "THE-CLAUDE-ELITE-PIPELINE-ABSOLUTELY-PERFECT.pdf",
                    self.project_path / "build" / "dist" / "the-claude-elite-pipeline-FINAL.pdf"
                ]
                
                for path in possible_paths:
                    if path.exists():
                        # Move to desired output path
                        import shutil
                        shutil.move(str(path), output_path)
                        return True
                        
            else:
                logger.error(f"PDF generation failed: {stderr.decode()}")
                
        return False
        
    async def generate_pdf_direct(self, html_path: str, output_path: str) -> bool:
        """Generate PDF directly using Puppeteer"""
        logger.info("Generating PDF directly with Puppeteer...")
        
        # Create a minimal Node.js script for PDF generation
        script_content = f"""
const puppeteer = require('puppeteer');
const fs = require('fs-extra');

async function generatePDF() {{
    const browser = await puppeteer.launch({{ 
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }});
    
    const page = await browser.newPage();
    
    // Read HTML
    const html = await fs.readFile('{html_path}', 'utf-8');
    
    // Set content
    await page.setContent(html, {{ 
        waitUntil: ['networkidle0', 'domcontentloaded']
    }});
    
    // Wait for fonts and images
    await page.evaluateHandle('document.fonts.ready');
    await new Promise(r => setTimeout(r, 3000));
    
    // Generate PDF
    await page.pdf({{
        path: '{output_path}',
        format: 'Letter',
        printBackground: true,
        preferCSSPageSize: true,
        displayHeaderFooter: false,
        margin: {{ top: 0, right: 0, bottom: 0, left: 0 }}
    }});
    
    await browser.close();
    console.log('PDF generated successfully');
}}

generatePDF().catch(console.error);
        """
        
        # Save temporary script
        temp_script = self.build_dir / "temp_pdf_generator.js"
        async with aiofiles.open(temp_script, 'w') as f:
            await f.write(script_content)
            
        # Run the script
        process = await asyncio.create_subprocess_exec(
            'node', str(temp_script),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        stdout, stderr = await process.communicate()
        
        # Clean up
        temp_script.unlink()
        
        return process.returncode == 0
        
    async def format_pdf(self, html_path: str, config: Optional[FormatConfig] = None) -> Dict[str, Any]:
        """Main method to format HTML into PDF"""
        await self.initialize()
        
        if config:
            self.format_config = config
            
        # Enhance HTML with formatting
        enhanced_html = await self.enhance_html(html_path)
        
        # Generate output path
        output_filename = "formatted-output.pdf"
        output_path = str(self.dist_dir / output_filename)
        
        await self._notify_status("pdf_generation_started", {
            "input": enhanced_html,
            "output": output_path
        })
        
        # Try to generate PDF using existing script first
        success = await self.generate_pdf_nodejs(enhanced_html, output_path)
        
        # If that fails, try direct generation
        if not success:
            success = await self.generate_pdf_direct(enhanced_html, output_path)
            
        if success and Path(output_path).exists():
            file_size = Path(output_path).stat().st_size
            
            await self._notify_status("pdf_generated", {
                "path": output_path,
                "size_mb": file_size / 1024 / 1024
            })
            
            logger.info(f"PDF formatting complete: {output_path}")
            
            return {
                "status": "success",
                "pdf_path": output_path,
                "size_bytes": file_size,
                "format_config": self.format_config.__dict__
            }
        else:
            logger.error("PDF generation failed")
            
            await self._notify_status("pdf_generation_failed", {
                "error": "Failed to generate PDF"
            })
            
            return {
                "status": "error",
                "error": "PDF generation failed"
            }


# Standalone execution for testing
if __name__ == "__main__":
    import sys
    
    async def main():
        html_path = sys.argv[1] if len(sys.argv) > 1 else "build/content.html"
        
        agent = FormatAgent()
        result = await agent.format_pdf(html_path)
        
        print(f"\nFormat Agent Result:")
        print(f"Status: {result['status']}")
        if result['status'] == 'success':
            print(f"PDF Path: {result['pdf_path']}")
            print(f"Size: {result['size_bytes'] / 1024 / 1024:.2f} MB")
        else:
            print(f"Error: {result.get('error', 'Unknown error')}")
            
    asyncio.run(main())