#!/usr/bin/env python3
"""
Advanced retry strategies for pipeline robustness
Implements infinite retry with exponential backoff, circuit breaker, and jitter
"""
import asyncio
import logging
import random
import time
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Callable, Optional, Any, Dict, List
from functools import wraps

logger = logging.getLogger(__name__)


class RetryState(Enum):
    """State of retry mechanism"""
    READY = "ready"
    RETRYING = "retrying"
    CIRCUIT_OPEN = "circuit_open"
    EXHAUSTED = "exhausted"


@dataclass
class RetryConfig:
    """Configuration for retry behavior"""
    mode: str = "infinite"  # "infinite" or "fixed"
    max_attempts: Optional[int] = None  # None for infinite
    max_duration: int = 86400  # 24 hours in seconds
    base_delay: float = 1.0  # Base delay in seconds
    max_delay: float = 300.0  # Maximum delay between retries (5 minutes)
    exponential_base: float = 2.0  # Exponential backoff base
    jitter: bool = True  # Add randomness to prevent thundering herd
    
    # Circuit breaker settings
    circuit_breaker_enabled: bool = True
    failure_threshold: int = 5  # Consecutive failures to open circuit
    recovery_timeout: int = 300  # Seconds before trying again when circuit is open
    success_threshold: int = 2  # Successful attempts needed to close circuit
    
    # Hooks and callbacks
    on_retry: Optional[Callable] = None
    on_circuit_open: Optional[Callable] = None
    on_circuit_close: Optional[Callable] = None
    on_exhausted: Optional[Callable] = None


@dataclass
class RetryStatistics:
    """Track retry statistics"""
    total_attempts: int = 0
    successful_attempts: int = 0
    failed_attempts: int = 0
    consecutive_failures: int = 0
    consecutive_successes: int = 0
    circuit_opened_count: int = 0
    start_time: datetime = field(default_factory=datetime.now)
    last_attempt_time: Optional[datetime] = None
    last_success_time: Optional[datetime] = None
    last_failure_time: Optional[datetime] = None
    error_history: List[Dict[str, Any]] = field(default_factory=list)


class CircuitBreaker:
    """Circuit breaker implementation"""
    
    def __init__(self, config: RetryConfig):
        self.config = config
        self.state = RetryState.READY
        self.stats = RetryStatistics()
        self.circuit_opened_at: Optional[datetime] = None
    
    def record_success(self):
        """Record a successful attempt"""
        self.stats.successful_attempts += 1
        self.stats.consecutive_successes += 1
        self.stats.consecutive_failures = 0
        self.stats.last_success_time = datetime.now()
        
        # Close circuit if threshold met
        if (self.state == RetryState.CIRCUIT_OPEN and 
            self.stats.consecutive_successes >= self.config.success_threshold):
            self.close_circuit()
    
    def record_failure(self, error: Exception):
        """Record a failed attempt"""
        self.stats.failed_attempts += 1
        self.stats.consecutive_failures += 1
        self.stats.consecutive_successes = 0
        self.stats.last_failure_time = datetime.now()
        
        # Track error history
        self.stats.error_history.append({
            'timestamp': datetime.now().isoformat(),
            'error_type': type(error).__name__,
            'error_message': str(error),
            'attempt_number': self.stats.total_attempts
        })
        
        # Keep only last 100 errors
        if len(self.stats.error_history) > 100:
            self.stats.error_history = self.stats.error_history[-100:]
        
        # Open circuit if threshold met
        if (self.config.circuit_breaker_enabled and 
            self.stats.consecutive_failures >= self.config.failure_threshold and
            self.state != RetryState.CIRCUIT_OPEN):
            self.open_circuit()
    
    def open_circuit(self):
        """Open the circuit breaker"""
        self.state = RetryState.CIRCUIT_OPEN
        self.circuit_opened_at = datetime.now()
        self.stats.circuit_opened_count += 1
        logger.warning(f"Circuit breaker opened after {self.stats.consecutive_failures} failures")
        
        if self.config.on_circuit_open:
            self.config.on_circuit_open(self.stats)
    
    def close_circuit(self):
        """Close the circuit breaker"""
        self.state = RetryState.READY
        self.circuit_opened_at = None
        logger.info("Circuit breaker closed")
        
        if self.config.on_circuit_close:
            self.config.on_circuit_close(self.stats)
    
    def is_open(self) -> bool:
        """Check if circuit is open"""
        if self.state != RetryState.CIRCUIT_OPEN:
            return False
        
        # Check if recovery timeout has passed
        if self.circuit_opened_at:
            elapsed = (datetime.now() - self.circuit_opened_at).total_seconds()
            if elapsed >= self.config.recovery_timeout:
                logger.info("Circuit breaker recovery timeout reached, allowing retry")
                return False
        
        return True
    
    def can_attempt(self) -> bool:
        """Check if we can make an attempt"""
        return not self.is_open()


