from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import JSONResponse
from pathlib import Path
from typing import Optional, Dict, List
import re
import uuid
import json

from utils.schema_generator import generate_schema, generate_schema_summary
from utils.database_manager import (
    load_file_to_db,
    remove_table_from_db,
    rebuild_database,
    compute_file_hash,
    get_all_table_names
)

router = APIRouter(prefix="/api", tags=["file_manager"])

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

SCHEMA_DIR = Path("schemas")
SCHEMA_DIR.mkdir(exist_ok=True)

METADATA_DIR = Path("metadata")
METADATA_DIR.mkdir(exist_ok=True)

MAX_FILES = 10

FILE_REGISTRY: Dict[str, Dict] = {}


def derive_table_name(filename: str, existing_names: List[str]) -> str:
    base_name = Path(filename).stem
    table_name = re.sub(r'[^a-zA-Z0-9_]', '_', base_name)
    table_name = re.sub(r'_+', '_', table_name).strip('_').lower()
    
    if table_name and table_name[0].isdigit():
        table_name = "t_" + table_name
        
    if not table_name:
        table_name = "table"
        
    original = table_name
    counter = 1
    
    while table_name in existing_names:
        table_name = f"{original}_{counter}"
        counter += 1
        
    return table_name

def check_duplicate_content(file_hash: str) -> Optional[str]:
    for file_id, info in FILE_REGISTRY.items():
        if info.get("file_hash") == file_hash:
            return info.get("original_filename")
        
    return None



def check_files_on_startup():
    global FILE_REGISTRY
    
    # Get all files in upload directory
    files = list(UPLOAD_DIR.glob("*.*"))
    
    if not files:
        return
    
    for file_path in files:
        file_id = file_path.stem
        metadata_file = METADATA_DIR / f"{file_id}.json"
        
        if not metadata_file.exists():
            continue
        
        try:
            with open(metadata_file, "r", encoding="utf-8") as f:
                metadata = json.load(f)
            
            schema_file = SCHEMA_DIR / f"{file_id}.json"
            schema = None
            if schema_file.exists():
                with open(schema_file, "r", encoding="utf-8") as f:
                        schema = json.load(f)
                        
            FILE_REGISTRY[file_id] = {
                "file_id": file_id,
                "original_filename": metadata.get("original_filename"),
                "table_name": metadata.get("table_name"),
                "file_path": str(file_path),
                "file_hash": metadata.get("file_hash", ""),
                "schema": schema,
                "uploaded_at": metadata.get("uploaded_at")
            }
        except Exception as e:
            print("Check file startup error: ", e)
    
    if FILE_REGISTRY:
        try:
            rebuild_database(FILE_REGISTRY)
        except Exception as e:
            print("Check file startup error: ", e)


