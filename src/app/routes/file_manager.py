from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import JSONResponse
from pathlib import Path
from typing import Optional
import uuid
import json

from utils.excel_schema import generate_schema, get_schema_summary

router = APIRouter(prefix="/api", tags=["file_manager"])

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

SCHEMA_DIR = Path("schemas")
SCHEMA_DIR.mkdir(exist_ok=True)

CURRENT_FILE_ID: Optional[str] = None
CURRENT_FILENAME: Optional[str] = None
CURRENT_SCHEMA: Optional[dict] = None

def check_file_on_startup():
    global CURRENT_FILE_ID, CURRENT_FILENAME, CURRENT_SCHEMA
    
    # Get all files in upload directory
    files = list(UPLOAD_DIR.glob("*.*"))
    
    if not files:
        return
    
    # If multiple files exist, keep only the most recent
    if len(files) > 1:

        files.sort(key=lambda f: f.stat().st_mtime, reverse=True)
        latest_file = files[0]
        
        # Delete older files
        for f in files[1:]:
            f.unlink()

    else:
        latest_file = files[0]
    
    # Load file metadata
    file_id = latest_file.stem
    CURRENT_FILE_ID = file_id
    CURRENT_FILENAME = latest_file.name
    
    # Load cached schema if exists
    schema_file = SCHEMA_DIR / f"{file_id}.json"
    if schema_file.exists():
        try:
            with open(schema_file, 'r', encoding='utf-8') as f:
                CURRENT_SCHEMA = json.load(f)

        except Exception as e:

            CURRENT_SCHEMA = None


@router.post("/upload-file")
async def upload_file(file: UploadFile = File(...)):
    try:
        allowed_extensions = [".xlsx", ".xls", ".csv"]
        file_ext = Path(file.filename).suffix.lower()
        
        if file_ext not in allowed_extensions:
            raise HTTPException(status_code=400, detail="Invalid file type. Only Excel (.xlsx, .xls) and CSV (.csv) files are allowed.")
        
        global CURRENT_FILE_ID, CURRENT_FILENAME, CURRENT_SCHEMA
        
        old_files = list(UPLOAD_DIR.glob("*.*"))
        old_schemas = list(SCHEMA_DIR.glob("*.json"))
        
        if old_files or old_schemas:
            for f in old_files:
                f.unlink()
                
            for s in old_schemas:
                s.unlink()
                
        file_id = str(uuid.uuid4())
        file_path = UPLOAD_DIR / f"{file_id}{file_ext}"
        
        with open(file_path, "wb") as f:
            while True:
                chunk = await file.read(8192)
                if not chunk:
                    break
                f.write(chunk)
                
        # Generate schema and schema summary
        schema = generate_schema(str(file_path))
        schema_summary = get_schema_summary(schema)
        
        # Save schema to cache
        schema_file = SCHEMA_DIR / f"{file_id}.json"
        with open(schema_file, "w", encoding="utf-8") as f:
            json.dump(schema, f, indent=2)
            
        CURRENT_FILE_ID = file_id
        CURRENT_FILENAME = file.filename
        CURRENT_SCHEMA = schema
        
        return {
            "status": "success",
            "file_id": file_id,
            "filename": file.filename,
            "schema": schema,
            "schema_summary": schema_summary
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")
    
    
@router.get("/file-status")
async def file_status():
    global CURRENT_FILE_ID, CURRENT_FILENAME
    try:
        if CURRENT_FILE_ID:
            for file in UPLOAD_DIR.glob(f"{CURRENT_FILE_ID}.*"):
                return {
                    "status": "success",
                    "has_file": True,
                    "file_id": CURRENT_FILE_ID,
                    "filename": CURRENT_FILENAME,
                    "file_path": str(file)
                }

        return {"status": "success", "has_file": False}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
@router.delete("/file")
async def delete_file():
    global CURRENT_FILE_ID, CURRENT_FILENAME, CURRENT_SCHEMA
    try:
        if not CURRENT_FILE_ID:
            raise HTTPException(status_code=404, detail="No file uploaded")

        deleted_file = CURRENT_FILENAME
        deleted_id = CURRENT_FILE_ID
        
        # Remove file
        for f in UPLOAD_DIR.glob(f"{CURRENT_FILE_ID}.*"):
            f.unlink()
        
        # Remove cached schema
        schema_file = SCHEMA_DIR / f"{CURRENT_FILE_ID}.json"
        if schema_file.exists():
            schema_file.unlink()


        # Clear global state
        CURRENT_FILE_ID = None
        CURRENT_FILENAME = None
        CURRENT_SCHEMA = None

        return {"status": "success", "message": "File and schema deleted"}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))