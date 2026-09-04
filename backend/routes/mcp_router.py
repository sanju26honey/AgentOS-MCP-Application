from typing import Dict, Any, Optional, List
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from backend.mcp_server import mcp_server_instance

router = APIRouter(prefix="/api/mcp", tags=["Model Context Protocol (MCP) Tools"])

class MCPToolCallRequest(BaseModel):
    name: str = Field(..., description="Target MCP tool name to execute")
    arguments: Dict[str, Any] = Field(default_factory=dict, description="Tool execution argument parameters")
    trace_id: Optional[str] = Field(default=None, description="Optional UUIDv4 trace context identifier")

@router.get(
    "/tools",
    summary="List available Model Context Protocol (MCP) tool schemas",
    description="Returns OpenAPI/LLM function calling compatible JSON schema definitions for all merchant commerce tools exposed to AI Buyer agents."
)
async def list_mcp_tools():
    """Returns standard MCP JSON tools manifest."""
    tools = mcp_server_instance.get_tools_manifest()
    return {
        "count": len(tools),
        "tools": tools
    }

class StepUpAuthRequest(BaseModel):
    order_id: str = Field(..., description="Internal Order ID awaiting step-up authorization")
    auth_token: str = Field(..., description="Human approval token or OTP")
    buyer_email: Optional[str] = Field(default=None, description="Buyer email address for validation")

@router.post(
    "/call",
    summary="Execute Model Context Protocol (MCP) tool by name",
    description="Executes a named MCP tool with argument validation, policy guardrail enforcement, and real-time audit logging."
)
async def execute_mcp_tool(req: MCPToolCallRequest):
    """Executes a named tool call via the central MCP server dispatcher."""
    result = mcp_server_instance.execute_tool(
        name=req.name,
        arguments=req.arguments,
        trace_id=req.trace_id
    )

    if result.get("isError"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result
        )

    return result

from backend.agent.ai_buyer_agent import AIBuyerAgent
from backend.agent.llm_buyer_agent import llm_buyer_agent_instance

class AgentRunRequest(BaseModel):
    buyer_email: str = Field(default="customer_agent@ai.com", description="Buyer email address")
    search_query: Optional[str] = Field(default=None, description="Natural language product search query")
    prompt: Optional[str] = Field(default=None, description="Alias for search_query")
    max_price: float = Field(default=10000.0, description="Max budget cap in INR")
    include_upsell: bool = Field(default=True, description="Whether to evaluate AI cross-sell recommendations")
    auto_approve_stepup: bool = Field(default=False, description="If True, agent automatically auto-approves step-up auth without pausing for human interaction")
    stepup_token: Optional[str] = Field(default=None, description="Optional step-up auth token")

class AgentChatMessage(BaseModel):
    role: str = Field(default="user", description="Message sender role: 'user' or 'agent'")
    text: str = Field(..., description="Message text content")

class AgentChatRequest(BaseModel):
    messages: List[AgentChatMessage] = Field(..., description="List of multi-turn chat messages")
    buyer_email: str = Field(default="customer_agent@ai.com", description="Buyer email address")
    max_price: float = Field(default=10000.0, description="Max budget cap in INR")
    include_upsell: bool = Field(default=True, description="Whether to evaluate AI cross-sell recommendations")
    auto_approve_stepup: bool = Field(default=False, description="If True, agent automatically auto-approves step-up auth")
    stepup_token: Optional[str] = Field(default=None, description="Optional step-up auth token")

@router.post(
    "/agent/run",
    summary="Execute Autonomous AI Buyer Shopping Goal",
    description="Runs the end-to-end AI Buyer Agent shopping goal: search -> smart upsell -> policy pre-flight -> order draft -> HITL auth check -> Razorpay capture."
)
def run_agent_goal(req: AgentRunRequest):
    """Orchestrates an autonomous AI shopping pipeline and returns full tool execution traces."""
    agent = AIBuyerAgent(auto_approve_stepup=req.auto_approve_stepup)
    query = req.search_query or req.prompt or ""
    res = agent.execute_shopping_goal(
        buyer_email=req.buyer_email,
        search_query=query,
        max_price=req.max_price,
        include_upsell=req.include_upsell,
        stepup_token=req.stepup_token
    )
    return res

@router.post(
    "/agent/chat",
    summary="Conversational Customer AI Agent (MCP Tool Connected)",
    description="Interacts with the Customer AI Agent. Executes end-to-end commerce goals via merchant MCP tools."
)
def chat_agent_goal(req: AgentChatRequest):
    """Executes Customer AI Agent shopping goal via MCP tools and returns execution traces."""
    last_user_prompt = ""
    for m in reversed(req.messages):
        if m.role == "user" and m.text.strip():
            last_user_prompt = m.text.strip()
            break
    
    if not last_user_prompt:
        last_user_prompt = "Buy headphones under INR 5000"

    agent = AIBuyerAgent(auto_approve_stepup=req.auto_approve_stepup)
    res = agent.execute_shopping_goal(
        buyer_email=req.buyer_email,
        search_query=last_user_prompt,
        max_price=req.max_price,
        include_upsell=req.include_upsell,
        stepup_token=req.stepup_token
    )
    return res

@router.post(
    "/stepup",
    summary="Verify Human-in-the-Loop Step-Up Authorization",
    description="Submits human authorization token / OTP code for high-value orders awaiting approval in DRAFT_AWAITING_AUTH state."
)
async def verify_stepup_authorization(req: StepUpAuthRequest):
    """Submits step-up auth challenge token via HTTP wrapper endpoint."""
    result = mcp_server_instance.execute_tool(
        name="verify_stepup_auth",
        arguments={
            "order_id": req.order_id,
            "auth_token": req.auth_token,
            "buyer_email": req.buyer_email
        }
    )

    if result.get("isError"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result
        )

    return result



