from services import session_service, runner
from google.genai import types
import asyncio

async def test_greeting_agent():
    session = await session_service.create_session(
        app_name="sql_chatbot",
        user_id="test_user",
        session_id=None
    )
    
    user_message = types.UserContent("Hi, I want to use this SQL Chatbot")
    
    async for event in runner.run_async(
        user_id="test_user",
        session_id=session.id,
        new_message=user_message
    ):
        if event.is_final_response():
            print("Agent Response:\n")
            if event.content and event.content.parts:
                print(event.content.parts[0].text)
            else:
                print("[WARN] Final event has no content")
                
if __name__ == "__main__":
    asyncio.run(test_greeting_agent())