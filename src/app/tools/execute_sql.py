import sqlite3
import pandas as pd
import json
from pathlib import Path
from utils.excel_schema import read_excel_file

def execute_sql(query: str) -> str:
    """
    Execute a SQL query against Excel/CSV data.
    
    This function loads data from an Excel or CSV file into an in-memory SQLite database,
    executes the provided SQL query, and returns the results as a JSON string.
    """
    
    try:
        file_path = None
        upload_dir = Path("uploads")
        if upload_dir.exists():
            files = list(upload_dir.glob("*.*"))
            # Filter for valid Excel/CSV files
            valid_files = [f for f in files if f.suffix.lower() in ['.xlsx', '.xls', '.csv']]
            
            if valid_files:
                # Use the most recent file
                latest_file = max(valid_files, key=lambda f: f.stat().st_mtime)
                file_path = str(latest_file)
            else:
                error_msg = "No Excel/CSV file found in uploads directory"
                return json.dumps({
                    "success": False,
                    "error": error_msg,
                    "data": [],
                    "row_count": 0,
                    "columns": []
                })
                
        else:
            error_msg = "Uploads directory not found"
            return json.dumps({
                "success": False,
                "error": error_msg,
                "data": [],
                "row_count": 0,
                "columns": []
            })
            
        # Validate file exists
        file_path_obj = Path(file_path)
        if not file_path_obj.exists():
            error_msg = f"File not found: {file_path}"
            return json.dumps({
                "success": False,
                "error": error_msg,
                "data": [],
                "row_count": 0,
                "columns": []
            })
        
        # Read the Excel/CSV file
        sheets_data = read_excel_file(file_path)
        
        # Create an in-memory SQLite database
        conn = sqlite3.connect(":memory:")
        
        for sheet_name, df in sheets_data.items():
            # Clean column names (remove extra spaces, replace spaces with underscores)
            df.columns = df.columns.str.strip().str.replace(r'\s+', '_', regex=True)
            
            # Write DataFrame to SQLite
            df.to_sql(sheet_name, conn, index=False, if_exists='replace')
            
        # Execute the query
        cursor = conn.cursor()
        cursor.execute(query)
        
        # Fetch results
        rows = cursor.fetchall()
        columns = [description[0] for description in cursor.description] if cursor.description else []
        
        # Convert rows to list of dictionaries
        data = []
        for row in rows:
            row_dict = {}
            for i, col_name in enumerate(columns):
                value = row[i]
                # Handle None/NULL values
                if value is None:
                    row_dict[col_name] = None
                else:
                    row_dict[col_name] = value
            data.append(row_dict)
        
        # Close connection
        conn.close()
        
        result = {
            "success": True,
            "data": data,
            "row_count": len(data),
            "columns": columns
        }
        
        return json.dumps(result, indent=2)
    
    except sqlite3.Error as e:
        error_msg = f"SQL executing error: {str(e)}"
        return json.dumps({
            "success": False,
            "error": error_msg,
            "data": [],
            "row_count": 0,
            "columns": []
        })
        
    except Exception as e:
        error_msg = f"Unexpected error during SQL execution: {str(e)}"
        return json.dumps({
            "success": False,
            "error": error_msg,
            "data": [],
            "row_count": 0,
            "columns": []
        })