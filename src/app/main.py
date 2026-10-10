from fastapi import FastAPI
from contextlib import asynccontextmanager
from routes import (health_router)

@asynccontextmanager    
async def lifespan(app: FastAPI):
    # Perform any startup tasks here
    print("Starting up the NL to SQL Chatbot API server...")
    yield
    # Perform any shutdown tasks here
    print("Shutting down the NL to SQL Chatbot API server...")

app = FastAPI(
    title="NL to SQL Chatbot API",
    description="An API that converts natural language queries into SQL queries using a chatbot interface.",
    version="1.0.0",
    lifespan=lifespan
)

app.include_router(health_router)

@app.get("/")
def root():
    return {
        "message": "NL to SQL Chatbot API",
        "version": "1.0.0"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
