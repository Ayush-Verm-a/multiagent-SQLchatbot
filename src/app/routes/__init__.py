from .health import router as health_router
from .file_manager import router as file_manager_router
from .chat import router as chat_router

__all__ = ["health_router", "file_manager_router", "chat_router"]