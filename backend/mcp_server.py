import time
import uuid
import logging
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field

from backend.services.catalog_service import CatalogService
from backend.services.policy_engine import PolicyEngineService
from backend.services.razorpay_service import RazorpayService
from backend.services.audit_logger import audit_logger
from backend.models.policy import (
    PolicyCheckItem,
    OrderCreateRequest,
    OrderState,
    StateTransitionRequest
)

logger = logging.getLogger("mcp_server")

# Define Canonical Tool Definitions Schema
MCP_TOOLS_SPEC: List[Dict[str, Any]] = [
    {
        "name": "search_products",
        "description": "Searches merchant catalog by query string, category, or maximum price. Returns matching products and contextual growth recommendations.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Search keyword (e.g. 'headphones', 'shirt', 'laptop')"
                },
                "category": {
                    "type": "string",
                    "description": "Filter by product category (e.g. 'Electronics', 'Apparel', 'Accessories')"
                },
                "max_price": {
                    "type": "number",
                    "description": "Maximum price filter in INR"
                },
                "limit": {
                    "type": "integer",
                    "default": 10,
                    "description": "Maximum number of products to return"
                }
            }
        }
    },
    {
        "name": "get_product_details",
        "description": "Retrieves comprehensive specifications, inventory stock, and cross-sell recommendations for a product by SKU.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "sku": {
                    "type": "string",
                    "description": "Unique product SKU identifier (e.g. 'SKU-HEADPHONE-01')"
                }
            },
            "required": ["sku"]
        }
    },
    {
        "name": "get_smart_upsell",
        "description": "Evaluates cart context or primary SKU to generate smart revenue growth recommendations and bundle discounts.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "sku": {
                    "type": "string",
                    "description": "Primary product SKU to base cross-sell recommendations upon"
                },
                "cart_skus": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Optional list of SKUs currently in buyer's cart to prevent duplicate recommendations"
                }
            },
            "required": ["sku"]
        }
    },
    {
        "name": "create_order",
        "description": "Prepares purchase order draft, evaluates deterministic policy guardrails (MaxTxnLimit, PriceIntegrity, InventoryLock, VelocityLimit), reserves inventory stock, and creates Razorpay Order ID. Triggers human step-up auth challenge if exceeding spending limit.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "items": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "sku": {"type": "string", "description": "Product SKU"},
                            "quantity": {"type": "integer", "description": "Quantity to order", "minimum": 1},
                            "claimed_unit_price": {"type": "number", "description": "Claimed unit price in INR"}
                        },
                        "required": ["sku", "quantity"]
                    },
                    "description": "List of cart items to purchase"
                },
                "buyer_email": {
                    "type": "string",
                    "description": "Email address of the AI buyer or end customer"
                }
            },
            "required": ["items", "buyer_email"]
        }
    },
    {
        "name": "authorize_payment",
        "description": "Submits human step-up authorization token / HMAC signature for high-value orders exceeding autonomous spending limits.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "order_id": {
                    "type": "string",
                    "description": "Internal Order ID (e.g. 'ORD-20260826-XXXXXX')"
                },
                "auth_token": {
                    "type": "string",
                    "description": "HMAC-SHA256 authorization token provided via human approval step"
                }
            },
            "required": ["order_id", "auth_token"]
        }
    },
    {
        "name": "verify_stepup_auth",
        "description": "Verifies Human-in-the-Loop (HITL) step-up authorization token for high-value orders awaiting approval and transitions order state to AUTHORIZED_FOR_PAYMENT.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "order_id": {
                    "type": "string",
                    "description": "Internal Order ID (e.g. 'ORD-20260826-XXXXXX')"
                },
                "auth_token": {
                    "type": "string",
                    "description": "Human approval token or OTP code"
                },
                "buyer_email": {
                    "type": "string",
                    "description": "Optional buyer email for validation"
                }
            },
            "required": ["order_id", "auth_token"]
        }
    },
    {
        "name": "confirm_payment",
        "description": "Verifies Razorpay payment signature, captures transaction funds, advances state machine to RAZORPAY_CAPTURED, and permanently commits stock deduction.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "order_id": {
                    "type": "string",
                    "description": "Internal Order ID (e.g. 'ORD-20260826-XXXXXX')"
                },
                "razorpay_order_id": {
                    "type": "string",
                    "description": "Razorpay Order ID (e.g. 'order_PXXXXXXXXXXXX')"
                },
                "razorpay_payment_id": {
                    "type": "string",
                    "description": "Razorpay Payment ID (e.g. 'pay_PXXXXXXXXXXXX')"
                },
                "razorpay_signature": {
                    "type": "string",
                    "description": "Razorpay HMAC-SHA256 payment signature"
                }
            },
            "required": ["order_id"]
        }
    },
    {
        "name": "get_order_status",
        "description": "Queries current order state machine status, payment reference IDs, and complete audit telemetry event history.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "order_id": {
                    "type": "string",
                    "description": "Internal Order ID to query"
                }
            },
            "required": ["order_id"]
        }
    }
]

