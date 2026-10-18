"""SQL Agent - Orchestrates SQL query processing."""

from google.adk.agents import SequentialAgent
from .prompt import name, description

# Import sub-agents - must import from .agent module, not from parent package
from inputValidationAndSqlGeneration_agent.agent import inputValidationAndSqlGeneration_agent
from sqlValidatorAndSqlExecutor_agent.agent import sqlValidatorAndSqlExecutor_agent

sql_agent = SequentialAgent(
    name=name,
    description=description,
    sub_agents=[
        inputValidationAndSqlGeneration_agent,
        sqlValidatorAndSqlExecutor_agent
    ]
)