class RetryStrategy:
    """Advanced retry strategy implementation"""
    
    def __init__(self, config: Optional[RetryConfig] = None):
        self.config = config or RetryConfig()
        self.circuit_breaker = CircuitBreaker(self.config)
        self.start_time = datetime.now()
    
    def calculate_delay(self, attempt: int) -> float:
        """Calculate delay before next retry"""
        # Exponential backoff
        delay = min(
            self.config.base_delay * (self.config.exponential_base ** (attempt - 1)),
            self.config.max_delay
        )
        
        # Add jitter if enabled
        if self.config.jitter:
            jitter_range = delay * 0.1  # 10% jitter
            delay += random.uniform(-jitter_range, jitter_range)
        
        return max(0, delay)  # Ensure non-negative
    
    def should_retry(self, attempt: int, error: Exception) -> bool:
        """Determine if we should retry"""
        # Check duration limit
        elapsed = (datetime.now() - self.start_time).total_seconds()
        if elapsed >= self.config.max_duration:
            logger.error(f"Retry duration limit ({self.config.max_duration}s) exceeded")
            if self.config.on_exhausted:
                self.config.on_exhausted(self.circuit_breaker.stats)
            return False
        
        # Check attempt limit (if not infinite)
        if self.config.mode == "fixed" and self.config.max_attempts:
            if attempt >= self.config.max_attempts:
                logger.error(f"Maximum retry attempts ({self.config.max_attempts}) reached")
                if self.config.on_exhausted:
                    self.config.on_exhausted(self.circuit_breaker.stats)
                return False
        
        # Check circuit breaker
        if not self.circuit_breaker.can_attempt():
            logger.warning("Circuit breaker is open, not retrying")
            return False
        
        return True
    
    def execute_with_retry(self, func: Callable, *args, **kwargs) -> Any:
        """Execute function with retry logic"""
        attempt = 0
        
        while True:
            attempt += 1
            self.circuit_breaker.stats.total_attempts = attempt
            self.circuit_breaker.stats.last_attempt_time = datetime.now()
            
            try:
                # Attempt the function
                logger.info(f"Attempt {attempt} for {func.__name__}")
                result = func(*args, **kwargs)
                
                # Success!
                self.circuit_breaker.record_success()
                return result
                
            except Exception as e:
                # Record failure
                self.circuit_breaker.record_failure(e)
                
                # Check if we should retry
                if not self.should_retry(attempt, e):
                    logger.error(f"Giving up on {func.__name__} after {attempt} attempts")
                    raise
                
                # Calculate delay
                delay = self.calculate_delay(attempt)
                logger.warning(
                    f"Attempt {attempt} failed for {func.__name__}: {e}. "
                    f"Retrying in {delay:.1f} seconds..."
                )
                
                # Call retry hook if provided
                if self.config.on_retry:
                    self.config.on_retry(attempt, e, delay, self.circuit_breaker.stats)
                
                # Wait before retry
                time.sleep(delay)
    
    async def execute_with_retry_async(self, func: Callable, *args, **kwargs) -> Any:
        """Execute async function with retry logic"""
        attempt = 0
        
        while True:
            attempt += 1
            self.circuit_breaker.stats.total_attempts = attempt
            self.circuit_breaker.stats.last_attempt_time = datetime.now()
            
            try:
                # Attempt the function
                logger.info(f"Attempt {attempt} for {func.__name__}")
                result = await func(*args, **kwargs)
                
                # Success!
                self.circuit_breaker.record_success()
                return result
                
            except Exception as e:
                # Record failure
                self.circuit_breaker.record_failure(e)
                
                # Check if we should retry
                if not self.should_retry(attempt, e):
                    logger.error(f"Giving up on {func.__name__} after {attempt} attempts")
                    raise
                
                # Calculate delay
                delay = self.calculate_delay(attempt)
                logger.warning(
                    f"Attempt {attempt} failed for {func.__name__}: {e}. "
                    f"Retrying in {delay:.1f} seconds..."
                )
                
                # Call retry hook if provided
                if self.config.on_retry:
                    self.config.on_retry(attempt, e, delay, self.circuit_breaker.stats)
                
                # Wait before retry
                await asyncio.sleep(delay)


def retry_on_failure(config: Optional[RetryConfig] = None):
    """Decorator for adding retry logic to functions"""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            strategy = RetryStrategy(config)
            return strategy.execute_with_retry(func, *args, **kwargs)
        return wrapper
    return decorator


def retry_on_failure_async(config: Optional[RetryConfig] = None):
    """Decorator for adding retry logic to async functions"""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            strategy = RetryStrategy(config)
            return await strategy.execute_with_retry_async(func, *args, **kwargs)
        return wrapper
    return decorator


# Convenience functions for common retry patterns
def infinite_retry(**kwargs) -> RetryConfig:
    """Create config for infinite retry"""
    kwargs['mode'] = 'infinite'
    return RetryConfig(**kwargs)


def fixed_retry(max_attempts: int, **kwargs) -> RetryConfig:
    """Create config for fixed retry"""
    kwargs['mode'] = 'fixed'
    kwargs['max_attempts'] = max_attempts
    return RetryConfig(**kwargs)


def quick_retry(**kwargs) -> RetryConfig:
    """Create config for quick retry (short delays)"""
    kwargs.setdefault('base_delay', 0.5)
    kwargs.setdefault('max_delay', 10.0)
    kwargs.setdefault('exponential_base', 1.5)
    return RetryConfig(**kwargs)


def patient_retry(**kwargs) -> RetryConfig:
    """Create config for patient retry (long delays)"""
    kwargs.setdefault('base_delay', 5.0)
    kwargs.setdefault('max_delay', 600.0)  # 10 minutes
    kwargs.setdefault('exponential_base', 2.5)
    return RetryConfig(**kwargs)