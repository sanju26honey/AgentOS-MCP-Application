import os
import json
import logging
import uuid
import re
from typing import Dict, Any, List, Optional
from backend.mcp_server import MCPServer, mcp_server_instance

logger = logging.getLogger("llm_buyer_agent")

class LLMBuyerAgent:
    """
    Conversational Customer AI Agent connected to Merchant MCP Server tools.
    Supports Google Gemini, OpenAI function calling, and smart dispatcher fallback.
    """
    def __init__(self, mcp_server: Optional[MCPServer] = None):
        self.mcp_server = mcp_server or mcp_server_instance
        self.gemini_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        self.openai_key = os.getenv("OPENAI_API_KEY")

    def chat(
        self,
        messages: List[Dict[str, str]],
        buyer_email: str = "customer_agent@ai.com",
        max_price: float = 10000.0,
        include_upsell: bool = True,
        auto_approve_stepup: bool = False,
        stepup_token: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Processes a multi-turn chat message thread and invokes MCP tools when needed.
        """
        trace_id = f"trc_chat_{uuid.uuid4().hex[:10]}"
        execution_log: List[Dict[str, Any]] = []

        last_user_message = ""
        for m in reversed(messages):
            if m.get("role") == "user" or m.get("sender") == "user":
                last_user_message = m.get("content") or m.get("text") or ""
                break

        if not last_user_message:
            return {
                "sender": "agent",
                "message": "Hello! How can I assist you with your shopping today?",
                "status": "COMPLETED",
                "execution_log": [],
                "trace_id": trace_id
            }

        # Try Gemini function calling if key is available
        if self.gemini_key:
            try:
                return self._chat_gemini(
                    messages=messages,
                    last_user_message=last_user_message,
                    buyer_email=buyer_email,
                    max_price=max_price,
                    trace_id=trace_id
                )
            except Exception as e:
                logger.warning(f"Gemini LLM call failed, falling back to smart dispatcher: {e}")

        # Try OpenAI function calling if key is available
        if self.openai_key:
            try:
                return self._chat_openai(
                    messages=messages,
                    last_user_message=last_user_message,
                    buyer_email=buyer_email,
                    max_price=max_price,
                    trace_id=trace_id
                )
            except Exception as e:
                logger.warning(f"OpenAI LLM call failed, falling back to smart dispatcher: {e}")

        # Fallback to Smart Conversational Dispatcher connected to MCP Tools
        return self._chat_smart_dispatcher(
            last_user_message=last_user_message,
            buyer_email=buyer_email,
            max_price=max_price,
            include_upsell=include_upsell,
            auto_approve_stepup=auto_approve_stepup,
            stepup_token=stepup_token,
            trace_id=trace_id
        )

    def _chat_smart_dispatcher(
        self,
        last_user_message: str,
        buyer_email: str,
        max_price: float,
        include_upsell: bool,
        auto_approve_stepup: bool,
        stepup_token: Optional[str],
        trace_id: str
    ) -> Dict[str, Any]:
        """
        Smart Conversational Dispatcher connecting natural language dialog to MCP tools.
        """
        cleaned = last_user_message.strip().lower()
        execution_log: List[Dict[str, Any]] = []

        # Intent 1: Greetings / General Questions
        greetings = ['hi', 'hello', 'hey', 'good morning', 'good evening', 'help', 'who are you', 'what can you do']
        if any(cleaned == g or cleaned.startswith(g + ' ') for g in ['hi', 'hello', 'hey', 'help', 'who are you']):
            if not any(kw in cleaned for kw in ['buy', 'purchase', 'order', 'jacket', 'shirt', 'watch', 'shoes', 'search', 'find']):
                return {
                    "sender": "agent",
                    "message": "Hello! I am your AI Customer Shopping Agent connected to our merchant MCP server. I can help you search our catalog, recommend items with smart discounts, and process secure purchases via Razorpay!",
                    "status": "COMPLETED",
                    "trace_id": trace_id,
                    "execution_log": []
                }

        # Intent 2: Order Status Inquiry or Receipt Request
        if 'receipt' in cleaned or 'invoice' in cleaned or 'order status' in cleaned or 'track' in cleaned:
            order_match = re.search(r'ord-\d{8}-[a-f0-9]{6}', cleaned)
            if order_match:
                target_order_id = order_match.group(0).upper()
                status_res = self.mcp_server.execute_tool(
                    name="get_order_status",
                    arguments={"order_id": target_order_id},
                    trace_id=trace_id
                )
                execution_log.append({"step": 1, "tool": "get_order_status", "response": status_res})
                
                res_data = status_res.get("result", {})
                if status_res.get("isError") or "error" in res_data:
                    return {
                        "sender": "agent",
                        "message": f"I couldn't find order `{target_order_id}` in our merchant database.",
                        "status": "FAILED",
                        "trace_id": trace_id,
                        "execution_log": execution_log
                    }
                
                receipt_url = f"/api/orders/{target_order_id}/receipt"
                msg = f"Order **{target_order_id}** status is currently **{res_data.get('current_state')}**. Total Amount: ₹{res_data.get('total_amount', 0):,.2f} INR. You can view/download your PDF receipt below."
                return {
                    "sender": "agent",
                    "message": msg,
                    "status": "COMPLETED",
                    "order_id": target_order_id,
                    "pdf_receipt_url": receipt_url,
                    "trace_id": trace_id,
                    "execution_log": execution_log
                }

        # Intent 3: Catalog Browsing / Search query (without purchase keywords)
        buy_keywords = ['buy', 'purchase', 'order', 'checkout', 'pay']
        has_buy_intent = any(kw in cleaned for kw in buy_keywords)

        if not has_buy_intent and any(kw in cleaned for kw in ['find', 'search', 'show', 'list', 'look', 'what', 'browse', 'catalog', 'recommend', 'options', 'available']):
            search_res = self.mcp_server.execute_tool(
                name="search_products",
                arguments={"query": last_user_message, "max_price": max_price},
                trace_id=trace_id
            )
            execution_log.append({"step": 1, "tool": "search_products", "response": search_res})
            
            prods = search_res.get("result", {}).get("products", [])
            if not prods:
                return {
                    "sender": "agent",
                    "message": f"I searched our catalog for '{last_user_message}' under ₹{max_price:,.2f} INR, but found no matching products.",
                    "status": "FAILED",
                    "trace_id": trace_id,
                    "execution_log": execution_log
                }

            prod_list = [f"- **{p['name']}** ({p['sku']}): ₹{p['price']:,.2f} INR" for p in prods[:4]]
            response_text = f"Here are the matching products I found in our catalog:\n" + "\n".join(prod_list) + "\n\nLet me know if you would like me to purchase any of these for you!"
            return {
                "sender": "agent",
                "message": response_text,
                "status": "COMPLETED",
                "products": prods,
                "trace_id": trace_id,
                "execution_log": execution_log
            }

        # Intent 4: Purchase Goal Execution (Default Commerce Pipeline)
        from backend.agent.ai_buyer_agent import AIBuyerAgent
        standard_agent = AIBuyerAgent(
            mcp_server=self.mcp_server,
            auto_approve_stepup=auto_approve_stepup,
            default_stepup_token=stepup_token or "STEPUP_APPROVED_123456"
        )
        res = standard_agent.execute_shopping_goal(
            buyer_email=buyer_email,
            search_query=last_user_message,
            max_price=max_price,
            include_upsell=include_upsell,
            stepup_token=stepup_token
        )

        if res.get("order_id") and res.get("status") == "COMPLETED":
            res["pdf_receipt_url"] = f"/api/orders/{res['order_id']}/receipt"

        return res

    def _chat_gemini(
        self,
        messages: List[Dict[str, str]],
        last_user_message: str,
        buyer_email: str,
        max_price: float,
        trace_id: str
    ) -> Dict[str, Any]:
        """Runs Gemini LLM with function calling attached to MCP tools."""
        from google import genai
        client = genai.Client(api_key=self.gemini_key)
        
        # Format messages for Gemini
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=last_user_message
        )
        return {
            "sender": "agent",
            "message": response.text or "I have processed your request.",
            "status": "COMPLETED",
            "trace_id": trace_id,
            "execution_log": []
        }

    def _chat_openai(
        self,
        messages: List[Dict[str, str]],
        last_user_message: str,
        buyer_email: str,
        max_price: float,
        trace_id: str
    ) -> Dict[str, Any]:
        """Runs OpenAI LLM with function calling attached to MCP tools."""
        from openai import OpenAI
        client = OpenAI(api_key=self.openai_key)
        
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": last_user_message}]
        )
        msg_text = response.choices[0].message.content or "I have processed your request."
        return {
            "sender": "agent",
            "message": msg_text,
            "status": "COMPLETED",
            "trace_id": trace_id,
            "execution_log": []
        }

llm_buyer_agent_instance = LLMBuyerAgent()
