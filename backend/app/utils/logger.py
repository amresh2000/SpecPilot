"""
Centralized logging configuration for the application
Simple structured logging without being excessive
"""

import logging
import sys
from typing import Any, Dict

# Create logger
logger = logging.getLogger("specpilot")
logger.setLevel(logging.INFO)

# Console handler with formatting
console_handler = logging.StreamHandler(sys.stdout)
console_handler.setLevel(logging.INFO)

# Simple format: timestamp - level - message
formatter = logging.Formatter(
    '%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
console_handler.setFormatter(formatter)

# Add handler if not already added
if not logger.handlers:
    logger.addHandler(console_handler)


def log_info(message: str, **context: Any):
    """Log info message with optional context"""
    if context:
        logger.info(f"{message} | {_format_context(context)}")
    else:
        logger.info(message)


def log_error(message: str, error: Exception = None, **context: Any):
    """Log error message with exception details"""
    error_msg = f"{message}"
    if error:
        error_msg += f" | Error: {str(error)}"
    if context:
        error_msg += f" | {_format_context(context)}"
    logger.error(error_msg)


def log_warning(message: str, **context: Any):
    """Log warning message with optional context"""
    if context:
        logger.warning(f"{message} | {_format_context(context)}")
    else:
        logger.warning(message)


def _format_context(context: Dict[str, Any]) -> str:
    """Format context dictionary for logging"""
    return " | ".join(f"{k}={v}" for k, v in context.items())
