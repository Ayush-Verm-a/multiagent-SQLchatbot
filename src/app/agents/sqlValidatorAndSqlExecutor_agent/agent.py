from google.adk.agents import LlmAgent
from .prompt import name, description, instruction
from mcp_server.server.mcp_toolset import get_mcp_toolset
from google.adk.models.lite_llm import LiteLlm
import os

mcp_tools = get_mcp_toolset()

sqlValidatorAndSqlExecutor_agent = LlmAgent(
    model=LiteLlm(model=os.environ["MODEL"]),
    name=name,
    description=description,
    instruction=instruction,
    output_key="query_result",
    tools=[mcp_tools]
)