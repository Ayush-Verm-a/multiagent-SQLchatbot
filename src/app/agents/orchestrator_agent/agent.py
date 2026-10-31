"""Orchestrator Agent - Main entry point for routing user queries."""

from google.adk.agents import LlmAgent
from .prompt import name, description, instruction

# Import sub-agents - must import from .agent module, not from parent package
from ..greeting_agent.agent import greeting_agent
from ..sql_agent.agent import sql_agent

from google.adk.models.lite_llm import LiteLlm
import os

orchestrator_agent = LlmAgent(
    model=LiteLlm(model=os.environ["MODEL"]),
    name=name,
    description=description,
    instruction=instruction,
    sub_agents=[
        greeting_agent,
        sql_agent
    ]
)