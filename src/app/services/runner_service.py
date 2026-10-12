from google.adk.runners import Runner
from agents import greeting_agent
from .session_service import session_service

runner = Runner(agent=greeting_agent, app_name="sql_chatbot", session_service=session_service)