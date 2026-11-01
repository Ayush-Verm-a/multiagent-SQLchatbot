import os
from pathlib import Path
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from routes import chat_router, schema_router, health_router, file_manager_router, file_manager
from config.api_key_config import configure_api_key

# Initialize API key configuration
configure_api_key()

# Create FastAPI app
app = FastAPI(
    title="SQL ChatBot API",
    description="AI-powered SQL Chatbot using Google ADK",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(chat_router)
app.include_router(schema_router)
app.include_router(file_manager_router)
app.include_router(health_router)

# Configure file uploads directory
UPLOADS_DIR = Path("uploads")
UPLOADS_DIR.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")


@app.on_event("startup")
async def startup_event():
    """Application startup event."""
    
    # Check for existing files on startup
    file_manager.check_file_on_startup()
    
    configure_api_key()

@app.on_event("shutdown")
async def shutdown_event():
    """Application shutdown event."""


@app.get("/")
async def root():
    """Root endpoint."""
    return {"message": "SQL ChatBot API", "version": "1.0.0"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
