from fastapi import APIRouter, HTTPException, Form
from typing import Optional

router = APIRouter(prefix="/api", tags=["chat"])

@router.post("/chat")
async def chat(
    message: str = Form(...),
    session_id: Optional[str] = Form(None)
):
    try:
        if not message:
            raise HTTPException(status_code=400, detail="Message is required.")
        
        user_id = "web_user"
        
        
    except HTTPException as e:
        return {"error": e.detail}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat processing error: {e}")