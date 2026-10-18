from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from pathlib import Path
from utils.excel_schema import generate_schema, get_schema_summary

router = APIRouter(prefix="/api/schema", tags=["schema"])


@router.get("/current")
async def get_schema():
    """
    Get schema for the current uploaded file (uses cached schema).
    
    Returns:
        Cached schema representation of the file
    """

    try:
        from .file_manager import CURRENT_FILE_ID, CURRENT_SCHEMA, UPLOAD_DIR
        
        if not CURRENT_FILE_ID:
            raise HTTPException(status_code=404, detail="No file uploaded")
        
        # Return cached schema if available
        if CURRENT_SCHEMA:
            schema_summary = get_schema_summary(CURRENT_SCHEMA)
            return JSONResponse({
                "status": "success",
                "schema": CURRENT_SCHEMA,
                "schema_summary": schema_summary,
                "cached": True
            })
        
        # Fallback: regenerate if cache is missing
        file_path = None
        for file in UPLOAD_DIR.glob(f"{CURRENT_FILE_ID}.*"):
            file_path = file
            break
        
        if not file_path or not file_path.exists():
            raise HTTPException(status_code=404, detail="File not found")
        
        schema = generate_schema(str(file_path))
        schema_summary = get_schema_summary(schema)
        
        
        return JSONResponse({
            "status": "success",
            "schema": schema,
            "schema_summary": schema_summary,
            "cached": False
        })
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get schema: {str(e)}")


@router.post("/analyze")
async def analyze_file(file_path: str):
    """
    Analyze a file and return its schema.
    
    Args:
        file_path: Path to the file to analyze
        
    Returns:
        Schema representation
    """
    try:
        path_obj = Path(file_path)
        if not path_obj.exists():
            raise HTTPException(status_code=404, detail="File not found")
        
        schema = generate_schema(str(path_obj))
        schema_summary = get_schema_summary(schema)
        
        
        return JSONResponse({
            "status": "success",
            "schema": schema,
            "schema_summary": schema_summary
        })
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to analyze file: {str(e)}")