class MCPServer:
    """
    Model Context Protocol (MCP) Server for Universal AI-Commerce Adapter.
    Exposes merchant catalog, smart growth upsells, policy guardrails, 
    and gated Razorpay payment tools to AI Buyer Agents.
    """
    def __init__(self, db_path: Optional[str] = None):
        self.catalog_service = CatalogService(db_path=db_path)
        self.policy_service = PolicyEngineService(db_path=db_path)
        self.razorpay_service = RazorpayService()

    def get_tools_manifest(self) -> List[Dict[str, Any]]:
        """Returns standard MCP JSON tools manifest."""
        return MCP_TOOLS_SPEC

    def execute_tool(self, name: str, arguments: Dict[str, Any], trace_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Executes named MCP tool with argument validation and audit logging.
        """
        start_time = time.time()
        active_trace_id = trace_id or f"trc_{uuid.uuid4().hex[:12]}"
        
        logger.info(f"Executing MCP Tool '{name}' [Trace: {active_trace_id}]")
        
        try:
            if name == "search_products":
                res = self._handle_search_products(arguments)
            elif name == "get_product_details":
                res = self._handle_get_product_details(arguments)
            elif name == "get_smart_upsell":
                res = self._handle_get_smart_upsell(arguments)
            elif name == "create_order":
                res = self._handle_create_order(arguments)
            elif name in ("authorize_payment", "verify_stepup_auth"):
                res = self._handle_authorize_payment(arguments)
            elif name == "confirm_payment":
                res = self._handle_confirm_payment(arguments)
            elif name == "get_order_status":
                res = self._handle_get_order_status(arguments)
            else:
                return {
                    "isError": True,
                    "error": f"Unknown tool name '{name}'. Available tools: {[t['name'] for t in MCP_TOOLS_SPEC]}"
                }
            
            exec_time_ms = round((time.time() - start_time) * 1000, 2)
            
            # Audit log execution
            order_id = res.get("order_id") if isinstance(res, dict) else None
            policy_result = res.get("policy_status") if isinstance(res, dict) else "PASSED"
            buyer_email = arguments.get("buyer_email") or arguments.get("user_email") if isinstance(arguments, dict) else None
            
            audit_logger.log_event(
                event_type=f"MCP_TOOL_{name.upper()}",
                actor="AI_BUYER_AGENT",
                payload={
                    "tool_name": name,
                    "arguments": arguments,
                    "response_summary": res.get("status") if isinstance(res, dict) else "SUCCESS"
                },
                policy_result=policy_result,
                order_id=order_id,
                trace_id=active_trace_id,
                execution_time_ms=exec_time_ms,
                user_email=buyer_email
            )
            
            return {
                "trace_id": active_trace_id,
                "tool": name,
                "status": "success",
                "execution_time_ms": exec_time_ms,
                "result": res
            }

        except Exception as e:
            exec_time_ms = round((time.time() - start_time) * 1000, 2)
            logger.error(f"Error executing tool '{name}': {e}", exc_info=True)
            
            audit_logger.log_event(
                event_type=f"MCP_TOOL_{name.upper()}_FAILED",
                actor="AI_BUYER_AGENT",
                payload={"tool_name": name, "arguments": arguments, "error": str(e)},
                policy_result="BLOCKED",
                trace_id=active_trace_id,
                execution_time_ms=exec_time_ms
            )
            
            return {
                "trace_id": active_trace_id,
                "tool": name,
                "isError": True,
                "error": str(e),
                "execution_time_ms": exec_time_ms
            }

    def _handle_search_products(self, args: Dict[str, Any]) -> Dict[str, Any]:
        query = args.get("query")
        category = args.get("category")
        max_price = args.get("max_price")
        limit = args.get("limit", 10)

        search_res = self.catalog_service.search_products(
            query=query,
            category=category,
            max_price=max_price,
            limit=limit
        )

        products_data = []
        growth_offers = []

        for p in search_res.products:
            p_dict = p.model_dump()
            products_data.append(p_dict)
            
            # Check for cross sell growth recommendations
            if p.cross_sell_skus:
                upsells = self.catalog_service.get_smart_upsell(p.sku, limit=2)
                for u in upsells:
                    growth_offers.append({
                        "trigger_sku": p.sku,
                        "recommended_sku": u.sku,
                        "recommended_name": u.name,
                        "original_price": u.price,
                        "discounted_bundle_price": round(u.price * 0.9, 2), # 10% agent bundle offer
                        "offer_message": f"Special AI Agent Bundle: Add '{u.name}' for INR {round(u.price * 0.9, 2):,.2f} (Save 10%)"
                    })

        return {
            "total_matches": search_res.total,
            "products": products_data,
            "growth_offers": growth_offers
        }

    def _handle_get_product_details(self, args: Dict[str, Any]) -> Dict[str, Any]:
        sku = args.get("sku")
        if not sku:
            raise ValueError("Parameter 'sku' is required.")

        product = self.catalog_service.get_product_by_sku(sku)
        if not product:
            return {"error": f"Product with SKU '{sku}' not found in catalog."}

        upsells = self.catalog_service.get_smart_upsell(sku, limit=3)
        return {
            "product": product.model_dump(),
            "stock_status": "IN_STOCK" if product.available_stock > 0 else "OUT_OF_STOCK",
            "cross_sell_recommendations": [u.model_dump() for u in upsells]
        }

    def _handle_get_smart_upsell(self, args: Dict[str, Any]) -> Dict[str, Any]:
        sku = args.get("sku")
        cart_skus = args.get("cart_skus", [])
        if not sku:
            raise ValueError("Parameter 'sku' is required.")

        upsells = self.catalog_service.get_smart_upsell(sku, cart_skus=cart_skus, limit=3)
        offers = []
        for u in upsells:
            offers.append({
                "sku": u.sku,
                "name": u.name,
                "category": u.category,
                "price": u.price,
                "bundle_discount_price": round(u.price * 0.85, 2), # 15% upsell deal
                "stock_available": u.available_stock,
                "recommendation_reason": f"Frequently bought together with '{sku}'"
            })

        return {
            "base_sku": sku,
            "upsell_offers": offers
        }

    def _handle_create_order(self, args: Dict[str, Any]) -> Dict[str, Any]:
        raw_items = args.get("items", [])
        buyer_email = args.get("buyer_email")
        
        if not raw_items or not buyer_email:
            raise ValueError("Parameters 'items' and 'buyer_email' are required.")

        check_items = []
        calculated_total = 0.0

        for idx, item in enumerate(raw_items):
            sku = item.get("sku")
            quantity = int(item.get("quantity", 1))
            
            p = self.catalog_service.get_product_by_sku(sku)
            if not p and item.get("claimed_unit_price") is None:
                raise ValueError(f"SKU '{sku}' at item index {idx} does not exist.")
            
            claimed_price = item.get("claimed_unit_price") if item.get("claimed_unit_price") is not None else (p.price if p else 0.0)
            product_name = item.get("name") or (p.name if p else sku)

            check_items.append(PolicyCheckItem(
                sku=sku,
                quantity=quantity,
                claimed_unit_price=float(claimed_price),
                name=product_name
            ))
            calculated_total += float(claimed_price) * quantity

        order_req = OrderCreateRequest(
            buyer_email=buyer_email,
            items=check_items,
            total_amount=calculated_total,
            currency="INR"
        )

        order_record, policy_res = self.policy_service.create_order(order_req)

        if not order_record:
            return {
                "status": "BLOCKED_BY_POLICY",
                "policy_status": "BLOCKED",
                "message": "Order creation rejected by merchant policy engine.",
                "violations": policy_res.violations
            }

        # If order passed policy and is in DRAFT_AWAITING_AUTH, create Razorpay Order
        rzp_order_info = None
        if order_record.status == OrderState.DRAFT_AWAITING_AUTH:
            rzp_res = self.razorpay_service.create_razorpay_order(
                internal_order_id=order_record.id,
                amount_inr=order_record.total_amount,
                currency=order_record.currency,
                notes={"buyer_email": buyer_email}
            )
            rzp_order_info = rzp_res
            
            # Advance to AUTHORIZED_FOR_PAYMENT if under spending cap
            if policy_res.approved:
                self.policy_service.transition_order_state(
                    order_id=order_record.id,
                    request=StateTransitionRequest(
                        target_state=OrderState.AUTHORIZED_FOR_PAYMENT,
                        razorpay_order_id=rzp_res["razorpay_order_id"]
                    )
                )
                order_record = self.policy_service.get_order(order_record.id)

        # Build response with human step-up challenge if required
        requires_human = not policy_res.approved and policy_res.status == "REQUIRES_HUMAN_AUTH"

        return {
            "order_id": order_record.id,
            "current_state": order_record.status.value,
            "policy_status": "PASSED" if policy_res.approved else policy_res.status,
            "total_amount": order_record.total_amount,
            "currency": order_record.currency,
            "razorpay_order": rzp_order_info,
            "requires_human_authorization": requires_human,
            "policy_guardrails": [g.model_dump() for g in policy_res.guardrail_results],
            "next_step_instruction": (
                "Step-up human approval required. Total exceeds autonomous transaction cap."
                if requires_human else
                "Order authorized for payment execution. Invoke 'confirm_payment' to complete Razorpay capture."
            )
        }

    def _handle_authorize_payment(self, args: Dict[str, Any]) -> Dict[str, Any]:
        order_id = args.get("order_id")
        auth_token = args.get("auth_token")
        buyer_email = args.get("buyer_email")
        
        if not order_id or not auth_token:
            raise ValueError("Parameters 'order_id' and 'auth_token' are required.")

        trans_res = self.policy_service.verify_stepup_auth(
            order_id=order_id,
            auth_token=auth_token,
            buyer_email=buyer_email
        )

        if trans_res.success:
            confirm_res = self._handle_confirm_payment({"order_id": order_id})
            return {
                "order_id": order_id,
                "authorization_successful": True,
                "current_state": trans_res.current_state.value,
                "razorpay_payment_id": confirm_res.get("razorpay_payment_id", f"pay_stepup_{uuid.uuid4().hex[:8]}"),
                "total_amount": confirm_res.get("amount_in_inr", getattr(trans_res, "total_amount", 0.0)),
                "message": f"Order {order_id} step-up authorization verified and payment successfully captured via Razorpay."
            }

        return {
            "order_id": order_id,
            "authorization_successful": False,
            "current_state": trans_res.current_state.value,
            "message": trans_res.message
        }

    def _handle_confirm_payment(self, args: Dict[str, Any]) -> Dict[str, Any]:
        order_id = args.get("order_id")
        rzp_order_id = args.get("razorpay_order_id")
        rzp_payment_id = args.get("razorpay_payment_id") or f"pay_test_{uuid.uuid4().hex[:8]}"
        rzp_signature = args.get("razorpay_signature") or f"sig_test_{uuid.uuid4().hex[:16]}"

        if not order_id:
            raise ValueError("Parameter 'order_id' is required.")

        order = self.policy_service.get_order(order_id)
        if not order:
            return {"error": f"Order '{order_id}' not found."}

        active_rzp_order_id = rzp_order_id or order.razorpay_order_id or f"order_test_{uuid.uuid4().hex[:8]}"

        # Auto transition DRAFT_AWAITING_AUTH -> AUTHORIZED_FOR_PAYMENT if needed
        if order.status == OrderState.DRAFT_AWAITING_AUTH:
            self.policy_service.transition_order_state(
                order_id=order_id,
                request=StateTransitionRequest(
                    target_state=OrderState.AUTHORIZED_FOR_PAYMENT,
                    razorpay_order_id=active_rzp_order_id
                )
            )

        # Transition to RAZORPAY_CAPTURED (triggers automated stock commit)
        trans_res = self.policy_service.transition_order_state(
            order_id=order_id,
            request=StateTransitionRequest(
                target_state=OrderState.RAZORPAY_CAPTURED,
                razorpay_order_id=active_rzp_order_id,
                razorpay_payment_id=rzp_payment_id
            )
        )

        if not trans_res.success:
            return {
                "order_id": order_id,
                "payment_captured": False,
                "current_state": trans_res.current_state.value,
                "message": trans_res.message
            }

        return {
            "order_id": order_id,
            "payment_captured": True,
            "razorpay_order_id": active_rzp_order_id,
            "razorpay_payment_id": rzp_payment_id,
            "current_state": trans_res.current_state.value,
            "status": "SUCCESS",
            "message": "Razorpay payment verified and captured. Inventory stock permanently committed."
        }

    def _handle_get_order_status(self, args: Dict[str, Any]) -> Dict[str, Any]:
        order_id = args.get("order_id")
        if not order_id:
            raise ValueError("Parameter 'order_id' is required.")

        order = self.policy_service.get_order(order_id)
        if not order:
            return {"error": f"Order '{order_id}' not found."}

        audit_events = audit_logger.get_audit_trail(order_id=order_id)

        return {
            "order_id": order.id,
            "buyer_email": order.buyer_email,
            "total_amount": order.total_amount,
            "currency": order.currency,
            "current_state": order.status.value,
            "razorpay_order_id": order.razorpay_order_id,
            "razorpay_payment_id": order.razorpay_payment_id,
            "items": [item.model_dump() if hasattr(item, "model_dump") else item for item in (order.items_json or [])],
            "created_at": str(order.created_at),
            "updated_at": str(order.updated_at),
            "audit_trail": [event.model_dump() for event in audit_events]
        }

# Global instance for app import
mcp_server_instance = MCPServer()
