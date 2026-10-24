from google.adk.runners import Runner
from agents import orchestrator_agent
from .session_service import session_service

runner = Runner(agent=orchestrator_agent, app_name="sql-chatbot", session_service=session_service)