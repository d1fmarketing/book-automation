#!/usr/bin/env python3
"""
WebSocket Manager: Handles real-time communication between agents
Provides pub/sub pattern for agent coordination
"""

import asyncio
import json
import logging
from typing import Dict, List, Set, Any, Callable
from datetime import datetime
import websockets
from websockets.server import WebSocketServerProtocol
from dataclasses import dataclass, asdict
from collections import defaultdict

logger = logging.getLogger('WebSocketManager')


@dataclass
class Message:
    """WebSocket message structure"""
    type: str  # event, status, command, response
    source: str  # agent name or client
    target: str  # agent name, 'all', or client id
    data: Dict[str, Any]
    timestamp: str = ""
    message_id: str = ""
    
    def __post_init__(self):
        if not self.timestamp:
            self.timestamp = datetime.now().isoformat()
        if not self.message_id:
            import uuid
            self.message_id = str(uuid.uuid4())
            
    def to_json(self) -> str:
        """Convert message to JSON string"""
        return json.dumps(asdict(self))
        
    @classmethod
    def from_json(cls, json_str: str) -> 'Message':
        """Create message from JSON string"""
        data = json.loads(json_str)
        return cls(**data)


class WebSocketManager:
    """
    Central WebSocket manager for agent communication
    Implements pub/sub pattern for event-driven architecture
    """
    
    def __init__(self, host: str = "localhost", port: int = 8765):
        self.host = host
        self.port = port
        self.server = None
        
        # Connected clients
        self.clients: Set[WebSocketServerProtocol] = set()
        self.client_info: Dict[WebSocketServerProtocol, Dict[str, Any]] = {}
        
        # Agent connections
        self.agents: Dict[str, WebSocketServerProtocol] = {}
        
        # Event subscriptions
        self.subscriptions: Dict[str, List[Callable]] = defaultdict(list)
        
        # Message history for debugging
        self.message_history: List[Message] = []
        self.max_history = 1000
        
    async def start_server(self):
        """Start the WebSocket server"""
        logger.info(f"Starting WebSocket server on {self.host}:{self.port}")
        
        self.server = await websockets.serve(
            self.handle_client,
            self.host,
            self.port
        )
        
        logger.info(f"WebSocket server started on ws://{self.host}:{self.port}")
        
    async def stop_server(self):
        """Stop the WebSocket server"""
        if self.server:
            self.server.close()
            await self.server.wait_closed()
            logger.info("WebSocket server stopped")
            
    async def handle_client(self, websocket: WebSocketServerProtocol, path: str):
        """Handle new client connections"""
        # Register client
        self.clients.add(websocket)
        client_id = f"client_{id(websocket)}"
        
        self.client_info[websocket] = {
            "id": client_id,
            "connected_at": datetime.now().isoformat(),
            "path": path
        }
        
        logger.info(f"New client connected: {client_id} from {websocket.remote_address}")
        
        # Send welcome message
        welcome_msg = Message(
            type="event",
            source="websocket_manager",
            target=client_id,
            data={
                "event": "connected",
                "client_id": client_id,
                "server_time": datetime.now().isoformat()
            }
        )
        
        await websocket.send(welcome_msg.to_json())
        
        try:
            # Handle messages from client
            async for message in websocket:
                await self.handle_message(websocket, message)
                
        except websockets.ConnectionClosed:
            logger.info(f"Client {client_id} disconnected")
            
        finally:
            # Unregister client
            self.clients.remove(websocket)
            
            # Remove from agents if it was an agent
            agent_name = None
            for name, ws in self.agents.items():
                if ws == websocket:
                    agent_name = name
                    break
                    
            if agent_name:
                del self.agents[agent_name]
                logger.info(f"Agent {agent_name} disconnected")
                
                # Notify others about agent disconnection
                await self.broadcast({
                    "type": "event",
                    "source": "websocket_manager",
                    "data": {
                        "event": "agent_disconnected",
                        "agent": agent_name
                    }
                })
                
            # Clean up client info
            if websocket in self.client_info:
                del self.client_info[websocket]
                
    async def handle_message(self, websocket: WebSocketServerProtocol, raw_message: str):
        """Process incoming messages"""
        try:
            message = Message.from_json(raw_message)
            
            # Add to history
            self.message_history.append(message)
            if len(self.message_history) > self.max_history:
                self.message_history.pop(0)
                
            logger.debug(f"Received message: {message.type} from {message.source} to {message.target}")
            
            # Handle registration messages
            if message.type == "register" and message.data.get("agent_name"):
                agent_name = message.data["agent_name"]
                self.agents[agent_name] = websocket
                logger.info(f"Agent registered: {agent_name}")
                
                # Send confirmation
                confirm_msg = Message(
                    type="response",
                    source="websocket_manager",
                    target=agent_name,
                    data={
                        "status": "registered",
                        "agent_name": agent_name
                    }
                )
                await websocket.send(confirm_msg.to_json())
                
                # Notify others about new agent
                await self.broadcast({
                    "type": "event",
                    "source": "websocket_manager",
                    "data": {
                        "event": "agent_connected",
                        "agent": agent_name
                    }
                }, exclude=websocket)
                
            # Route messages to target
            elif message.target == "all":
                await self.broadcast(message, exclude=websocket)
                
            elif message.target in self.agents:
                target_ws = self.agents[message.target]
                await target_ws.send(message.to_json())
                
            elif message.target.startswith("client_"):
                # Find client by ID
                for ws, info in self.client_info.items():
                    if info["id"] == message.target:
                        await ws.send(message.to_json())
                        break
                        
            # Handle subscriptions
            if message.type == "subscribe":
                event_name = message.data.get("event")
                if event_name:
                    # Store subscription (simplified for now)
                    logger.info(f"{message.source} subscribed to {event_name}")
                    
            # Trigger event handlers
            await self.trigger_event(message)
            
        except json.JSONDecodeError:
            logger.error(f"Invalid JSON received: {raw_message}")
            error_msg = Message(
                type="error",
                source="websocket_manager",
                target="sender",
                data={"error": "Invalid JSON format"}
            )
            await websocket.send(error_msg.to_json())
            
        except Exception as e:
            logger.error(f"Error handling message: {e}")
            error_msg = Message(
                type="error",
                source="websocket_manager",
                target="sender",
                data={"error": str(e)}
            )
            await websocket.send(error_msg.to_json())
            
    async def broadcast(self, message: Any, exclude: WebSocketServerProtocol = None):
        """Broadcast message to all connected clients"""
        if isinstance(message, dict):
            message = Message(**message)
            
        if not isinstance(message, Message):
            raise ValueError("Message must be a Message instance or dict")
            
        message.target = "all"
        json_msg = message.to_json()
        
        # Send to all clients except excluded one
        disconnected_clients = []
        
        for client in self.clients:
            if client != exclude:
                try:
                    await client.send(json_msg)
                except websockets.ConnectionClosed:
                    disconnected_clients.append(client)
                    
        # Clean up disconnected clients
        for client in disconnected_clients:
            self.clients.remove(client)
            
    async def send_to_agent(self, agent_name: str, message: Any):
        """Send message to specific agent"""
        if agent_name not in self.agents:
            logger.warning(f"Agent {agent_name} not connected")
            return False
            
        if isinstance(message, dict):
            message = Message(**message)
            
        message.target = agent_name
        
        try:
            await self.agents[agent_name].send(message.to_json())
            return True
            
        except websockets.ConnectionClosed:
            logger.warning(f"Agent {agent_name} disconnected during send")
            del self.agents[agent_name]
            return False
            
    async def trigger_event(self, message: Message):
        """Trigger event handlers"""
        if message.type == "event":
            event_name = message.data.get("event")
            if event_name and event_name in self.subscriptions:
                for handler in self.subscriptions[event_name]:
                    try:
                        await handler(message)
                    except Exception as e:
                        logger.error(f"Error in event handler for {event_name}: {e}")
                        
    def subscribe(self, event_name: str, handler: Callable):
        """Subscribe to an event"""
        self.subscriptions[event_name].append(handler)
        logger.info(f"Handler subscribed to event: {event_name}")
        
    def unsubscribe(self, event_name: str, handler: Callable):
        """Unsubscribe from an event"""
        if event_name in self.subscriptions:
            self.subscriptions[event_name].remove(handler)
            
    async def get_connected_agents(self) -> List[str]:
        """Get list of connected agents"""
        return list(self.agents.keys())
        
    async def get_status(self) -> Dict[str, Any]:
        """Get WebSocket server status"""
        return {
            "server": f"ws://{self.host}:{self.port}",
            "connected_clients": len(self.clients),
            "connected_agents": list(self.agents.keys()),
            "message_history_size": len(self.message_history),
            "subscriptions": {k: len(v) for k, v in self.subscriptions.items()}
        }


