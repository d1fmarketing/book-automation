#!/usr/bin/env python3
"""
Advanced state management for pipeline persistence and recovery
Supports checkpointing, versioning, and distributed state
"""
import json
import logging
import pickle
import shutil
import threading
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Union
from dataclasses import dataclass, field, asdict
from contextlib import contextmanager
import fcntl
import hashlib

logger = logging.getLogger(__name__)


@dataclass
class StateCheckpoint:
    """Represents a state checkpoint"""
    id: str
    timestamp: datetime
    phase: str
    data: Dict[str, Any]
    metadata: Dict[str, Any] = field(default_factory=dict)
    checksum: Optional[str] = None
    
    def calculate_checksum(self) -> str:
        """Calculate checksum for data integrity"""
        data_str = json.dumps(self.data, sort_keys=True)
        return hashlib.sha256(data_str.encode()).hexdigest()
    
    def verify_integrity(self) -> bool:
        """Verify checkpoint integrity"""
        if not self.checksum:
            return True
        return self.calculate_checksum() == self.checksum


@dataclass
class StateHistory:
    """Track state history and versions"""
    checkpoints: List[StateCheckpoint] = field(default_factory=list)
    max_checkpoints: int = 100
    
    def add_checkpoint(self, checkpoint: StateCheckpoint):
        """Add a checkpoint to history"""
        self.checkpoints.append(checkpoint)
        
        # Maintain size limit
        if len(self.checkpoints) > self.max_checkpoints:
            self.checkpoints = self.checkpoints[-self.max_checkpoints:]
    
    def get_checkpoint(self, checkpoint_id: str) -> Optional[StateCheckpoint]:
        """Get checkpoint by ID"""
        for cp in self.checkpoints:
            if cp.id == checkpoint_id:
                return cp
        return None
    
    def get_latest(self, phase: Optional[str] = None) -> Optional[StateCheckpoint]:
        """Get latest checkpoint, optionally filtered by phase"""
        if not self.checkpoints:
            return None
        
        if phase:
            phase_checkpoints = [cp for cp in self.checkpoints if cp.phase == phase]
            return phase_checkpoints[-1] if phase_checkpoints else None
        
        return self.checkpoints[-1]


