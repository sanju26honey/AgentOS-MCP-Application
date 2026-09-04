import json
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Tuple, Dict, Any

from backend.config import settings
from backend.db.database import get_db_connection
from backend.models.policy import (
    OrderState,
    GuardrailStatus,
    GuardrailResult,
    PolicyCheckItem,
    PolicyEvaluationRequest,
    PolicyEvaluationResponse,
    OrderCreateRequest,
    OrderRecord,
    StateTransitionRequest,
    StateTransitionResponse,
)

from backend.services.catalog_service import CatalogService
from backend.services.audit_logger import audit_logger

logger = logging.getLogger("policy_engine")

# Allowed state transition graph
VALID_TRANSITIONS: Dict[OrderState, List[OrderState]] = {
    OrderState.INITIALIZED: [
        OrderState.POLICY_CHECK,
        OrderState.BLOCKED_BY_POLICY,
        OrderState.CANCELLED,
    ],
    OrderState.POLICY_CHECK: [
        OrderState.DRAFT_AWAITING_AUTH,
        OrderState.BLOCKED_BY_POLICY,
        OrderState.CANCELLED,
    ],
    OrderState.DRAFT_AWAITING_AUTH: [
        OrderState.AUTHORIZED_FOR_PAYMENT,
        OrderState.EXPIRED,
        OrderState.CANCELLED,
    ],
    OrderState.AUTHORIZED_FOR_PAYMENT: [
        OrderState.RAZORPAY_CAPTURED,
        OrderState.EXPIRED,
        OrderState.CANCELLED,
    ],
    OrderState.RAZORPAY_CAPTURED: [],  # Terminal state
    OrderState.BLOCKED_BY_POLICY: [],  # Terminal state
    OrderState.EXPIRED: [],            # Terminal state
    OrderState.CANCELLED: [],          # Terminal state
}

