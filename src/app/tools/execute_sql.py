import sqlite3
import json
from utils.database_manager import get_db_connection, get_all_table_names

def execute_sql(query: str) -> str:
    """
    Execute a SQL query against Excel/CSV data.
    
    This function loads data from an Excel or CSV file into an in-memory SQLite database,
    executes the provided SQL query, and returns the results as a JSON string.
    """
    
    try:
        print("Query: ", query)
        tables = get_all_table_names()
        
        if not tables:
            error_msg = "No table found in database"
            
            return json.dumps({
                "success": False,
                "error": error_msg,
                "data": [],
                "row_count": 0,
                "columns": []
            })
            
        
        conn = get_db_connection()
            
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