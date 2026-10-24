from fastapi import APIRouter, HTTPException, Form
from fastapi.responses import JSONResponse
from typing import Optional

from .file_manager import CURRENT_FILE_ID, UPLOAD_DIR

router = APIRouter(prefix="/api", tags=["chat"])

def parse_agent_response(response_text: str) -> dict:
    result = {
        "explanation": "",
        "query_result": None,
        "sql_query": None,
        "error": None
    }
    
    if not response_text:
        return result
    
    if "<<<EXPLANATION>>>" in response_text and "<<<" in response_text[response_text.find("<<<EXPLANATION>>>") + 17:]:
        start = response_text.find("<<<EXPLANATION>>>") + 17
        # Find the next delimiter
        next_delimiters = ["<<<QUERY_RESULT>>>", "<<<SQL>>>", "<<<ERROR>>>", "<<<INVALID>>>", "<<<END>>>"]
        end_positions = [response_text.find(d, start) for d in next_delimiters if response_text.find(d, start) != -1]
        end = min(end_positions) if end_positions else len(response_text)
        result["explanation"] = response_text[start:end].strip()
    
    # Extract QUERY_RESULT section (markdown table)
    if "<<<QUERY_RESULT>>>" in response_text:
        start = response_text.find("<<<QUERY_RESULT>>>") + 18
        end = response_text.find("<<<END>>>", start) if "<<<END>>>" in response_text[start:] else len(response_text)
        result["query_result"] = response_text[start:end].strip()
    
    # Extract SQL section
    if "<<<SQL>>>" in response_text:
        start = response_text.find("<<<SQL>>>") + 9
        end = response_text.find("<<<END>>>", start) if "<<<END>>>" in response_text[start:] else len(response_text)
        result["sql_query"] = response_text[start:end].strip()
    
    # Extract ERROR section
    if "<<<ERROR>>>" in response_text:
        start = response_text.find("<<<ERROR>>>") + 11
        end = response_text.find("<<<END>>>", start) if "<<<END>>>" in response_text[start:] else len(response_text)
        result["error"] = response_text[start:end].strip()
    
    # Extract INVALID section (treated as error)
    if "<<<INVALID>>>" in response_text:
        start = response_text.find("<<<INVALID>>>") + 13
        end = response_text.find("<<<END>>>", start) if "<<<END>>>" in response_text[start:] else len(response_text)
        result["error"] = response_text[start:end].strip()
    
    return result

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