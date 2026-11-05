from fastapi import APIRouter, HTTPException, Form
from fastapi.responses import JSONResponse
from typing import Optional

from utils.response_parser import parse_agent_response
from services import session_service, runner
from google.genai import types
import asyncio

router = APIRouter(prefix="/api", tags=["chat"])


@router.post("/chat")
async def chat(
    message: str = Form(...),
    session_id: Optional[str] = Form(None)
):
    try:
        if not message:
            raise HTTPException(status_code=400, detail="Message is required.")
        
        from .file_manager import FILE_REGISTRY
        if not FILE_REGISTRY:
            raise HTTPException(status_code=400, detail="Please upload an Excel/CSV file to start the chat")
        
        user_id = "web_user"
        
        if not session_id:
            session = await session_service.create_session(
                app_name="sql-chatbot",
                user_id=user_id
            )
            session_id = session.id
        else:
            session = await session_service.get_session(
                app_name="sql-chatbot",
                user_id=user_id,
                session_id=session_id
            )
            
            if not session:
                session = await session_service.create_session(
                    app_name="sql-chatbot",
                    user_id=user_id,
                    session_id=session_id
                )

            
        user_msg = types.UserContent(message)
        selected_agent = None
        
        response_text = ""

        async for event in runner.run_async(
            user_id=user_id,
            session_id=session_id,
            new_message=user_msg
        ):
            if event.is_final_response():
                if event.content and event.content.parts:
                    response_text = event.content.parts[0].text
                    
            if event.actions and event.actions.transfer_to_agent:
                selected_agent = event.actions.transfer_to_agent
                    
        print(response_text)
                    
        parsed = parse_agent_response(response_text)
        if not parsed["sql_query"]:
            session = await session_service.get_session(
                app_name="sql-chatbot",
                user_id=user_id,
                session_id=session_id
            )
            generated = session.state.get("generated_sql") if session else None
            if generated:
                parsed["sql_query"] = parse_agent_response(generated)["sql_query"]
        return {
            "status": "success",
            "explanation": parsed["explanation"],
            "query_result": parsed["query_result"],
            "sql_query": parsed["sql_query"],
            "selected_agent": selected_agent,
            "error": parsed["error"],
            "session_id": session_id,
            "suggestions": parsed.get("suggestions")
        }
        
        
    except HTTPException as e:
        return {"error": e.detail}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat processing error: {e}")
    
@router.delete("/session/{session_id}")
async def delete_session(session_id: str):
    """Delete a chat session by ID."""
    
    try:
        user_id = "web-user"  # future: from authentication
        
        # Try to get the session first to verify it exists
        session = await session_service.get_session(
            app_name="sql-chatbot",
            user_id=user_id,
            session_id=session_id
        )
        
        if not session:
            # Return success anyway (idempotent delete)
            return {
                "status": "success",
                "message": "Session not found or already deleted",
                "session_id": session_id
            }
        
        # Delete the session
        await session_service.delete_session(
            app_name="sql-chatbot",
            user_id=user_id,
            session_id=session_id
        )
        
        
        return {
            "status": "success",
            "message": "Session deleted successfully",
            "session_id": session_id
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Session deletion error: {e}")