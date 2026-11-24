"""
Data directory paths shared by the FastAPI backend and the MCP server.

All data folders live under DATA_ROOT, which defaults to the project root.
Set the DATA_DIR environment variable to store them somewhere else. A relative
DATA_DIR is resolved against the project root, not the working directory, so
both processes always agree on where the data is.
"""

import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

# utils/paths.py -> parents: [0]=utils, [1]=app, [2]=src, [3]=project root
PROJECT_ROOT = Path(__file__).resolve().parents[3]

_data_dir = os.getenv("DATA_DIR")
DATA_ROOT = (PROJECT_ROOT / Path(_data_dir).expanduser()).resolve() if _data_dir else PROJECT_ROOT

UPLOAD_DIR = DATA_ROOT / "uploads"
SCHEMA_DIR = DATA_ROOT / "schemas"
METADATA_DIR = DATA_ROOT / "metadata"
DB_DIR = DATA_ROOT / "database"
DB_FILE = DB_DIR / "chatbot.db"


def ensure_data_dirs() -> None:
    """Create all data directories if they don't exist."""
    for directory in (UPLOAD_DIR, SCHEMA_DIR, METADATA_DIR, DB_DIR):
        directory.mkdir(parents=True, exist_ok=True)