@router.post("/upload-file")
async def upload_file(file: UploadFile = File(...)):
    try:
        if len(FILE_REGISTRY) >= MAX_FILES:
            raise HTTPException(
                status_code=400,
                detail=f"Maximum {MAX_FILES} allowed. Please delete some files first"
            )
        
        allowed_extensions = [".xlsx", ".xls", ".csv"]
        file_ext = Path(file.filename).suffix.lower()
        
        if file_ext not in allowed_extensions:
            raise HTTPException(status_code=400, detail="Invalid file type. Only Excel (.xlsx, .xls) and CSV (.csv) files are allowed.")
        
                
        file_id = str(uuid.uuid4())
        file_path = UPLOAD_DIR / f"{file_id}{file_ext}"
        
        with open(file_path, "wb") as f:
            while chunk := await file.read(8192):
                f.write(chunk)
                
        # Detect duplicate file
        file_hash = compute_file_hash(str(file_path))
        dup = check_duplicate_content(file_hash)
        if dup:
            file_path.unlink()
            raise HTTPException(
                status_code=400,
                detail=f"This file already exists as: {dup}"
            )
            
        existing = [info["table_name"] for info in FILE_REGISTRY.values()]
        table_name = derive_table_name(file.filename, existing)
                
        # Generate schema and schema summary
        schema = generate_schema(str(file_path))
        schema_summary = generate_schema_summary(schema)
        
        if not schema_summary:
            raise HTTPException(status_code=500, detail="Failed to generate schema summary")
        
        # Save schema to cache
        temp_schema_file = SCHEMA_DIR / f"{file_id}.tmp"
        schema_file = SCHEMA_DIR / f"{file_id}.json"
        with open(temp_schema_file, "w", encoding="utf-8") as f:
            json.dump(schema, f, indent=2)
            
        temp_schema_file.replace(schema_file)
            
        metadata = {
            "original_filename": file.filename,
            "file_id": file_id,
            "uploaded_at": str(Path(file_path).stat().st_mtime),
            "table_name": table_name,
            "file_hash": file_hash
        }
        temp_metadata_file = METADATA_DIR / f"{file_id}.tmp"
        metadata_file = METADATA_DIR / f"{file_id}.json"
        with open(temp_metadata_file, "w", encoding="utf-8") as f:
            json.dump(metadata, f, indent=2)
            
        temp_metadata_file.replace(metadata_file)
            
        try:
            row_count, col_count = load_file_to_db(str(file_path), table_name)
        except Exception as e:
            file_path.unlink()
            schema_file.unlink()
            metadata_file.unlink()
            raise HTTPException(status_code=500, detail=f"Failed to load file: {e}")
        
        FILE_REGISTRY[file_id] = {
            "file_id": file_id,
            "original_filename": file.filename,
            "table_name": table_name,
            "file_path": file_path,
            "schema": schema,
            "uploaded_at": metadata["uploaded_at"]
        }
        
        return {
            "status": "success",
            "file_id": file_id,
            "filename": file.filename,
            "schema": schema,
            "table_name": table_name,
            "schema_summary": schema_summary,
            "total_files": len(FILE_REGISTRY),
            "max_files": MAX_FILES
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")
    
    
@router.get("/file-status")
async def file_status():
    if not FILE_REGISTRY:
        return {
            "status": "success",
            "has_files": False,
            "files": [],
            "total_files": 0,
            "max_files": MAX_FILES
        }

    files = [
        {
            "file_id": info["file_id"],
            "filename": info["original_filename"],
            "table_name": info["table_name"],
            "file_path": info["file_path"],
            "schema": info.get("schema"),
            "uploaded_at": info["uploaded_at"],
        }
        for info in FILE_REGISTRY.values()
    ]
    
    return {
        "status": "success",
        "has_files": True,
        "files": files,
        "total_files": len(files),
        "max_files": MAX_FILES
    }
    
@router.delete("/file/{file_id}")
async def delete_file(file_id: str):
    if file_id not in FILE_REGISTRY:
        raise HTTPException(
            status_code=404,
            detail=f"File id: {file_id} not found"
        )
        
    data = FILE_REGISTRY[file_id]
    try:
        table_name = data["table_name"]
        remove_table_from_db(table_name)
        
        path = Path(data["file_path"])
        if path.exists():
            path.unlink()
        
        # Remove cached schema
        schema_file = SCHEMA_DIR / f"{file_id}.json"
        if schema_file.exists():
            schema_file.unlink()
            
        # Remove metadata
        metadata_file = METADATA_DIR /f"{file_id}.json"
        if metadata_file.exists():
            metadata_file.unlink()

        del FILE_REGISTRY[file_id]

        return {"status": "success", "message": "File and schema deleted", "file_id": file_id, "total_files": len(FILE_REGISTRY)}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
@router.delete("/files/all")
async def delete_all_files():
    if not FILE_REGISTRY:
        return {"status": "success", "message": "No files to delete", "deleted_count": 0}
    
    ids = list(FILE_REGISTRY.keys())
    for fid in ids:
        await delete_file(fid)
        
    return {
        "status": "success",
        "message": f"Successfully deleted {len(ids)} file(s)",
        "deleted_count": len(ids)
    }