from fastapi import APIRouter, HTTPException, Form
from fastapi.responses import JSONResponse
from typing import Optional

from .file_manager import CURRENT_FILE_ID, UPLOAD_DIR
from utils.response_parser import parse_agent_response

router = APIRouter(prefix="/api", tags=["chat"])


@router.post("/chat")
async def chat(
    message: str = Form(...),
    session_id: Optional[str] = Form(None)
):
    try:
        if not message:
            raise HTTPException(status_code=400, detail="Message is required.")
        
        from .file_manager import CURRENT_FILE_ID
        if not CURRENT_FILE_ID:
            raise HTTPException(status_code=400, detail="Please upload an Excel/CSV file to start the chat")
        
        from services import session_service, runner
        from google.genai import types
        
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

        file_path = None
        if CURRENT_FILE_ID:
            for file in UPLOAD_DIR.glob(f"{CURRENT_FILE_ID}.*"):
                file_path = str(file)
                break
            
        user_msg = types.UserContent(message)
        
        response_text = ""
        print(session_id)
        async for event in runner.run_async(
            user_id=user_id,
            session_id=session_id,
            new_message=user_msg
        ):
            if event.is_final_response():
                if event.content and event.content.parts:
                    response_text = event.content.parts[0].text
                    
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
            "error": parsed["error"],
            "session_id": session_id
        }
        
        
    except HTTPException as e:
        return {"error": e.detail}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat processing error: {e}")