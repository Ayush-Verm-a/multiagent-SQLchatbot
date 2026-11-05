import sqlite3
import hashlib
from pathlib import Path
from typing import Optional, Dict, List, Tuple

from .schema_generator import read_excel_file

DB_DIR = Path("database")
DB_FILE = DB_DIR / "chatbot.db"

DB_DIR.mkdir(exist_ok=True)

def get_db_connection() -> sqlite3.Connection:
    try:
        conn = sqlite3.connect(str(DB_FILE))
        return conn
    except sqlite3.Error as e:
        raise
    
def compute_file_hash(file_path: str) -> str:
    try:
        sha256_hash = hashlib.sha256()
        with open(file_path, "rb") as f:
            for byte_block in iter(lambda: f.read(8192), b""):
                sha256_hash.update(byte_block)
        file_hash = sha256_hash.hexdigest()
        return file_hash
    except Exception as e:
        raise
    
def load_file_to_db(file_path: str, table_name: str) -> Tuple[int, int]:
    try:
        # Validate table name (alphanumeric and underscores only)
        if not table_name.replace("_", "").isalnum():
            raise ValueError(f"Invalid table name: {table_name}. Only alphanumeric and underscores allowed.")
        
        # Read the file
        sheets_data = read_excel_file(file_path)
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        total_rows = 0
        total_columns = 0
        
        # For single-sheet files (CSV or single Excel sheet)
        if len(sheets_data) == 1:
            sheet_name, df = list(sheets_data.items())[0]
            
            # Clean column names (must match generate_schema in excel_schema.py)
            df.columns = df.columns.str.strip().str.replace(r"\s+", "_", regex=True)

            # Load to database
            df.to_sql(table_name, conn, index=False, if_exists="replace")
            
            total_rows = len(df)
            total_columns = len(df.columns)
        
        # For multi-sheet Excel files, use sheet names as suffixes
        else:
            
            for sheet_name, df in sheets_data.items():
                # Clean column names (must match generate_schema in excel_schema.py)
                df.columns = df.columns.str.strip().str.replace(r"\s+", "_", regex=True)
                
                # Create table name with sheet suffix
                sheet_table_name = f"{table_name}_{sheet_name}".replace(" ", "_")
                
                # Load to database
                df.to_sql(sheet_table_name, conn, index=False, if_exists="replace")
                
                total_rows += len(df)
                total_columns += len(df.columns)
                
        
        conn.commit()
        conn.close()
        
        return total_rows, total_columns
        
    except Exception as e:
        raise ValueError(f"Failed to load file to database: {e}")

def remove_table_from_db(table_name: str) -> bool:
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Check if table exists
        cursor.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
            (table_name,)
        )
        
        if cursor.fetchone() is None:
            conn.close()
            return False
        
        # Drop the table
        cursor.execute(f"DROP TABLE IF EXISTS {table_name}")
        conn.commit()
        conn.close()
        
        return True
        
    except sqlite3.Error as e:
        raise

def get_all_table_names() -> List[str]:
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute(
            "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
        )
        
        tables = [row[0] for row in cursor.fetchall()]
        conn.close()
        
        return tables
        
    except sqlite3.Error as e:
        return []
    
def clear_database() -> int:
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Get all table names
        cursor.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        )
        tables = [row[0] for row in cursor.fetchall()]
        
        # Drop each table
        for table_name in tables:
            cursor.execute(f"DROP TABLE IF EXISTS {table_name}")
        
        conn.commit()
        conn.close()
        
        return len(tables)
        
    except sqlite3.Error as e:
        raise
    
def rebuild_database(file_registry: Dict[str, Dict]) -> int:
    try:
        # Clear existing database
        clear_database()
        
        # Load each file
        loaded_count = 0
        for file_id, file_info in file_registry.items():
            try:
                file_path = file_info.get("file_path")
                table_name = file_info.get("table_name")
                
                if not file_path or not table_name:
                    continue
                
                # Check if file exists
                if not Path(file_path).exists():
                    continue
                
                # Load to database
                load_file_to_db(file_path, table_name)
                loaded_count += 1
                
            except Exception as e:
                continue
        
        return loaded_count
        
    except Exception as e:
        raise