from fastapi import FastAPI

app = FastAPI()

@app.get("/")
def root():
    return {
        "message": "NL to SQL Chatbot API",
        "version": "1.0.0"
    }

if __name__ == "__main__":
    print("Starting uvicorn server...")
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