# Agent connection helper class
class AgentWebSocketClient:
    """Helper class for agents to connect to WebSocket manager"""
    
    def __init__(self, agent_name: str, websocket_url: str = "ws://localhost:8765"):
        self.agent_name = agent_name
        self.websocket_url = websocket_url
        self.websocket = None
        self.running = False
        
    async def connect(self):
        """Connect to WebSocket server"""
        self.websocket = await websockets.connect(self.websocket_url)
        self.running = True
        
        # Register as agent
        register_msg = Message(
            type="register",
            source=self.agent_name,
            target="websocket_manager",
            data={"agent_name": self.agent_name}
        )
        
        await self.websocket.send(register_msg.to_json())
        logger.info(f"Agent {self.agent_name} connected to WebSocket server")
        
    async def disconnect(self):
        """Disconnect from WebSocket server"""
        self.running = False
        if self.websocket:
            await self.websocket.close()
            
    async def send_status(self, status: str, data: Dict[str, Any]):
        """Send status update"""
        if not self.websocket:
            return
            
        message = Message(
            type="status",
            source=self.agent_name,
            target="all",
            data={
                "status": status,
                **data
            }
        )
        
        await self.websocket.send(message.to_json())
        
    async def broadcast_event(self, event: str, data: Dict[str, Any]):
        """Broadcast an event"""
        if not self.websocket:
            return
            
        message = Message(
            type="event",
            source=self.agent_name,
            target="all",
            data={
                "event": event,
                **data
            }
        )
        
        await self.websocket.send(message.to_json())
        
    async def listen(self, message_handler: Callable):
        """Listen for incoming messages"""
        if not self.websocket:
            return
            
        try:
            async for message in self.websocket:
                msg = Message.from_json(message)
                await message_handler(msg)
                
        except websockets.ConnectionClosed:
            logger.info(f"Agent {self.agent_name} disconnected from server")
            self.running = False


# Standalone server for testing
if __name__ == "__main__":
    async def main():
        manager = WebSocketManager()
        
        # Start server
        await manager.start_server()
        
        print(f"WebSocket server running on ws://localhost:8765")
        print("Press Ctrl+C to stop")
        
        try:
            # Keep server running
            await asyncio.Future()
            
        except KeyboardInterrupt:
            print("\nShutting down...")
            
        finally:
            await manager.stop_server()
            
    asyncio.run(main())