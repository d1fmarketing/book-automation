#!/usr/bin/env python3
"""
Monitor Agent: Responsible for real-time monitoring and status tracking
Provides WebSocket server for live updates and metrics collection
"""

import os
import json
import logging
import asyncio
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field, asdict
import aiofiles
from collections import defaultdict
import psutil

logger = logging.getLogger('MonitorAgent')


@dataclass
class AgentMetrics:
    """Metrics for a single agent"""
    name: str
    status: str = "idle"  # idle, running, completed, error
    start_time: Optional[float] = None
    end_time: Optional[float] = None
    duration_seconds: float = 0.0
    memory_usage_mb: float = 0.0
    cpu_percent: float = 0.0
    events: List[Dict[str, Any]] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)
    

@dataclass
class PipelineMetrics:
    """Overall pipeline metrics"""
    pipeline_id: str
    project_name: str
    start_time: float
    end_time: Optional[float] = None
    total_duration_seconds: float = 0.0
    agents: Dict[str, AgentMetrics] = field(default_factory=dict)
    status: str = "initializing"  # initializing, running, completed, failed
    progress_percent: float = 0.0
    current_stage: str = ""
    

class MonitorAgent:
    """
    Agent responsible for monitoring pipeline execution
    Provides real-time status updates and performance metrics
    """
    
    def __init__(self, project_path: str = ".", websocket_manager=None):
        self.project_path = Path(project_path)
        self.websocket_manager = websocket_manager
        self.metrics_dir = self.project_path / "build" / "metrics"
        
        # Current pipeline metrics
        self.current_pipeline: Optional[PipelineMetrics] = None
        
        # Historical metrics
        self.historical_metrics: List[PipelineMetrics] = []
        
        # Agent status tracking
        self.agent_status = {
            "content": "idle",
            "format": "idle",
            "quality": "idle",
            "monitor": "running",
            "publish": "idle"
        }
        
        # Performance tracking
        self.performance_data = defaultdict(list)
        
        # System metrics
        self.system_metrics = {
            "cpu_percent": 0.0,
            "memory_percent": 0.0,
            "disk_usage_percent": 0.0
        }
        
    async def initialize(self):
        """Initialize the monitor agent"""
        logger.info("Initializing Monitor Agent...")
        
        # Ensure metrics directory exists
        self.metrics_dir.mkdir(parents=True, exist_ok=True)
        
        # Load historical metrics
        await self.load_historical_metrics()
        
        # Start system monitoring
        asyncio.create_task(self.monitor_system_resources())
        
        await self._notify_status("initialized", {"agent": "monitor"})
        
    async def _notify_status(self, status: str, data: Dict[str, Any]):
        """Send status update via websocket if available"""
        if self.websocket_manager:
            await self.websocket_manager.broadcast({
                "type": "status",
                "source": "monitor",
                "target": "all",
                "data": {
                    "agent": "monitor",
                    "status": status,
                    **data
                }
            })
            
    async def monitor_system_resources(self):
        """Continuously monitor system resources"""
        while True:
            try:
                # CPU usage
                self.system_metrics["cpu_percent"] = psutil.cpu_percent(interval=1)
                
                # Memory usage
                memory = psutil.virtual_memory()
                self.system_metrics["memory_percent"] = memory.percent
                
                # Disk usage
                disk = psutil.disk_usage('/')
                self.system_metrics["disk_usage_percent"] = disk.percent
                
                # Broadcast system metrics
                await self._notify_status("system_metrics", self.system_metrics)
                
                await asyncio.sleep(5)  # Update every 5 seconds
                
            except Exception as e:
                logger.error(f"Error monitoring system resources: {e}")
                await asyncio.sleep(10)
                
    async def start_pipeline(self, project_name: str) -> str:
        """Start monitoring a new pipeline execution"""
        pipeline_id = f"pipeline_{int(time.time())}"
        
        self.current_pipeline = PipelineMetrics(
            pipeline_id=pipeline_id,
            project_name=project_name,
            start_time=time.time(),
            agents={
                "content": AgentMetrics(name="content"),
                "format": AgentMetrics(name="format"),
                "quality": AgentMetrics(name="quality"),
                "monitor": AgentMetrics(name="monitor", status="running"),
                "publish": AgentMetrics(name="publish")
            }
        )
        
        logger.info(f"Started monitoring pipeline: {pipeline_id}")
        
        await self._notify_status("pipeline_started", {
            "pipeline_id": pipeline_id,
            "project_name": project_name
        })
        
        return pipeline_id
        
    async def update_agent_status(self, agent_name: str, status: str, data: Optional[Dict[str, Any]] = None):
        """Update the status of a specific agent"""
        if not self.current_pipeline:
            logger.warning(f"No active pipeline to update agent {agent_name}")
            return
            
        if agent_name not in self.current_pipeline.agents:
            logger.warning(f"Unknown agent: {agent_name}")
            return
            
        agent_metrics = self.current_pipeline.agents[agent_name]
        agent_metrics.status = status
        
        # Track timing
        if status == "running" and agent_metrics.start_time is None:
            agent_metrics.start_time = time.time()
        elif status in ["completed", "error"] and agent_metrics.start_time:
            agent_metrics.end_time = time.time()
            agent_metrics.duration_seconds = agent_metrics.end_time - agent_metrics.start_time
            
        # Track resource usage
        process = psutil.Process()
        agent_metrics.memory_usage_mb = process.memory_info().rss / 1024 / 1024
        agent_metrics.cpu_percent = process.cpu_percent()
        
        # Add event
        event = {
            "timestamp": time.time(),
            "status": status,
            "data": data or {}
        }
        agent_metrics.events.append(event)
        
        # Update pipeline progress
        await self.update_pipeline_progress()
        
        # Broadcast update
        await self._notify_status("agent_status_update", {
            "agent": agent_name,
            "status": status,
            "metrics": asdict(agent_metrics)
        })
        
        logger.info(f"Agent {agent_name} status updated to: {status}")
        
    async def update_pipeline_progress(self):
        """Calculate and update overall pipeline progress"""
        if not self.current_pipeline:
            return
            
        # Calculate progress based on agent completion
        completed_agents = sum(
            1 for agent in self.current_pipeline.agents.values()
            if agent.status == "completed"
        )
        
        total_agents = len(self.current_pipeline.agents) - 1  # Exclude monitor agent
        self.current_pipeline.progress_percent = (completed_agents / total_agents) * 100
        
        # Determine current stage
        if self.current_pipeline.agents["content"].status == "running":
            self.current_pipeline.current_stage = "Processing content"
        elif self.current_pipeline.agents["format"].status == "running":
            self.current_pipeline.current_stage = "Formatting PDF"
        elif self.current_pipeline.agents["quality"].status == "running":
            self.current_pipeline.current_stage = "Quality assurance"
        elif self.current_pipeline.agents["publish"].status == "running":
            self.current_pipeline.current_stage = "Publishing"
        elif completed_agents == total_agents:
            self.current_pipeline.current_stage = "Completed"
            self.current_pipeline.status = "completed"
        else:
            self.current_pipeline.current_stage = "Initializing"
            
        # Broadcast progress
        await self._notify_status("pipeline_progress", {
            "progress_percent": self.current_pipeline.progress_percent,
            "current_stage": self.current_pipeline.current_stage,
            "status": self.current_pipeline.status
        })
        
    async def record_error(self, agent_name: str, error_message: str):
        """Record an error for a specific agent"""
        if not self.current_pipeline:
            return
            
        if agent_name in self.current_pipeline.agents:
            self.current_pipeline.agents[agent_name].errors.append(error_message)
            self.current_pipeline.agents[agent_name].status = "error"
            
        await self._notify_status("agent_error", {
            "agent": agent_name,
            "error": error_message
        })
        
        logger.error(f"Agent {agent_name} error: {error_message}")
        
    async def complete_pipeline(self, success: bool = True):
        """Mark the pipeline as completed"""
        if not self.current_pipeline:
            return
            
        self.current_pipeline.end_time = time.time()
        self.current_pipeline.total_duration_seconds = (
            self.current_pipeline.end_time - self.current_pipeline.start_time
        )
        self.current_pipeline.status = "completed" if success else "failed"
        
        # Save metrics
        await self.save_metrics()
        
        # Add to historical metrics
        self.historical_metrics.append(self.current_pipeline)
        
        await self._notify_status("pipeline_completed", {
            "pipeline_id": self.current_pipeline.pipeline_id,
            "success": success,
            "duration_seconds": self.current_pipeline.total_duration_seconds,
            "final_metrics": asdict(self.current_pipeline)
        })
        
        logger.info(f"Pipeline completed: {self.current_pipeline.pipeline_id} "
                   f"(success={success}, duration={self.current_pipeline.total_duration_seconds:.2f}s)")
                   
    async def save_metrics(self):
        """Save current pipeline metrics to file"""
        if not self.current_pipeline:
            return
            
        metrics_file = self.metrics_dir / f"{self.current_pipeline.pipeline_id}.json"
        
        async with aiofiles.open(metrics_file, 'w') as f:
            await f.write(json.dumps(asdict(self.current_pipeline), indent=2))
            
        logger.info(f"Metrics saved to: {metrics_file}")
        
    async def load_historical_metrics(self):
        """Load historical metrics from files"""
        self.historical_metrics = []
        
        for metrics_file in self.metrics_dir.glob("pipeline_*.json"):
            try:
                async with aiofiles.open(metrics_file, 'r') as f:
                    data = json.loads(await f.read())
                    # Convert dict back to PipelineMetrics
                    # (simplified for now)
                    self.historical_metrics.append(data)
                    
            except Exception as e:
                logger.error(f"Error loading metrics from {metrics_file}: {e}")
                
        logger.info(f"Loaded {len(self.historical_metrics)} historical pipeline runs")
        
    async def get_dashboard_data(self) -> Dict[str, Any]:
        """Get current data for dashboard display"""
        dashboard_data = {
            "current_pipeline": None,
            "agent_status": self.agent_status,
            "system_metrics": self.system_metrics,
            "historical_summary": {
                "total_runs": len(self.historical_metrics),
                "average_duration": 0,
                "success_rate": 0
            }
        }
        
        if self.current_pipeline:
            dashboard_data["current_pipeline"] = asdict(self.current_pipeline)
            
        # Calculate historical summary
        if self.historical_metrics:
            durations = [m.get("total_duration_seconds", 0) for m in self.historical_metrics]
            dashboard_data["historical_summary"]["average_duration"] = sum(durations) / len(durations)
            
            successful = sum(1 for m in self.historical_metrics if m.get("status") == "completed")
            dashboard_data["historical_summary"]["success_rate"] = (successful / len(self.historical_metrics)) * 100
            
        return dashboard_data
        
    async def get_agent_timeline(self, agent_name: str) -> List[Dict[str, Any]]:
        """Get timeline of events for a specific agent"""
        if not self.current_pipeline or agent_name not in self.current_pipeline.agents:
            return []
            
        agent = self.current_pipeline.agents[agent_name]
        return agent.events
        

# Standalone execution for testing
if __name__ == "__main__":
    async def main():
        monitor = MonitorAgent()
        await monitor.initialize()
        
        # Start a test pipeline
        pipeline_id = await monitor.start_pipeline("test-project")
        
        # Simulate agent updates
        await asyncio.sleep(1)
        await monitor.update_agent_status("content", "running")
        
        await asyncio.sleep(2)
        await monitor.update_agent_status("content", "completed", {"chapters": 5})
        
        await asyncio.sleep(1)
        await monitor.update_agent_status("format", "running")
        
        # Get dashboard data
        dashboard = await monitor.get_dashboard_data()
        print(f"\nDashboard Data:")
        print(json.dumps(dashboard, indent=2))
        
        # Complete pipeline
        await monitor.complete_pipeline(success=True)
        
    asyncio.run(main())