class PolicyEngineService:
    def __init__(self, db_path: Optional[str] = None):
        self.db_path = db_path

    def _get_connection(self):
        return get_db_connection(self.db_path)

    def _check_max_txn_limit(self, total_amount: float) -> GuardrailResult:
        """Evaluates purchase amount against merchant MAX_AUTONOMOUS_TXN_LIMIT cap."""
        limit = settings.MAX_AUTONOMOUS_TXN_LIMIT
        if total_amount <= limit:
            return GuardrailResult(
                guardrail_name="MaxTxnLimit",
                status=GuardrailStatus.PASSED,
                passed=True,
                reason=f"Transaction total (INR {total_amount:,.2f}) is within autonomous processing limit (INR {limit:,.2f})."
            )
        else:
            return GuardrailResult(
                guardrail_name="MaxTxnLimit",
                status=GuardrailStatus.WARNING,
                passed=False,
                reason=f"Transaction total (INR {total_amount:,.2f}) exceeds autonomous limit (INR {limit:,.2f}). Requires step-up authorization."
            )

    def _check_price_integrity(
        self, items: List[PolicyCheckItem], claimed_total: float, conn, engine: str
    ) -> Tuple[GuardrailResult, float, List[Dict[str, Any]]]:
        """
        Validates submitted item prices and total order amount against authoritative catalog DB.
        Prevents price manipulation / cart tampering by AI buyers.
        """
        cursor = conn.cursor()
        calculated_total = 0.0
        validated_items = []
        violations = []

        for item in items:
            if engine == "postgresql":
                cursor.execute(
                    "SELECT sku, name, price, currency FROM products WHERE sku = %s;",
                    (item.sku,)
                )
            else:
                cursor.execute(
                    "SELECT sku, name, price, currency FROM products WHERE sku = ?;",
                    (item.sku,)
                )

            row = cursor.fetchone()
            if not row:
                violations.append(f"SKU '{item.sku}' does not exist in merchant catalog.")
                continue

            db_sku = row["sku"]
            db_name = row["name"]
            db_price = float(row["price"])
            db_currency = row["currency"]

            # Validate unit price matching (allowing small float epsilon)
            if abs(item.claimed_unit_price - db_price) > 0.01:
                violations.append(
                    f"Price tampering detected for SKU '{item.sku}': "
                    f"claimed INR {item.claimed_unit_price:.2f} vs catalog price INR {db_price:.2f}."
                )

            line_total = db_price * item.quantity
            calculated_total += line_total
            validated_items.append({
                "sku": db_sku,
                "name": db_name,
                "quantity": item.quantity,
                "unit_price": db_price,
                "line_total": line_total,
                "currency": db_currency
            })

        # Validate total order amount
        if abs(claimed_total - calculated_total) > 0.01:
            violations.append(
                f"Total amount tampering detected: claimed total INR {claimed_total:.2f} "
                f"vs calculated catalog total INR {calculated_total:.2f}."
            )

        if violations:
            return (
                GuardrailResult(
                    guardrail_name="PriceIntegrityGuard",
                    status=GuardrailStatus.FAILED,
                    passed=False,
                    reason=" | ".join(violations)
                ),
                calculated_total,
                validated_items
            )

        return (
            GuardrailResult(
                guardrail_name="PriceIntegrityGuard",
                status=GuardrailStatus.PASSED,
                passed=True,
                reason="All item unit prices and order total verified against authoritative catalog database."
            ),
            calculated_total,
            validated_items
        )

    def _check_velocity_limit(
        self, buyer_email: str, conn, engine: str, window_seconds: int = 60, max_orders: int = 5
    ) -> GuardrailResult:
        """Rate limits automated order submissions per buyer email to prevent DOS or runaway agent loops."""
        cursor = conn.cursor()
        time_cutoff = (datetime.now(timezone.utc) - timedelta(seconds=window_seconds)).isoformat()

        if engine == "postgresql":
            cursor.execute(
                """
                SELECT COUNT(*) as order_count FROM orders 
                WHERE buyer_email = %s AND created_at >= %s;
                """,
                (buyer_email, time_cutoff)
            )
        else:
            cursor.execute(
                """
                SELECT COUNT(*) as order_count FROM orders 
                WHERE buyer_email = ? AND created_at >= ?;
                """,
                (buyer_email, time_cutoff)
            )

        row = cursor.fetchone()
        order_count = row["order_count"] if row else 0

        if order_count >= max_orders:
            return GuardrailResult(
                guardrail_name="VelocityLimitGuard",
                status=GuardrailStatus.FAILED,
                passed=False,
                reason=f"Velocity limit breach: Buyer '{buyer_email}' submitted {order_count} orders in the last {window_seconds}s (limit: {max_orders})."
            )

        return GuardrailResult(
            guardrail_name="VelocityLimitGuard",
            status=GuardrailStatus.PASSED,
            passed=True,
            reason=f"Velocity check passed ({order_count}/{max_orders} recent orders)."
        )

    def _check_inventory_lock(
        self, items: List[PolicyCheckItem], conn, engine: str
    ) -> GuardrailResult:
        """Verifies real-time stock availability in merchant inventory table."""
        cursor = conn.cursor()
        insufficient_stock_skus = []

        for item in items:
            if engine == "postgresql":
                cursor.execute(
                    "SELECT available_stock FROM inventory WHERE sku = %s;",
                    (item.sku,)
                )
            else:
                cursor.execute(
                    "SELECT available_stock FROM inventory WHERE sku = ?;",
                    (item.sku,)
                )

            row = cursor.fetchone()
            available = row["available_stock"] if row else 0

            if available < item.quantity:
                insufficient_stock_skus.append(
                    f"SKU '{item.sku}' (Requested: {item.quantity}, Available: {available})"
                )

        if insufficient_stock_skus:
            return GuardrailResult(
                guardrail_name="InventoryLockGuard",
                status=GuardrailStatus.FAILED,
                passed=False,
                reason=f"Insufficient inventory: {', '.join(insufficient_stock_skus)}."
            )

        return GuardrailResult(
            guardrail_name="InventoryLockGuard",
            status=GuardrailStatus.PASSED,
            passed=True,
            reason="All requested item quantities are in stock and locked for reservation."
        )

    def evaluate_policy(self, request: PolicyEvaluationRequest, order_id: Optional[str] = None) -> PolicyEvaluationResponse:
        """
        Executes all 4 deterministic merchant guardrails:
        1. PriceIntegrityGuard (Anti-tampering)
        2. InventoryLockGuard (Stock check)
        3. VelocityLimitGuard (Rate check)
        4. MaxTxnLimit (Spending threshold)
        """
        conn, engine = self._get_connection()
        try:
            guardrail_results = []
            violations = []

            # 1. Price Integrity Guard
            price_res, calculated_total, validated_items = self._check_price_integrity(
                request.items, request.total_amount, conn, engine
            )
            guardrail_results.append(price_res)
            if not price_res.passed:
                violations.append(price_res.reason)

            # 2. Inventory Lock Guard
            inv_res = self._check_inventory_lock(request.items, conn, engine)
            guardrail_results.append(inv_res)
            if not inv_res.passed:
                violations.append(inv_res.reason)

            # 3. Velocity Limit Guard
            vel_res = self._check_velocity_limit(request.buyer_email, conn, engine)
            guardrail_results.append(vel_res)
            if not vel_res.passed:
                violations.append(vel_res.reason)

            # 4. Max Txn Limit Guard
            limit_res = self._check_max_txn_limit(request.total_amount)
            guardrail_results.append(limit_res)

            # Determine overall decision status
            critical_passed = price_res.passed and inv_res.passed and vel_res.passed

            if not critical_passed:
                approved = False
                overall_status = OrderState.BLOCKED_BY_POLICY.value
            elif request.total_amount > settings.MAX_AUTONOMOUS_TXN_LIMIT:
                approved = False
                overall_status = "REQUIRES_HUMAN_AUTH"
            else:
                approved = True
                overall_status = "APPROVED_AUTONOMOUS"

            response = PolicyEvaluationResponse(
                approved=approved,
                status=overall_status,
                allowed_amount=settings.MAX_AUTONOMOUS_TXN_LIMIT,
                calculated_total=calculated_total,
                guardrail_results=guardrail_results,
                violations=violations
            )

            audit_logger.log_event(
                event_type="POLICY_CHECK",
                actor="POLICY_ENGINE",
                order_id=order_id,
                payload={
                    "buyer_email": request.buyer_email,
                    "claimed_total": request.total_amount,
                    "calculated_total": calculated_total,
                    "approved": approved,
                    "status": overall_status,
                    "violations": violations
                },
                policy_result="PASSED" if approved else "BLOCKED"
            )

            return response
        finally:
            conn.close()

    def validate_transition(self, current_state: OrderState, target_state: OrderState) -> Tuple[bool, str]:
        """Enforces strict state machine transition graph."""
        allowed_targets = VALID_TRANSITIONS.get(current_state, [])
        if target_state in allowed_targets:
            return True, f"Valid state transition from {current_state.value} to {target_state.value}."
        return False, f"Invalid state transition: Cannot transition order from {current_state.value} to {target_state.value}."

    def create_order(self, request: OrderCreateRequest) -> Tuple[Optional[OrderRecord], PolicyEvaluationResponse]:
        """
        Evaluates policy, creates database order record, and manages stock reservation.
        """
        order_id = f"ORD-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
        policy_eval_req = PolicyEvaluationRequest(
            buyer_email=request.buyer_email,
            items=request.items,
            total_amount=request.total_amount,
            currency=request.currency
        )
        policy_res = self.evaluate_policy(policy_eval_req, order_id=order_id)
        
        # Decide initial order state
        if not policy_res.approved and policy_res.status == OrderState.BLOCKED_BY_POLICY.value:
            initial_state = OrderState.BLOCKED_BY_POLICY
        elif policy_res.status == "REQUIRES_HUMAN_AUTH":
            initial_state = OrderState.DRAFT_AWAITING_AUTH
        else:
            initial_state = OrderState.DRAFT_AWAITING_AUTH

        conn, engine = self._get_connection()
        cursor = conn.cursor()

        try:
            # Build authoritative items JSON payload
            _, _, validated_items = self._check_price_integrity(request.items, request.total_amount, conn, engine)
            items_json_str = json.dumps(validated_items)

            # Reserve stock in inventory if policy passed
            if initial_state != OrderState.BLOCKED_BY_POLICY:
                for item in request.items:
                    if engine == "postgresql":
                        cursor.execute(
                            """
                            UPDATE inventory 
                            SET available_stock = available_stock - %s,
                                reserved_stock = reserved_stock + %s
                            WHERE sku = %s AND available_stock >= %s;
                            """,
                            (item.quantity, item.quantity, item.sku, item.quantity)
                        )
                    else:
                        cursor.execute(
                            """
                            UPDATE inventory 
                            SET available_stock = available_stock - ?,
                                reserved_stock = reserved_stock + ?
                            WHERE sku = ? AND available_stock >= ?;
                            """,
                            (item.quantity, item.quantity, item.sku, item.quantity)
                        )

            # Insert order record into database
            now_iso = datetime.now(timezone.utc).isoformat()
            if engine == "postgresql":
                cursor.execute(
                    """
                    INSERT INTO orders (
                        id, buyer_email, total_amount, currency, status, 
                        items_json, created_at, updated_at
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s);
                    """,
                    (
                        order_id, request.buyer_email, policy_res.calculated_total, 
                        request.currency, initial_state.value, items_json_str, 
                        now_iso, now_iso
                    )
                )
            else:
                cursor.execute(
                    """
                    INSERT INTO orders (
                        id, buyer_email, total_amount, currency, status, 
                        items_json, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?);
                    """,
                    (
                        order_id, request.buyer_email, str(policy_res.calculated_total), 
                        request.currency, initial_state.value, items_json_str, 
                        now_iso, now_iso
                    )
                )

            conn.commit()

            order_record = OrderRecord(
                id=order_id,
                buyer_email=request.buyer_email,
                total_amount=policy_res.calculated_total,
                currency=request.currency,
                status=initial_state,
                items_json=validated_items,
                created_at=now_iso,
                updated_at=now_iso
            )

            audit_logger.log_event(
                event_type="ORDER_CREATED",
                actor="AI_BUYER",
                order_id=order_id,
                payload={
                    "buyer_email": request.buyer_email,
                    "total_amount": policy_res.calculated_total,
                    "initial_state": initial_state.value,
                    "items": validated_items
                },
                policy_result="PASSED" if initial_state != OrderState.BLOCKED_BY_POLICY else "BLOCKED"
            )

            return order_record, policy_res
        except Exception as e:
            conn.rollback()
            logger.error(f"Failed to create order in database: {e}")
            raise e
        finally:
            conn.close()

    def get_order(self, order_id: str) -> Optional[OrderRecord]:
        """Fetches order record from database by order ID."""
        conn, engine = self._get_connection()
        cursor = conn.cursor()
        try:
            if engine == "postgresql":
                cursor.execute("SELECT * FROM orders WHERE id = %s;", (order_id,))
            else:
                cursor.execute("SELECT * FROM orders WHERE id = ?;", (order_id,))

            row = cursor.fetchone()
            if not row:
                return None

            items_data = row["items_json"]
            if isinstance(items_data, str):
                items_json = json.loads(items_data)
            else:
                items_json = items_data

            return OrderRecord(
                id=row["id"],
                buyer_email=row["buyer_email"],
                total_amount=float(row["total_amount"]),
                currency=row["currency"] or "INR",
                status=OrderState(row["status"]),
                razorpay_order_id=row["razorpay_order_id"],
                razorpay_payment_id=row["razorpay_payment_id"],
                items_json=items_json,
                created_at=row["created_at"].isoformat() if hasattr(row["created_at"], "isoformat") else (str(row["created_at"]) if row["created_at"] is not None else None),
                updated_at=row["updated_at"].isoformat() if hasattr(row["updated_at"], "isoformat") else (str(row["updated_at"]) if row["updated_at"] is not None else None)
            )
        finally:
            conn.close()

    def list_orders(self, buyer_email: Optional[str] = None, limit: int = 50) -> List[OrderRecord]:
        """Lists all orders stored in persistent database."""
        conn, engine = self._get_connection()
        cursor = conn.cursor()
        try:
            if engine == "postgresql":
                if buyer_email:
                    cursor.execute("SELECT * FROM orders WHERE buyer_email = %s ORDER BY created_at DESC LIMIT %s;", (buyer_email, limit))
                else:
                    cursor.execute("SELECT * FROM orders ORDER BY created_at DESC LIMIT %s;", (limit,))
            else:
                if buyer_email:
                    cursor.execute("SELECT * FROM orders WHERE buyer_email = ? ORDER BY created_at DESC LIMIT ?;", (buyer_email, limit))
                else:
                    cursor.execute("SELECT * FROM orders ORDER BY created_at DESC LIMIT ?;", (limit,))

            rows = cursor.fetchall()
            records = []
            for row in rows:
                items_data = row["items_json"]
                if isinstance(items_data, str):
                    try:
                        items_json = json.loads(items_data)
                    except Exception:
                        items_json = []
                else:
                    items_json = items_data or []

                records.append(OrderRecord(
                    id=row["id"],
                    buyer_email=row["buyer_email"],
                    total_amount=float(row["total_amount"]),
                    currency=row["currency"] or "INR",
                    status=OrderState(row["status"]),
                    razorpay_order_id=row["razorpay_order_id"],
                    razorpay_payment_id=row["razorpay_payment_id"],
                    items_json=items_json,
                    created_at=row["created_at"].isoformat() if hasattr(row["created_at"], "isoformat") else (str(row["created_at"]) if row["created_at"] is not None else None),
                    updated_at=row["updated_at"].isoformat() if hasattr(row["updated_at"], "isoformat") else (str(row["updated_at"]) if row["updated_at"] is not None else None)
                ))
            return records
        finally:
            conn.close()

    def transition_order_state(
        self, order_id: str, request: StateTransitionRequest
    ) -> StateTransitionResponse:
        """Executes validated state machine transition for an order."""
        current_order = self.get_order(order_id)
        if not current_order:
            return StateTransitionResponse(
                success=False,
                order_id=order_id,
                previous_state=OrderState.INITIALIZED,
                current_state=OrderState.INITIALIZED,
                message=f"Order '{order_id}' not found."
            )

        previous_state = current_order.status
        is_valid, reason = self.validate_transition(previous_state, request.target_state)

        if not is_valid:
            return StateTransitionResponse(
                success=False,
                order_id=order_id,
                previous_state=previous_state,
                current_state=previous_state,
                message=reason
            )

        conn, engine = self._get_connection()
        cursor = conn.cursor()
        try:
            now_iso = datetime.now(timezone.utc).isoformat()
            
            # Prepare update queries
            fields = ["status = %s", "updated_at = %s"] if engine == "postgresql" else ["status = ?", "updated_at = ?"]
            params = [request.target_state.value, now_iso]

            if request.razorpay_order_id:
                fields.append("razorpay_order_id = %s" if engine == "postgresql" else "razorpay_order_id = ?")
                params.append(request.razorpay_order_id)

            if request.razorpay_payment_id:
                fields.append("razorpay_payment_id = %s" if engine == "postgresql" else "razorpay_payment_id = ?")
                params.append(request.razorpay_payment_id)

            if request.auth_token:
                fields.append("auth_token = %s" if engine == "postgresql" else "auth_token = ?")
                params.append(request.auth_token)

            params.append(order_id)
            query = f"UPDATE orders SET {', '.join(fields)} WHERE id = {'%s' if engine == 'postgresql' else '?'};"
            
            cursor.execute(query, params)
            conn.commit()

            # Execute automated inventory side-effects upon financial state change
            catalog_service = CatalogService(db_path=self.db_path)
            if request.target_state == OrderState.RAZORPAY_CAPTURED:
                for item in current_order.items_json:
                    sku = item.get("sku")
                    qty = item.get("quantity", 1)
                    if sku:
                        catalog_service.commit_stock_deduction(sku=sku, quantity=qty)
            elif request.target_state in (OrderState.CANCELLED, OrderState.EXPIRED):
                for item in current_order.items_json:
                    sku = item.get("sku")
                    qty = item.get("quantity", 1)
                    if sku:
                        catalog_service.release_stock(sku=sku, quantity=qty)

            audit_logger.log_event(
                event_type="ORDER_STATE_TRANSITION",
                actor="SYSTEM",
                order_id=order_id,
                payload={
                    "previous_state": previous_state.value,
                    "target_state": request.target_state.value,
                    "razorpay_order_id": request.razorpay_order_id,
                    "razorpay_payment_id": request.razorpay_payment_id,
                    "auth_token": request.auth_token,
                    "reason": request.reason
                },
                policy_result="PASSED"
            )

            return StateTransitionResponse(
                success=True,
                order_id=order_id,
                previous_state=previous_state,
                current_state=request.target_state,
                message=f"Order successfully transitioned from {previous_state.value} to {request.target_state.value}."
            )
        except Exception as e:
            conn.rollback()
            logger.error(f"Failed to transition order state: {e}")
            return StateTransitionResponse(
                success=False,
                order_id=order_id,
                previous_state=previous_state,
                current_state=previous_state,
                message=f"Database update failed: {e}"
            )
        finally:
            conn.close()

    def verify_stepup_auth(
        self, order_id: str, auth_token: str, buyer_email: Optional[str] = None
    ) -> StateTransitionResponse:
        """
        Verifies Human-in-the-Loop (HITL) step-up authorization token for high-value orders
        awaiting approval and transitions order state to AUTHORIZED_FOR_PAYMENT.
        """
        current_order = self.get_order(order_id)
        if not current_order:
            return StateTransitionResponse(
                success=False,
                order_id=order_id,
                previous_state=OrderState.INITIALIZED,
                current_state=OrderState.INITIALIZED,
                message=f"Order '{order_id}' not found for step-up authentication."
            )

        if current_order.status != OrderState.DRAFT_AWAITING_AUTH:
            return StateTransitionResponse(
                success=False,
                order_id=order_id,
                previous_state=current_order.status,
                current_state=current_order.status,
                message=f"Order '{order_id}' is in state {current_order.status.value}, not DRAFT_AWAITING_AUTH."
            )

        if buyer_email and current_order.buyer_email != buyer_email:
            return StateTransitionResponse(
                success=False,
                order_id=order_id,
                previous_state=current_order.status,
                current_state=current_order.status,
                message=f"Buyer email mismatch for order '{order_id}'."
            )

        if not auth_token or not auth_token.strip():
            return StateTransitionResponse(
                success=False,
                order_id=order_id,
                previous_state=current_order.status,
                current_state=current_order.status,
                message="Invalid or empty step-up authorization token."
            )

        # Transition order state to AUTHORIZED_FOR_PAYMENT
        transition_req = StateTransitionRequest(
            target_state=OrderState.AUTHORIZED_FOR_PAYMENT,
            auth_token=auth_token,
            reason="Human-in-the-Loop Step-Up Authorization verified successfully."
        )

        res = self.transition_order_state(order_id, transition_req)

        audit_logger.log_event(
            event_type="STEPUP_AUTH_VERIFIED",
            actor="HUMAN_USER",
            order_id=order_id,
            payload={
                "order_id": order_id,
                "auth_token": auth_token,
                "buyer_email": current_order.buyer_email,
                "total_amount": current_order.total_amount,
                "success": res.success
            },
            policy_result="PASSED" if res.success else "FAILED"
        )

        return res

