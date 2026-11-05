import pandas as pd
import numpy as np
from typing import List, Dict, Any, Optional
from pathlib import Path

def read_excel_file(file_path: str) -> Dict[str, pd.DataFrame]:
    """Read an Excel file and return a dictionary mapping sheet names to DataFrames."""
    file_path_obj = Path(file_path)
    file_ext = file_path_obj.suffix.lower()
    
    if file_ext == ".csv":
        csv_data = pd.read_csv(file_path, low_memory=False)
        return {"Sheet1": csv_data} # CSV files don't have sheets, so we return a single sheet named "Sheet1"
    elif file_ext in [".xls", ".xlsx"]:
        engine = "openpyxl" if file_ext == ".xlsx" else "xlrd"
        excel_data = pd.read_excel(file_path, sheet_name=None, engine=engine)
        return excel_data
    else:
        raise ValueError(f"Unsupported file extension: {file_ext}. Supported extensions are .csv, .xls, and .xlsx.")
    
def infer_sql_type(pandas_dtype: str, series: pd.Series) -> str:
    """
    Infers SQL type from a pandas dtype and the actual data.
    
    Returns:
        SQL type string
    """
    
    dtype_str = str(pandas_dtype).lower()
    
    if "int" in dtype_str:
        if series.nunique() == 2 and set(series.dropna().unique()).issubset({0, 1}):
            return "BOOLEAN"
        return "INTEGER"
    elif "float" in dtype_str:
        return "REAL"
    elif "bool" in dtype_str:
        return "BOOLEAN"
    elif "datetime" in dtype_str or "date" in dtype_str:
        return "DATETIME"
    elif "time" in dtype_str:
        return "TIME"
    else:
        return "TEXT"

def analyze_column(series: pd.Series, column_name: str) -> Dict[str, Any]:
    """
    Analyze a single column and return its metadata.
    """
    
    sql_type = infer_sql_type(str(series.dtype), series)
    
    total_count = len(series)
    null_count = int(series.isna().sum())
    null_percentage = (null_count / total_count) * 100 if total_count > 0 else 0.0
    
    unique_count = int(series.nunique())
    
    sample_values = []
    non_null_series = series.dropna()
    if len(non_null_series) > 0:
        sample_count = min(3, len(non_null_series))
        sample_values = non_null_series.iloc[:sample_count].tolist()
        
    is_potential_pk = (unique_count == total_count and null_count == 0 and total_count > 0)
    
    nullable = bool(null_count > 0)
    
    cleaned_samples = []
    
    for val in sample_values:
        if pd.isna(val):
            continue
        
        try:
            if hasattr(val, "item"):
                val = val.item()
            cleaned_samples.append(str(val))
        except (ValueError, TypeError):
            continue
        
    return {
        "name": str(column_name),
        "type": sql_type,
        "nullable": nullable,
        "null_count": int(null_count),
        "null_percentage": float(round(null_percentage, 2)),
        "unique_count": int(unique_count),
        "total_count": int(total_count),
        "sample_values": cleaned_samples,
        "is_potential_primary_key": is_potential_pk,
    }


def convert_numpy_types(obj: Any) -> Any:
    """
    Recursively convert numpy types to native Python types.
    """
    if isinstance(obj, np.integer):
        return int(obj)
    elif isinstance(obj, np.floating):
        return float(obj)
    elif isinstance(obj, np.bool_):
        return bool(obj)
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    elif isinstance(obj, dict):
        return {key: convert_numpy_types(value) for key, value in obj.items()}
    elif isinstance(obj, (list, tuple)):
        return [convert_numpy_types(item) for item in obj]
    elif pd.isna(obj):
        return None
    else:
        return obj

        


def generate_schema(file_path: str) -> Dict[str, Any]:
    """
    Generate a schema from a given Excel/CSV file.
    """
    
    try:
        file_path_obj = Path(file_path)
        file_name = file_path_obj.name
        file_ext = file_path_obj.suffix.lower()
        
        sheets_data = read_excel_file(file_path)
        
        tables = []
        total_rows = 0
        total_columns = 0
        
        for sheet_name, df in sheets_data.items():
            df.columns = df.columns.str.strip().str.replace(r"\s+", "_", regex=True)  # Collapse any whitespace (incl. wrapped-header newlines) to underscores
            
            columns = []
            
            for col_name in df.columns:
                column_info = analyze_column(df[col_name], col_name)
                columns.append(column_info)
                
            table_info = {
                "name": sheet_name,
                "row_count": int(len(df)),
                "column_count": int(len(df.columns)),
                "columns": columns
            }
            
            tables.append(table_info)
            total_rows += len(df)
            total_columns += len(df.columns)
            
        schema = {
            "file_path": str(file_path),
            "file_name": file_name,
            "file_type": file_ext,
            "tables": tables,
            "summary": {
                "total_tables": int(len(tables)),
                "total_rows": int(total_rows),
                "total_columns": int(total_columns)
            }
        }
        
        schema = convert_numpy_types(schema)
        
        return schema

            
    except Exception as e:
        raise ValueError(f"Error generating schema for file {file_path}: {e}")
    
    
def generate_schema_summary(schema: Dict[str, Any]) -> str:
    """
    Generate a summary string from the schema dictionary.
    """
    
    summary = schema.get("summary", {})
    tables = schema.get("tables", [])
    
    lines = [
        f"File: {schema.get('file_name', 'Unknown')}",
        f"File Type: {schema.get('file_type', 'Unknown')}",
        f"Total Tables: {summary.get('total_tables', 0)}",
        f"Total Rows: {summary.get('total_rows', 0)}",
        f"Total Columns: {summary.get('total_columns', 0)}",
    ]
    
    for table in tables:
        lines.append(f"Table: {table['name']}")
        lines.append(f"  Rows: {table['row_count']}, Columns: {table['column_count']}")
        for column in table['columns']:
            pk_marker = " [PK]" if column.get("is_potential_primary_key", False) else ""
            null_info = f" ({column['null_count']})" if column["null_count"] > 0 else ""
            lines.append(f"  - {column['name']}: {column['type']}{pk_marker}{null_info}")
    
    return "\n".join(lines)
