#!/usr/bin/env python3
"""
Unified Pipeline Orchestrator
Integrates Python agents with JavaScript tools for complete book automation
"""
import json
import logging
import os
import sys
import subprocess
import yaml
from pathlib import Path
from typing import Dict, List, Any, Optional
from datetime import datetime

from ebook_pipeline.agents.agent_registry import get_registry
from ebook_pipeline.agents.master_orchestrator import MasterOrchestrator, BookProject

logger = logging.getLogger(__name__)


class UnifiedPipelineOrchestrator:
    """Orchestrates the complete pipeline integrating all agents and tools"""
    
    def __init__(self, project_file: str = "book-project.yaml", 
                 pipeline_config: str = "pipeline-config.yaml",
                 mode: str = "standard"):
        self.project = BookProject.from_yaml(project_file)
        self.mode = mode
        self.registry = get_registry(pipeline_config)
        self.master = MasterOrchestrator(project_file, mode)
        
        # Load pipeline configuration
        with open(pipeline_config, 'r') as f:
            self.config = yaml.safe_load(f)
            
        self.state = {
            'start_time': datetime.now().isoformat(),
            'mode': mode,
            'project': self.project.title,
            'phases': {},
            'errors': []
        }
        
    def run_pipeline(self):
        """Run the complete pipeline based on mode"""
        logger.info(f"🚀 Starting Unified Pipeline in {self.mode} mode")
        
        # Get workflow configuration
        workflow = self.config['workflows'].get(self.mode)
        if not workflow:
            logger.error(f"Unknown mode: {self.mode}")
            return False
            
        logger.info(f"📋 Running workflow: {workflow['name']}")
        logger.info(f"📝 Description: {workflow['description']}")
        
        # Execute workflow steps
        success = True
        for step in workflow.get('steps', []):
            if not self._execute_step(step):
                if not step.get('optional', False):
                    success = False
                    break
                    
        # Run additional steps for extended modes
        if self.mode == 'premium' and 'extends' in workflow:
            base_workflow = self.config['workflows'][workflow['extends']]
            for step in workflow.get('additional_steps', []):
                if not self._execute_step(step):
                    success = False
                    break
                    
        # Save final state
        self._save_state()
        
        if success:
            logger.info("✨ Pipeline completed successfully!")
            self._generate_summary()
        else:
            logger.error("❌ Pipeline failed!")
            self._generate_error_report()
            
        return success
        
    def _execute_step(self, step: Dict[str, Any]) -> bool:
        """Execute a single pipeline step"""
        phase_name = step.get('agent') or step.get('tool')
        logger.info(f"\n🔄 Executing: {phase_name}")
        
        self.state['phases'][phase_name] = {
            'start': datetime.now().isoformat(),
            'status': 'running'
        }
        
        try:
            if 'agent' in step:
                result = self._run_agent(step['agent'], step.get('action'))
            else:
                result = self._run_tool(step['tool'], step.get('args', []))
                
            self.state['phases'][phase_name]['status'] = 'completed'
            self.state['phases'][phase_name]['end'] = datetime.now().isoformat()
            
            return result
            
        except Exception as e:
            logger.error(f"Error in {phase_name}: {e}")
            self.state['phases'][phase_name]['status'] = 'failed'
            self.state['phases'][phase_name]['error'] = str(e)
            self.state['errors'].append({
                'phase': phase_name,
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            })
            
            # Handle retries
            retries = step.get('retry_on_fail', 0)
            if retries > 0:
                logger.info(f"Retrying {phase_name} ({retries} attempts left)")
                step['retry_on_fail'] = retries - 1
                return self._execute_step(step)
                
            return False
            
    def _run_agent(self, agent_name: str, action: Optional[str] = None) -> bool:
        """Run a specific agent"""
        try:
            if agent_name in self.master.agents:
                agent = self.master.agents[agent_name]
                if action:
                    # Execute specific action
                    method = getattr(agent, action, None)
                    if method:
                        method()
                    else:
                        logger.warning(f"Action {action} not found on agent {agent_name}")
                return True
            else:
                # Try to get from registry
                agent = self.registry.get_agent(agent_name)
                if action and hasattr(agent, 'execute'):
                    agent.execute(action)
                return True
        except Exception as e:
            logger.error(f"Failed to run agent {agent_name}: {e}")
            return False
            
    def _run_tool(self, tool_name: str, args: List[str] = None) -> bool:
        """Run a specific tool"""
        tool_info = self.config['tools'].get(tool_name)
        if not tool_info:
            logger.error(f"Tool {tool_name} not found in configuration")
            return False
            
        script = tool_info['script']
        tool_type = tool_info['type']
        
        # Build command
        if tool_type == 'python':
            cmd = ['python3', script] + (args or [])
        elif tool_type == 'node':
            cmd = ['node', script] + (args or [])
        else:
            cmd = [script] + (args or [])
            
        # Check requirements
        requires = tool_info.get('requires', [])
        for req in requires:
            if req not in os.environ:
                logger.error(f"Missing required environment variable: {req}")
                return False
                
        # Execute tool
        try:
            result = subprocess.run(cmd, check=True, capture_output=True, text=True)
            if result.stdout:
                logger.info(result.stdout)
            return True
        except subprocess.CalledProcessError as e:
            logger.error(f"Tool {tool_name} failed: {e}")
            if e.stderr:
                logger.error(e.stderr)
            return False
            
    def _save_state(self):
        """Save pipeline state to file"""
        state_file = Path("pipeline-state.json")
        with open(state_file, 'w') as f:
            json.dump(self.state, f, indent=2)
            
    def _generate_summary(self):
        """Generate pipeline execution summary"""
        print("\n" + "="*60)
        print("📊 PIPELINE EXECUTION SUMMARY")
        print("="*60)
        print(f"Mode: {self.mode}")
        print(f"Project: {self.project.title}")
        print(f"Status: ✅ Success")
        
        # Phase summary
        print("\nPhases:")
        for phase, info in self.state['phases'].items():
            status_icon = "✅" if info['status'] == 'completed' else "❌"
            print(f"  {status_icon} {phase}: {info['status']}")
            
        # Duration
        start = datetime.fromisoformat(self.state['start_time'])
        duration = datetime.now() - start
        print(f"\nTotal Duration: {duration}")
        
        # Output locations
        print("\nOutputs:")
        pdf_files = list(Path("build/dist").glob("*.pdf"))
        epub_files = list(Path("build/dist").glob("*.epub"))
        
        if pdf_files:
            print(f"  📄 PDFs: {', '.join(f.name for f in pdf_files)}")
        if epub_files:
            print(f"  📚 EPUBs: {', '.join(f.name for f in epub_files)}")
            
    def _generate_error_report(self):
        """Generate error report"""
        print("\n" + "="*60)
        print("❌ PIPELINE ERROR REPORT")
        print("="*60)
        
        for error in self.state['errors']:
            print(f"\nPhase: {error['phase']}")
            print(f"Error: {error['error']}")
            print(f"Time: {error['timestamp']}")
            

def main():
    """CLI entry point"""
    import argparse
    import os
    
    parser = argparse.ArgumentParser(description='Unified Pipeline Orchestrator')
    parser.add_argument('--project', default='book-project.yaml', 
                       help='Project configuration file')
    parser.add_argument('--pipeline-config', default='pipeline-config.yaml',
                       help='Pipeline configuration file')
    parser.add_argument('--mode', choices=['quick', 'standard', 'premium', 'custom'],
                       default='standard', help='Pipeline mode')
    
    args = parser.parse_args()
    
    orchestrator = UnifiedPipelineOrchestrator(
        project_file=args.project,
        pipeline_config=args.pipeline_config,
        mode=args.mode
    )
    
    success = orchestrator.run_pipeline()
    sys.exit(0 if success else 1)
    

if __name__ == "__main__":
    main()