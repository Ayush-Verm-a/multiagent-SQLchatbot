import sys
from pathlib import Path

project_root = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(project_root))

from fastmcp import FastMCP

import json
import sqlite3
from src.app.utils.database_manager import get_db_connection, get_all_table_names
from src.app.mcp_server.tools import execute_sql_query, get_schema_summary

mcp = FastMCP("Sql_Chatbot_Mcp_Server")

@mcp.tool()
def execute_sql(query: str) -> str:
    '''Execute a SQL query on data from the persistent database.'''
    return execute_sql_query(query)

@mcp.tool()
def get_schema():
    '''Retrieve schemas for all tables currently available in the database.'''
    return get_schema_summary() 

if __name__ == "__main__":
    mcp.run(transport="sse", host="127.0.0.1", port=8001)