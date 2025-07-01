#!/usr/bin/env python3
"""
Agent Registry - Central registry for all pipeline agents
Provides discovery, capability matching, and dependency management
"""
import importlib
import logging
import yaml
from pathlib import Path
from typing import Dict, List, Any, Optional, Type
from dataclasses import dataclass
from abc import ABC, abstractmethod

logger = logging.getLogger(__name__)


@dataclass
class AgentInfo:
    """Information about a registered agent"""
    name: str
    module: str
    class_name: str
    description: str
    capabilities: List[str]
    dependencies: List[str]
    instance: Optional[Any] = None
    

class BaseAgent(ABC):
    """Base class for all pipeline agents"""
    
    @abstractmethod
    def get_capabilities(self) -> List[str]:
        """Return list of capabilities this agent provides"""
        pass
        
    @abstractmethod
    def get_dependencies(self) -> List[str]:
        """Return list of other agents this agent depends on"""
        pass
        
    @abstractmethod
    def execute(self, action: str, **kwargs) -> Any:
        """Execute a specific action"""
        pass


class AgentRegistry:
    """Central registry for all pipeline agents"""
    
    def __init__(self, config_path: str = "pipeline-config.yaml"):
        self.agents: Dict[str, AgentInfo] = {}
        self.config = self._load_config(config_path)
        self._register_agents()
        
    def _load_config(self, config_path: str) -> Dict[str, Any]:
        """Load pipeline configuration"""
        config_file = Path(config_path)
        if not config_file.exists():
            logger.warning(f"Config file {config_path} not found, using defaults")
            return {"agents": {}}
            
        with open(config_file, 'r') as f:
            return yaml.safe_load(f)
            
    def _register_agents(self):
        """Register all agents from configuration"""
        agents_config = self.config.get('agents', {})
        
        for agent_name, agent_info in agents_config.items():
            try:
                self.register_agent(
                    name=agent_name,
                    module=agent_info['module'],
                    class_name=agent_info['class'],
                    description=agent_info.get('description', ''),
                    capabilities=agent_info.get('capabilities', []),
                    dependencies=agent_info.get('dependencies', [])
                )
                logger.info(f"Registered agent: {agent_name}")
            except Exception as e:
                logger.error(f"Failed to register agent {agent_name}: {e}")
                
    def register_agent(self, name: str, module: str, class_name: str,
                      description: str = "", capabilities: List[str] = None,
                      dependencies: List[str] = None):
        """Register a new agent"""
        self.agents[name] = AgentInfo(
            name=name,
            module=module,
            class_name=class_name,
            description=description,
            capabilities=capabilities or [],
            dependencies=dependencies or []
        )
        
    def get_agent(self, name: str, **init_kwargs) -> Any:
        """Get an agent instance by name"""
        if name not in self.agents:
            raise ValueError(f"Agent '{name}' not registered")
            
        agent_info = self.agents[name]
        
        # Return existing instance if available
        if agent_info.instance:
            return agent_info.instance
            
        # Create new instance
        try:
            module = importlib.import_module(agent_info.module)
            agent_class = getattr(module, agent_info.class_name)
            agent_info.instance = agent_class(**init_kwargs)
            return agent_info.instance
        except Exception as e:
            logger.error(f"Failed to instantiate agent {name}: {e}")
            raise
            
    def find_agents_by_capability(self, capability: str) -> List[str]:
        """Find all agents that provide a specific capability"""
        matching_agents = []
        for name, info in self.agents.items():
            if capability in info.capabilities:
                matching_agents.append(name)
        return matching_agents
        
    def get_agent_dependencies(self, name: str) -> List[str]:
        """Get dependencies for an agent"""
        if name not in self.agents:
            return []
        return self.agents[name].dependencies
        
    def get_initialization_order(self) -> List[str]:
        """Get agents in order they should be initialized (respecting dependencies)"""
        # Simple topological sort
        visited = set()
        order = []
        
        def visit(name: str):
            if name in visited:
                return
            visited.add(name)
            
            # Visit dependencies first
            for dep in self.get_agent_dependencies(name):
                if dep in self.agents:
                    visit(dep)
                    
            order.append(name)
            
        # Visit all agents
        for agent_name in self.agents:
            visit(agent_name)
            
        return order
        
    def list_agents(self) -> Dict[str, Dict[str, Any]]:
        """List all registered agents with their info"""
        agents_list = {}
        for name, info in self.agents.items():
            agents_list[name] = {
                'description': info.description,
                'capabilities': info.capabilities,
                'dependencies': info.dependencies,
                'module': info.module,
                'loaded': info.instance is not None
            }
        return agents_list
        
    def validate_workflow(self, workflow_steps: List[Dict[str, str]]) -> List[str]:
        """Validate a workflow has all required agents"""
        errors = []
        
        for step in workflow_steps:
            agent_name = step.get('agent')
            tool_name = step.get('tool')
            
            if agent_name and agent_name not in self.agents:
                errors.append(f"Agent '{agent_name}' not found in registry")
                
            # TODO: Add tool validation once tool registry is implemented
                
        return errors
        
    def get_workflow(self, workflow_name: str) -> Optional[Dict[str, Any]]:
        """Get a predefined workflow from configuration"""
        workflows = self.config.get('workflows', {})
        return workflows.get(workflow_name)


# Singleton instance
_registry_instance = None


def get_registry(config_path: str = "pipeline-config.yaml") -> AgentRegistry:
    """Get the singleton registry instance"""
    global _registry_instance
    if _registry_instance is None:
        _registry_instance = AgentRegistry(config_path)
    return _registry_instance


def list_available_agents():
    """Utility function to list all available agents"""
    registry = get_registry()
    agents = registry.list_agents()
    
    print("\n🤖 Available Pipeline Agents:")
    print("=" * 60)
    
    for name, info in agents.items():
        status = "✅" if info['loaded'] else "⚪"
        print(f"\n{status} {name}")
        print(f"   Description: {info['description']}")
        print(f"   Capabilities: {', '.join(info['capabilities'])}")
        if info['dependencies']:
            print(f"   Dependencies: {', '.join(info['dependencies'])}")
            

if __name__ == "__main__":
    # Test the registry
    list_available_agents()