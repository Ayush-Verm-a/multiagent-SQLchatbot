from pydantic import BaseModel, Field
from typing import Optional

class ChatRequest(BaseModel):
    message: str = Field(..., description="User query message")
    session_id: Optional[str] = Field(None, description="Optional session id for conversation")
    
    class Config:
        json_schema_extra = {
            "example": {
                "message": "Show me all customers",
                "session_id": "abc123-def456"
            }
        }


class SessionDeleteRequest(BaseModel):
    session_id: str = Field(..., description="Session ID to delete")
    
    class Config:
        json_schema_extra = {
            "example": {
                "session_id": "abc123-def456"
            }
        }