class StateManager:
    """Advanced state management with persistence and recovery"""
    
    def __init__(self, state_dir: Union[str, Path] = "pipeline-state"):
        self.state_dir = Path(state_dir)
        self.state_dir.mkdir(exist_ok=True)
        
        # State files
        self.current_state_file = self.state_dir / "current_state.json"
        self.history_file = self.state_dir / "state_history.pkl"
        self.lock_file = self.state_dir / ".state.lock"
        
        # In-memory state
        self._state: Dict[str, Any] = {}
        self._history = StateHistory()
        self._lock = threading.RLock()
        
        # Load existing state
        self._load_state()
    
    def _load_state(self):
        """Load state from disk"""
        try:
            # Load current state
            if self.current_state_file.exists():
                with open(self.current_state_file, 'r') as f:
                    self._state = json.load(f)
                logger.info(f"Loaded state from {self.current_state_file}")
            
            # Load history
            if self.history_file.exists():
                with open(self.history_file, 'rb') as f:
                    self._history = pickle.load(f)
                logger.info(f"Loaded {len(self._history.checkpoints)} checkpoints from history")
                
        except Exception as e:
            logger.error(f"Error loading state: {e}")
            # Initialize with empty state
            self._state = {}
            self._history = StateHistory()
    
    def _save_state(self):
        """Save state to disk"""
        try:
            # Atomic write with temporary file
            temp_file = self.current_state_file.with_suffix('.tmp')
            with open(temp_file, 'w') as f:
                json.dump(self._state, f, indent=2, default=str)
            
            # Atomic rename
            temp_file.replace(self.current_state_file)
            
            # Save history
            with open(self.history_file, 'wb') as f:
                pickle.dump(self._history, f)
                
        except Exception as e:
            logger.error(f"Error saving state: {e}")
            raise
    
    @contextmanager
    def _file_lock(self):
        """Acquire file lock for concurrent access"""
        lock_acquired = False
        lock_file = None
        
        try:
            lock_file = open(self.lock_file, 'w')
            fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX)
            lock_acquired = True
            yield
        finally:
            if lock_acquired and lock_file:
                fcntl.flock(lock_file.fileno(), fcntl.LOCK_UN)
                lock_file.close()
    
    def get(self, key: str, default: Any = None) -> Any:
        """Get value from state"""
        with self._lock:
            return self._state.get(key, default)
    
    def set(self, key: str, value: Any):
        """Set value in state"""
        with self._lock:
            self._state[key] = value
            self._save_state()
    
    def update(self, data: Dict[str, Any]):
        """Update multiple values in state"""
        with self._lock:
            self._state.update(data)
            self._save_state()
    
    def delete(self, key: str):
        """Delete key from state"""
        with self._lock:
            if key in self._state:
                del self._state[key]
                self._save_state()
    
    def clear(self):
        """Clear all state"""
        with self._lock:
            self._state.clear()
            self._save_state()
    
    def get_all(self) -> Dict[str, Any]:
        """Get complete state"""
        with self._lock:
            return self._state.copy()
    
    def create_checkpoint(self, phase: str, metadata: Optional[Dict[str, Any]] = None) -> str:
        """Create a state checkpoint"""
        with self._lock:
            checkpoint_id = f"{phase}_{datetime.now().strftime('%Y%m%d_%H%M%S_%f')}"
            
            checkpoint = StateCheckpoint(
                id=checkpoint_id,
                timestamp=datetime.now(),
                phase=phase,
                data=self._state.copy(),
                metadata=metadata or {}
            )
            checkpoint.checksum = checkpoint.calculate_checksum()
            
            self._history.add_checkpoint(checkpoint)
            self._save_state()
            
            logger.info(f"Created checkpoint: {checkpoint_id}")
            return checkpoint_id
    
    def restore_checkpoint(self, checkpoint_id: str) -> bool:
        """Restore state from checkpoint"""
        with self._lock:
            checkpoint = self._history.get_checkpoint(checkpoint_id)
            if not checkpoint:
                logger.error(f"Checkpoint not found: {checkpoint_id}")
                return False
            
            if not checkpoint.verify_integrity():
                logger.error(f"Checkpoint integrity check failed: {checkpoint_id}")
                return False
            
            # Backup current state before restore
            self.create_checkpoint(f"pre_restore_{checkpoint.phase}")
            
            # Restore state
            self._state = checkpoint.data.copy()
            self._save_state()
            
            logger.info(f"Restored checkpoint: {checkpoint_id}")
            return True
    
    def list_checkpoints(self, phase: Optional[str] = None) -> List[Dict[str, Any]]:
        """List available checkpoints"""
        with self._lock:
            checkpoints = self._history.checkpoints
            
            if phase:
                checkpoints = [cp for cp in checkpoints if cp.phase == phase]
            
            return [
                {
                    'id': cp.id,
                    'timestamp': cp.timestamp.isoformat(),
                    'phase': cp.phase,
                    'metadata': cp.metadata
                }
                for cp in checkpoints
            ]
    
    def export_state(self, export_path: Union[str, Path]) -> bool:
        """Export complete state to file"""
        try:
            export_path = Path(export_path)
            export_data = {
                'state': self._state,
                'history': [asdict(cp) for cp in self._history.checkpoints],
                'exported_at': datetime.now().isoformat(),
                'version': '1.0'
            }
            
            with open(export_path, 'w') as f:
                json.dump(export_data, f, indent=2, default=str)
            
            logger.info(f"Exported state to {export_path}")
            return True
            
        except Exception as e:
            logger.error(f"Error exporting state: {e}")
            return False
    
    def import_state(self, import_path: Union[str, Path]) -> bool:
        """Import state from file"""
        try:
            import_path = Path(import_path)
            
            with open(import_path, 'r') as f:
                import_data = json.load(f)
            
            # Validate version
            if import_data.get('version') != '1.0':
                logger.error(f"Unsupported state version: {import_data.get('version')}")
                return False
            
            # Backup current state
            self.create_checkpoint('pre_import')
            
            # Import state
            with self._lock:
                self._state = import_data['state']
                
                # Reconstruct history
                self._history = StateHistory()
                for cp_data in import_data.get('history', []):
                    checkpoint = StateCheckpoint(
                        id=cp_data['id'],
                        timestamp=datetime.fromisoformat(cp_data['timestamp']),
                        phase=cp_data['phase'],
                        data=cp_data['data'],
                        metadata=cp_data.get('metadata', {}),
                        checksum=cp_data.get('checksum')
                    )
                    self._history.add_checkpoint(checkpoint)
                
                self._save_state()
            
            logger.info(f"Imported state from {import_path}")
            return True
            
        except Exception as e:
            logger.error(f"Error importing state: {e}")
            return False
    
    def cleanup_old_checkpoints(self, keep_days: int = 7):
        """Clean up old checkpoints"""
        with self._lock:
            cutoff_date = datetime.now() - timedelta(days=keep_days)
            
            old_count = len(self._history.checkpoints)
            self._history.checkpoints = [
                cp for cp in self._history.checkpoints
                if cp.timestamp > cutoff_date
            ]
            
            removed = old_count - len(self._history.checkpoints)
            if removed > 0:
                self._save_state()
                logger.info(f"Cleaned up {removed} old checkpoints")
    
    def get_state_metrics(self) -> Dict[str, Any]:
        """Get state metrics for monitoring"""
        with self._lock:
            return {
                'state_size': len(json.dumps(self._state)),
                'checkpoint_count': len(self._history.checkpoints),
                'oldest_checkpoint': (
                    self._history.checkpoints[0].timestamp.isoformat()
                    if self._history.checkpoints else None
                ),
                'latest_checkpoint': (
                    self._history.checkpoints[-1].timestamp.isoformat()
                    if self._history.checkpoints else None
                ),
                'state_keys': list(self._state.keys())
            }


# Global state manager instance
_state_manager: Optional[StateManager] = None


def get_state_manager(state_dir: Optional[str] = None) -> StateManager:
    """Get or create global state manager instance"""
    global _state_manager
    
    if _state_manager is None:
        _state_manager = StateManager(state_dir or "pipeline-state")
    
    return _state_manager


# Convenience functions
def save_pipeline_state(phase: str, data: Dict[str, Any], create_checkpoint: bool = True):
    """Save pipeline state with optional checkpoint"""
    manager = get_state_manager()
    manager.update(data)
    
    if create_checkpoint:
        return manager.create_checkpoint(phase)
    
    return None


def load_pipeline_state() -> Dict[str, Any]:
    """Load current pipeline state"""
    manager = get_state_manager()
    return manager.get_all()


def restore_pipeline_checkpoint(checkpoint_id: str) -> bool:
    """Restore pipeline to specific checkpoint"""
    manager = get_state_manager()
    return manager.restore_checkpoint(checkpoint_id)