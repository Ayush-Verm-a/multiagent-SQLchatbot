import json

def get_schema() -> str:
    try:
        from routes.file_manager import FILE_REGISTRY
        
        if not FILE_REGISTRY:
            return json.dumps({
                "success": False,
                "error": "No files have been uploaded yet",
                "schema": {},
                "summary": "No tables available in the database"
            })
            
        all_schemas = {}
        table_summaries = []
        
        for file_id, file_data in FILE_REGISTRY.items():
            table_name = file_data.get("table_name")
            original_filename = file_data.get("original_filename")
            schema = file_data.get("schema")
            
            if not schema:
                continue
            
            tables = schema.get("tables", [])
            
            if tables:
                table_info = tables[0]
                
                all_schemas[table_name] = {
                    "file_name": original_filename,
                    "table_name": table_name,
                    "row_count": table_info.get("row_count", 0),
                    "column_count": table_info.get("column_count", 0),
                    "columns": table_info.get("columns", [])
                }

                columns_str = ", ".join([col["name"] for col in table_info.get("columns", [])])
                table_summaries.append(
                    f"Table: {table_name} (from file: {original_filename})\n"
                    f"  Rows: {table_info.get('row_count', 0)}, Columns: {table_info.get('column_count', 0)}\n"
                    f"  Column Names: {columns_str}"
                )
                
        summary = f"Database contains {len(all_schemas)} table(s):\n\n" + "\n\n".join(table_summaries)
            
        return json.dumps({
            "success": True,
            "error": None,
            "schema": all_schemas,
            "summary": summary,
            "total_tables": len(all_schemas)
        }, indent=2)
    except Exception as e:
        error_msg = f"Unexpected error retrieving schema: {str(e)}"
        return json.dumps({
            "success": False,
            "error": str(e),
            "schema": {},
            "summary": "Failed to retrieve schema"
        })