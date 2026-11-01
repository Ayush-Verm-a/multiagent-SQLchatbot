import json
from pathlib import Path

def get_schema() -> str:
    try:
        from routes.file_manager import CURRENT_SCHEMA, CURRENT_FILE_ID
        from utils.excel_schema import get_schema_summary
        
        schema = get_schema_summary(CURRENT_SCHEMA)
            
        return json.dumps({
            "success": True,
            "schema": schema
        }, indent=2)
    except Exception as e:
        error_msg = f"Unexpected error retrieving schema: {str(e)}"
        return json.dumps({
            "success": False,
            "error": error_msg,
            "schema": None
        })