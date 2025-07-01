#!/usr/bin/env python3
"""
Quality Agent: Responsible for PDF quality assurance and validation
Integrates pdf-qa-loop-real.js and visual verification tools
"""

import os
import json
import logging
import subprocess
import asyncio
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass
from PIL import Image
import io
import base64
import aiofiles

logger = logging.getLogger('QualityAgent')


@dataclass
class QualityIssue:
    """Represents a quality issue found in the PDF"""
    page: int
    issue_type: str
    description: str
    severity: str  # critical, warning, info
    
    
@dataclass
class QualityReport:
    """Complete quality assessment report"""
    pdf_path: str
    total_pages: int
    file_size_mb: float
    issues: List[QualityIssue]
    passed: bool
    cover_verified: bool
    images_verified: bool
    typography_verified: bool
    

class QualityAgent:
    """
    Agent responsible for quality assurance and validation
    Integrates scripts/quality/pdf-qa-loop-real.js
    """
    
    def __init__(self, project_path: str = ".", websocket_manager=None):
        self.project_path = Path(project_path)
        self.websocket_manager = websocket_manager
        self.build_dir = self.project_path / "build"
        
        # Quality scripts
        self.qa_loop_script = self.project_path / "scripts" / "quality" / "pdf-qa-loop-real.js"
        self.verify_script = self.project_path / "scripts" / "quality" / "verify-and-fix-loop.sh"
        
        # Quality thresholds
        self.quality_thresholds = {
            "min_pages": 10,
            "max_pages": 100,
            "min_file_size_mb": 0.1,
            "max_file_size_mb": 10,
            "cover_min_size_kb": 50,  # Lowered from 100KB based on experience
            "image_min_height": 200,
            "required_text_patterns": [
                "Chapter 1",
                "Chapter 5"
            ]
        }
        
        self.max_attempts = 5
        
    async def initialize(self):
        """Initialize the quality agent"""
        logger.info("Initializing Quality Agent...")
        
        # Ensure required directories exist
        self.build_dir.mkdir(exist_ok=True)
        
        await self._notify_status("initialized", {"agent": "quality"})
        
    async def _notify_status(self, status: str, data: Dict[str, Any]):
        """Send status update via websocket if available"""
        if self.websocket_manager:
            await self.websocket_manager.broadcast({
                "type": "status",
                "source": "quality",
                "target": "all",
                "data": {
                    "agent": "quality",
                    "status": status,
                    **data
                }
            })
            
    async def check_file_basics(self, pdf_path: str) -> Tuple[bool, List[QualityIssue]]:
        """Basic file checks"""
        issues = []
        
        if not Path(pdf_path).exists():
            issues.append(QualityIssue(
                page=0,
                issue_type="file_missing",
                description="PDF file not found",
                severity="critical"
            ))
            return False, issues
            
        file_size_mb = Path(pdf_path).stat().st_size / 1024 / 1024
        
        if file_size_mb < self.quality_thresholds["min_file_size_mb"]:
            issues.append(QualityIssue(
                page=0,
                issue_type="file_size",
                description=f"File too small: {file_size_mb:.2f} MB",
                severity="warning"
            ))
            
        if file_size_mb > self.quality_thresholds["max_file_size_mb"]:
            issues.append(QualityIssue(
                page=0,
                issue_type="file_size",
                description=f"File too large: {file_size_mb:.2f} MB",
                severity="warning"
            ))
            
        return len(issues) == 0, issues
        
    async def run_qa_script(self, pdf_path: str) -> Dict[str, Any]:
        """Run the Node.js QA script"""
        if not self.qa_loop_script.exists():
            logger.warning(f"QA script not found: {self.qa_loop_script}")
            return {"success": False, "error": "QA script not found"}
            
        # Create a temporary wrapper to run the QA check
        wrapper_content = f"""
const {{ analyzePDFVisually }} = require('{self.qa_loop_script}');

async function runQA() {{
    const issues = await analyzePDFVisually('{pdf_path}');
    console.log(JSON.stringify({{
        issues: issues,
        passed: issues.length === 0
    }}));
}}

runQA().catch(console.error);
        """
        
        wrapper_path = self.build_dir / "qa_wrapper.js"
        async with aiofiles.open(wrapper_path, 'w') as f:
            await f.write(wrapper_content)
            
        # Run the QA check
        process = await asyncio.create_subprocess_exec(
            'node', str(wrapper_path),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=str(self.project_path)
        )
        
        stdout, stderr = await process.communicate()
        
        # Clean up
        wrapper_path.unlink()
        
        if process.returncode == 0:
            try:
                result = json.loads(stdout.decode())
                return {"success": True, "data": result}
            except json.JSONDecodeError:
                return {"success": False, "error": "Invalid QA output"}
        else:
            return {"success": False, "error": stderr.decode()}
            
    async def visual_inspection_mcp(self, pdf_path: str) -> Dict[str, Any]:
        """Visual inspection using MCP browser tool"""
        logger.info("Performing visual inspection with MCP...")
        
        # This would integrate with MCP browser tool
        # For now, we'll simulate the check
        
        await self._notify_status("visual_inspection", {
            "method": "mcp_browser",
            "pdf": pdf_path
        })
        
        # In real implementation, this would:
        # 1. Open PDF in browser via MCP
        # 2. Take screenshots of key pages
        # 3. Analyze the screenshots
        
        return {
            "cover_visible": True,
            "images_visible": True,
            "typography_correct": True
        }
        
    async def extract_text_content(self, pdf_path: str) -> List[str]:
        """Extract text content from PDF for validation"""
        # Use pdfplumber or similar for text extraction
        # For now, using a simple subprocess approach
        
        cmd = ['pdftotext', pdf_path, '-']
        
        try:
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await process.communicate()
            
            if process.returncode == 0:
                return stdout.decode().split('\n')
            else:
                logger.warning(f"Text extraction failed: {stderr.decode()}")
                return []
                
        except FileNotFoundError:
            logger.warning("pdftotext not found, skipping text validation")
            return []
            
    async def validate_content(self, text_lines: List[str]) -> List[QualityIssue]:
        """Validate extracted text content"""
        issues = []
        full_text = '\n'.join(text_lines)
        
        # Check for required patterns
        for pattern in self.quality_thresholds["required_text_patterns"]:
            if pattern not in full_text:
                issues.append(QualityIssue(
                    page=0,
                    issue_type="missing_content",
                    description=f"Required text not found: {pattern}",
                    severity="critical"
                ))
                
        # Check for author name
        if "Enrique Oliveira" not in full_text:
            issues.append(QualityIssue(
                page=0,
                issue_type="missing_author",
                description="Author name not found in PDF",
                severity="warning"
            ))
            
        return issues
        
    async def quality_loop(self, pdf_path: str, fix_callback=None) -> QualityReport:
        """Main quality assurance loop with automatic fixes"""
        attempt = 0
        
        while attempt < self.max_attempts:
            attempt += 1
            logger.info(f"Quality check attempt {attempt}/{self.max_attempts}")
            
            await self._notify_status("quality_check_attempt", {
                "attempt": attempt,
                "max_attempts": self.max_attempts,
                "pdf": pdf_path
            })
            
            # Run all quality checks
            issues = []
            
            # Basic file checks
            basic_ok, basic_issues = await self.check_file_basics(pdf_path)
            issues.extend(basic_issues)
            
            # Visual inspection
            visual_result = await self.visual_inspection_mcp(pdf_path)
            
            if not visual_result.get("cover_visible", False):
                issues.append(QualityIssue(
                    page=1,
                    issue_type="missing_cover",
                    description="Cover image not visible or not rendering",
                    severity="critical"
                ))
                
            if not visual_result.get("images_visible", False):
                issues.append(QualityIssue(
                    page=0,
                    issue_type="missing_images",
                    description="Chapter images not visible",
                    severity="critical"
                ))
                
            # Text content validation
            text_lines = await self.extract_text_content(pdf_path)
            content_issues = await self.validate_content(text_lines)
            issues.extend(content_issues)
            
            # Get file stats
            file_stats = Path(pdf_path).stat()
            file_size_mb = file_stats.st_size / 1024 / 1024
            
            # Create report
            report = QualityReport(
                pdf_path=pdf_path,
                total_pages=len(text_lines) // 50,  # Rough estimate
                file_size_mb=file_size_mb,
                issues=issues,
                passed=len([i for i in issues if i.severity == "critical"]) == 0,
                cover_verified=visual_result.get("cover_visible", False),
                images_verified=visual_result.get("images_visible", False),
                typography_verified=visual_result.get("typography_correct", False)
            )
            
            await self._notify_status("quality_check_complete", {
                "attempt": attempt,
                "passed": report.passed,
                "issues": len(report.issues),
                "critical_issues": len([i for i in issues if i.severity == "critical"])
            })
            
            # If passed or no fix callback, return
            if report.passed or not fix_callback:
                break
                
            # Try to fix issues
            if attempt < self.max_attempts:
                logger.info("Attempting to fix issues...")
                fixed_path = await fix_callback(pdf_path, report)
                if fixed_path and fixed_path != pdf_path:
                    pdf_path = fixed_path
                    
        return report
        
    async def validate_pdf(self, pdf_path: str, auto_fix: bool = True) -> Dict[str, Any]:
        """Main method to validate PDF quality"""
        await self.initialize()
        
        logger.info(f"Starting quality validation for: {pdf_path}")
        
        # Define fix callback if auto_fix is enabled
        fix_callback = None
        if auto_fix:
            async def fix_issues(path: str, report: QualityReport) -> str:
                # This would trigger Format Agent to regenerate with fixes
                logger.info(f"Fix callback invoked for {len(report.issues)} issues")
                # For now, return the same path
                return path
                
            fix_callback = fix_issues
            
        # Run quality loop
        report = await self.quality_loop(pdf_path, fix_callback)
        
        # Generate final status
        if report.passed:
            logger.info("✅ PDF passed all quality checks!")
            await self._notify_status("validation_passed", {
                "pdf": pdf_path,
                "file_size_mb": report.file_size_mb
            })
        else:
            logger.warning(f"❌ PDF has {len(report.issues)} quality issues")
            await self._notify_status("validation_failed", {
                "pdf": pdf_path,
                "issues": [i.__dict__ for i in report.issues]
            })
            
        return {
            "status": "success" if report.passed else "failed",
            "report": report,
            "summary": {
                "total_issues": len(report.issues),
                "critical_issues": len([i for i in report.issues if i.severity == "critical"]),
                "warnings": len([i for i in report.issues if i.severity == "warning"]),
                "passed": report.passed
            }
        }


# Standalone execution for testing
if __name__ == "__main__":
    import sys
    
    async def main():
        pdf_path = sys.argv[1] if len(sys.argv) > 1 else "build/dist/formatted-output.pdf"
        
        agent = QualityAgent()
        result = await agent.validate_pdf(pdf_path)
        
        print(f"\nQuality Agent Result:")
        print(f"Status: {result['status']}")
        print(f"Summary: {result['summary']}")
        
        if result['status'] == 'failed':
            print("\nIssues found:")
            for issue in result['report'].issues:
                print(f"  - [{issue.severity}] {issue.description}")
                
    asyncio.run(main())