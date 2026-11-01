from dotenv import load_dotenv
import os

load_dotenv()

def configure_api_key():
    """Configure API key from environment variables."""
    api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("OPENAI_API_KEY")
    if api_key:
        return True
    else:
        return False