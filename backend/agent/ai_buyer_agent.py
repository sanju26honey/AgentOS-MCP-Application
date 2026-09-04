import logging
import uuid
from typing import Dict, Any, List, Optional
from backend.mcp_server import MCPServer, mcp_server_instance

logger = logging.getLogger("ai_buyer_agent")

class AIBuyerAgent:
    """
    Autonomous AI Buyer Agent Orchestrator.
    Connects to the merchant's MCP Tool suite to execute end-to-end commerce workflows:
    Search -> Upsell Evaluation -> Policy Check & Order Draft -> HITL Step-Up Auth -> Razorpay Capture.
    """
    def __init__(
        self,
        mcp_server: Optional[MCPServer] = None,
        auto_approve_stepup: bool = False,
        default_stepup_token: str = "STEPUP_APPROVED_123456"
    ):
        self.mcp_server = mcp_server or mcp_server_instance
        self.auto_approve_stepup = auto_approve_stepup
        self.default_stepup_token = default_stepup_token

    def execute_shopping_goal(
        self,
        buyer_email: str,
        search_query: str,
        max_price: float = 10000.0,
        include_upsell: bool = True,
        stepup_token: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Executes a goal-driven shopping pipeline using standard MCP tool calls.
        """
        trace_id = f"trc_agent_{uuid.uuid4().hex[:10]}"
        execution_log: List[Dict[str, Any]] = []

        logger.info(f"AI Buyer Agent started shopping goal: query='{search_query}', max_price={max_price} [Trace: {trace_id}]")

        # GUARDRAIL 1: Explicit Commerce Intent & Product Keyword Verification
        commerce_keywords = {
            'buy', 'purchase', 'order', 'find', 'search', 'get', 'shop', 'checkout', 'add', 
            'want', 'looking', 'need', 'cart', 'biker', 'jacket', 'jackets', 'shirt', 'shirts', 'tee', 'tees', 'tshirt', 'tshirts', 
            'sweater', 'sweaters', 'shoes', 'shoe', 'sneakers', 'sneaker', 'boots', 'boot', 'watch', 'watches', 'wallet', 'wallets', 'bag', 'bags', 'sunglasses', 
            'earbuds', 'headphones', 'powerbank', 'powerbanks', 'power', 'bank', 'fitness', 'smartband', 
            'apparel', 'outerwear', 'footwear', 'gadget', 'gadgets', 'accessories', 'denim', 'windbreaker',
            'cotton', 'leather', 'wool', 'linen', 'suede', 'black', 'white', 'blue', 'item', 'items', 'product', 'products'
        }

        cleaned = search_query.strip().lower()
        import re
        # Remove commas from formatted numbers like 10,000 -> 10000
        cleaned_norm = re.sub(r'(?<=\d),(?=\d)', '', cleaned)
        prompt_words = set(re.findall(r'\b\w+\b', cleaned_norm))

        # GUARDRAIL 2: Natural Language Budget Extraction
        effective_max_price = max_price
        price_matches = re.findall(r'\b(?:under|below|less|max|budget)\b.*?(?:[₹\u20b9]|rs\.?|inr)?\s*(\d+(?:\.\d+)?)', cleaned_norm)
        if not price_matches:
            price_matches = re.findall(r'(?:[₹\u20b9]|rs\.?|inr)\s*(\d+(?:\.\d+)?)', cleaned_norm)

        if price_matches:
            try:
                extracted_price = float(price_matches[0])
                if extracted_price > 0:
                    effective_max_price = min(max_price, extracted_price)
            except ValueError:
                pass

        # GUARDRAIL 3: Natural Language Quantity Extraction
        target_quantity = 1
        price_val_int = int(effective_max_price) if effective_max_price > 0 else None

        qty_match = re.search(r'\b(?:buy|order|get|purchase|want|need|add)?\s*(\d+)\s*(?:x|pcs|pieces|units|items|pair|pairs|earphones|headphones|jackets|shirts|shoes|watches)?\s+(?:of\s+)?([a-z]+)', cleaned_norm)
        if qty_match:
            try:
                val = int(qty_match.group(1))
                if val != price_val_int and 1 <= val <= 1000:
                    target_quantity = val
            except ValueError:
                pass

        if target_quantity == 1:
            qty_match2 = re.search(r'\b(?:qty|quantity|count)\s*[:=]?\s*(\d+)\b', cleaned_norm)
            if qty_match2:
                try:
                    val = int(qty_match2.group(1))
                    if val != price_val_int and 1 <= val <= 1000:
                        target_quantity = val
                except ValueError:
                    pass

        # STEP 1: Search Merchant Catalog via MCP tool
        search_res = self.mcp_server.execute_tool(
            name="search_products",
            arguments={"query": search_query, "max_price": effective_max_price, "buyer_email": buyer_email},
            trace_id=trace_id
        )
        execution_log.append({"step": 1, "tool": "search_products", "response": search_res})

        products = search_res.get("result", {}).get("products", [])
        if not products:
            msg = f"No products found matching query '{search_query}' under INR {effective_max_price:,.2f}."
            return {
                "status": "FAILED",
                "message": msg,
                "reason": msg,
                "trace_id": trace_id,
                "execution_log": execution_log
            }

        primary_product = products[0]
        cart_items = [{
            "sku": primary_product["sku"],
            "quantity": target_quantity,
            "unit_price": primary_product["price"],
            "price": primary_product["price"],
            "name": primary_product["name"]
        }]

        # STEP 2: Smart Growth Upsell Evaluation (Optional)
        upsell_item = None
        bundle_keywords = {"bundle", "upsell", "combo", "pack", "accessory", "plus", "and", "+"}
        query_words = set(re.findall(r'\b\w+\b', search_query.lower()))
        has_bundle_intent = bool(query_words.intersection(bundle_keywords) or "+" in search_query)

        if include_upsell:
            upsell_res = self.mcp_server.execute_tool(
                name="get_smart_upsell",
                arguments={"sku": primary_product["sku"], "buyer_email": buyer_email},
                trace_id=trace_id
            )
            execution_log.append({"step": 2, "tool": "get_smart_upsell", "response": upsell_res})
            
            upsell_offers = upsell_res.get("result", {}).get("upsell_offers", [])
            if upsell_offers and has_bundle_intent:
                # Add highest relevant upsell if user requested bundle/combo and total remains within max_price
                best_offer = upsell_offers[0]
                offer_price = best_offer.get("price") or best_offer.get("unit_price") or 0.0
                calculated_total = (primary_product["price"] * target_quantity) + offer_price
                if calculated_total <= max_price:
                    upsell_item = best_offer
                    cart_items.append({
                        "sku": best_offer["sku"],
                        "quantity": 1,
                        "unit_price": offer_price,
                        "price": offer_price,
                        "name": best_offer.get("name", best_offer["sku"])
                    })

        # STEP 3: Order Creation & Policy Guardrail Pre-flight
        create_res = self.mcp_server.execute_tool(
            name="create_order",
            arguments={"items": cart_items, "buyer_email": buyer_email},
            trace_id=trace_id
        )
        execution_log.append({"step": 3, "tool": "create_order", "response": create_res})

        order_data = create_res.get("result", {})
        order_id = order_data.get("order_id")
        current_state = order_data.get("current_state")
        policy_status = order_data.get("policy_status")
        requires_human_auth = order_data.get("requires_human_authorization", False)

        if create_res.get("isError") or current_state == "BLOCKED_BY_POLICY" or policy_status == "BLOCKED_BY_POLICY" or not order_id:
            failed_guardrails = [g for g in order_data.get("policy_guardrails", []) if not g.get("passed")]
            reasons = [g.get("reason") for g in failed_guardrails] if failed_guardrails else order_data.get("violations", [])
            reason_str = " | ".join(reasons) if reasons else order_data.get("message", "Order creation rejected by merchant policy guardrails.")
            msg = f"Order blocked by merchant policy engine: {reason_str}"
            return {
                "status": "BLOCKED_BY_POLICY",
                "message": msg,
                "reason": reason_str,
                "order_id": order_id,
                "trace_id": trace_id,
                "execution_log": execution_log
            }

        # STEP 4: Human-in-the-Loop Step-Up Auth Handling (If Exceeding Autonomous Limit)
        if requires_human_auth or current_state == "DRAFT_AWAITING_AUTH":
            auth_token_to_use = stepup_token or self.default_stepup_token
            if self.auto_approve_stepup and auth_token_to_use:
                logger.info(f"Step-Up Auth Challenge triggered for Order '{order_id}'. Simulating HITL Approval...")
                stepup_res = self.mcp_server.execute_tool(
                    name="verify_stepup_auth",
                    arguments={
                        "order_id": order_id,
                        "auth_token": auth_token_to_use,
                        "buyer_email": buyer_email
                    },
                    trace_id=trace_id
                )
                execution_log.append({"step": 4, "tool": "verify_stepup_auth", "response": stepup_res})
                
                if stepup_res.get("result", {}).get("authorization_successful"):
                    current_state = stepup_res["result"]["current_state"]
                else:
                    return {
                        "status": "PAUSED_AWAITING_HUMAN_AUTH",
                        "order_id": order_id,
                        "reason": "Step-up authorization failed or token rejected.",
                        "trace_id": trace_id,
                        "execution_log": execution_log
                    }
            else:
                p_name = primary_product.get("name", primary_product.get("sku", "Product"))
                total_amt = order_data.get("total_amount", 0.0)
                msg = f"I pre-flighted your order ({order_id}) for {target_quantity}x {p_name} totaling ₹{total_amt:,.2f} INR. Since this exceeds your autonomous limit of ₹5,000.00, I have safely paused the order for your 1-click Step-Up Authorization."
                return {
                    "status": "PAUSED_AWAITING_HUMAN_AUTH",
                    "message": msg,
                    "order_id": order_id,
                    "reason": "High-value transaction requires explicit human step-up authorization.",
                    "trace_id": trace_id,
                    "execution_log": execution_log
                }

        # STEP 5: Payment Authorization & Razorpay Capture
        if current_state == "AUTHORIZED_FOR_PAYMENT":
            confirm_res = self.mcp_server.execute_tool(
                name="confirm_payment",
                arguments={"order_id": order_id},
                trace_id=trace_id
            )
            execution_log.append({"step": 5, "tool": "confirm_payment", "response": confirm_res})

        # STEP 6: Final Order Status & Immutable Audit Query
        status_res = self.mcp_server.execute_tool(
            name="get_order_status",
            arguments={"order_id": order_id},
            trace_id=trace_id
        )
        execution_log.append({"step": 6, "tool": "get_order_status", "response": status_res})

        final_order = status_res.get("result", {})

        # Build natural language summary message
        cart_sku_map = {item["sku"]: item.get("quantity", 1) for item in cart_items}
        purchased_products = []
        for p in products:
            if p.get("sku") in cart_sku_map:
                q = cart_sku_map[p.get("sku")]
                p_name = p.get("name", p.get("sku", "Product"))
                purchased_products.append(f"{q}x {p_name}" if q > 1 else p_name)
        
        items_summary = ", ".join(purchased_products) if purchased_products else "requested items"
        total_amt = final_order.get("total_amount", 0.0)
        summary_msg = f"I have successfully completed your purchase! Ordered {items_summary} for ₹{total_amt:,.2f} INR via Razorpay. Order ID: {order_id}."

        return {
            "status": "COMPLETED",
            "message": summary_msg,
            "order_id": order_id,
            "final_state": final_order.get("current_state"),
            "total_amount": total_amt,
            "buyer_email": buyer_email,
            "purchased_items": cart_items,
            "razorpay_payment_id": final_order.get("razorpay_payment_id"),
            "pdf_receipt_url": f"/api/orders/{order_id}/receipt",
            "audit_trail_count": len(final_order.get("audit_trail", [])),
            "trace_id": trace_id,
            "execution_log": execution_log
        }
