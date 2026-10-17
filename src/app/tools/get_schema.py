import json
from pathlib import Path

def get_schema() -> str:
    """
    Retrieve the current database schema from uploaded Excel/CSV files and return it as a JSON string.
    
    This function fetches the schema information for the currently uploaded file,
    which includes details about tables, columns, data types, and sample values.
    
    Returns:
        str: JSON string containing the schema information with the following structure:
             {
                 "success": bool,
                 "schema": {
                     "file_name": str,
                     "file_type": str,
                     "tables": [
                         {
                             "name": str,
                             "row_count": int,
                             "column_count": int,
                             "columns": [
                                 {
                                     "name": str,
                                     "type": str (INTEGER, TEXT, REAL, BOOLEAN, etc.),
                                     "nullable": bool,
                                     "sample_values": List[str]
                                 }
                             ]
                         }
                     ]
                 },
                 "error": str (only if success is False)
             }
    """
    
    try:
        from routes.file_manager import CURRENT_SCHEMA, CURRENT_FILE_ID
        
        if not CURRENT_FILE_ID:
            error_message = "No file has been uploaded. Please upload an Excel or CSV file first."
            return json.dumps({
                "success": False,
                "error": error_message,
                "schema": None
            })
            
        if not CURRENT_SCHEMA:
            schema_dir = Path("schemas")
            schema_file = schema_dir / f"{CURRENT_FILE_ID}.json"
            
            if schema_file.exists():
                try:
                    with open(schema_file, 'r', encoding='utf-8') as f:
                        schema = json.load(f)
                except Exception as e:
                    error_msg = f"Failed to load cached schema: {str(e)}"
                    return json.dumps({
                        "success": False,
                        "error": error_msg,
                        "schema": None
                    })
            else:
                error_msg = "Schema not found. Please re-upload the file."
                return json.dumps({
                    "success": False,
                    "error": error_msg,
                    "schema": None
                })
        else:
            schema = CURRENT_SCHEMA
            
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