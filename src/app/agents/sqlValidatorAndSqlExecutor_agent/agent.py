from google.adk.agents import LlmAgent
from .prompt import name, description, instruction
from tools import get_schema, execute_sql
from google.adk.models.lite_llm import LiteLlm
import os

sqlValidatorAndSqlExecutor_agent = LlmAgent(
    model=LiteLlm(model=os.environ["MODEL"]),
    name=name,
    description=description,
    instruction=instruction,
    output_key="query_result",
    tools=[execute_sql,get_schema]
)