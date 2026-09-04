import json
import uuid
import logging
import asyncio
from typing import List, Optional, Dict, Any, Set
from datetime import datetime, timezone
from backend.db.database import get_db_connection
from backend.models.telemetry import AuditEvent, AuditEventCreate

logger = logging.getLogger("audit_logger")

class AuditLogger:
    """
    Append-Only Audit Telemetry Logger Service.
    Persists structured event traces to SQLite/PostgreSQL WAL ledger
    and broadcasts events in real-time to SSE stream subscribers.
    """

    def __init__(self, db_path: Optional[str] = None):
        self.db_path = db_path
        self._subscribers: Set[asyncio.Queue] = set()

    def subscribe(self) -> asyncio.Queue:
        """Subscribes a new SSE listener queue."""
        queue = asyncio.Queue(maxsize=200)
        self._subscribers.add(queue)
        logger.info(f"New SSE client subscribed. Total subscribers: {len(self._subscribers)}")
        return queue

    def unsubscribe(self, queue: asyncio.Queue) -> None:
        """Removes an active SSE listener queue."""
        self._subscribers.discard(queue)
        logger.info(f"SSE client unsubscribed. Remaining subscribers: {len(self._subscribers)}")

    def _broadcast_event(self, event: AuditEvent) -> None:
        """Broadcasts an audit event to all active SSE subscriber queues."""
        dead_queues = set()
        for q in self._subscribers:
            try:
                q.put_nowait(event)
            except asyncio.QueueFull:
                logger.warning("Subscriber queue full; dropping event to prevent blocking.")
            except Exception as e:
                logger.error(f"Error pushing event to SSE queue: {e}")
                dead_queues.add(q)
        
        for q in dead_queues:
            self._subscribers.discard(q)

    def log_event(
        self,
        event_type: str,
        actor: str = "SYSTEM",
        payload: Optional[Dict[str, Any]] = None,
        policy_result: Optional[str] = None,
        order_id: Optional[str] = None,
        trace_id: Optional[str] = None,
        execution_time_ms: float = 0.0,
        user_email: Optional[str] = None
    ) -> AuditEvent:
        """
        Appends an immutable audit event trace to SQLite/PostgreSQL WAL ledger
        and broadcasts to real-time subscribers.
        """
        active_trace_id = trace_id or f"trc_{uuid.uuid4().hex[:12]}"
        payload_dict = payload or {}
        
        # Auto-extract policy_result if in payload and not passed explicitly
        if not policy_result and "policy_result" in payload_dict:
            policy_result = payload_dict["policy_result"]
            
        payload_str = json.dumps(payload_dict)
        now_iso = datetime.now(timezone.utc).isoformat()

        # Extract user_email from payload or arguments if not passed
        extracted_email = (
            user_email or 
            payload_dict.get("buyer_email") or 
            payload_dict.get("user_email") or 
            payload_dict.get("email")
        )
        if not extracted_email and isinstance(payload_dict.get("arguments"), dict):
            extracted_email = (
                payload_dict["arguments"].get("buyer_email") or 
                payload_dict["arguments"].get("user_email")
            )

        conn, engine = get_db_connection(self.db_path)
        cursor = conn.cursor()

        try:
            # If email is still missing but order_id is present, look up buyer_email from orders
            if not extracted_email and order_id:
                try:
                    if engine == "postgresql":
                        cursor.execute("SELECT buyer_email FROM orders WHERE id = %s;", (order_id,))
                    else:
                        cursor.execute("SELECT buyer_email FROM orders WHERE id = ?;", (order_id,))
                    o_row = cursor.fetchone()
                    if o_row:
                        extracted_email = o_row["buyer_email"] if isinstance(o_row, dict) else o_row[0]
                except Exception:
                    pass

            if engine == "postgresql":
                cursor.execute(
                    """
                    INSERT INTO audit_telemetry (
                        trace_id, order_id, event_type, actor, payload_json, execution_time_ms, created_at
                    ) VALUES (%s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP)
                    RETURNING id, created_at;
                    """,
                    (active_trace_id, order_id, event_type, actor, payload_str, execution_time_ms)
                )
                row = cursor.fetchone()
                db_id = row['id'] if isinstance(row, dict) else row[0]
                created_at_val = str(row['created_at']) if isinstance(row, dict) else str(row[1])
                conn.commit()
            else:
                cursor.execute(
                    """
                    INSERT INTO audit_telemetry (
                        trace_id, order_id, event_type, actor, payload_json, execution_time_ms
                    ) VALUES (?, ?, ?, ?, ?, ?);
                    """,
                    (active_trace_id, order_id, event_type, actor, payload_str, execution_time_ms)
                )
                conn.commit()
                db_id = cursor.lastrowid
                created_at_val = now_iso

            event = AuditEvent(
                id=db_id,
                trace_id=active_trace_id,
                order_id=order_id,
                user_email=extracted_email,
                event_type=event_type,
                actor=actor,
                payload=payload_dict,
                policy_result=policy_result,
                execution_time_ms=execution_time_ms,
                created_at=created_at_val
            )

            self._broadcast_event(event)
            return event
        except Exception as e:
            logger.error(f"Failed to persist audit log event: {e}")
            raise
        finally:
            conn.close()

    async def log_event_async(
        self,
        event_type: str,
        actor: str = "SYSTEM",
        payload: Optional[Dict[str, Any]] = None,
        policy_result: Optional[str] = None,
        order_id: Optional[str] = None,
        trace_id: Optional[str] = None,
        execution_time_ms: float = 0.0,
        user_email: Optional[str] = None
    ) -> AuditEvent:
        """Async wrapper for log_event."""
        return self.log_event(
            event_type=event_type,
            actor=actor,
            payload=payload,
            policy_result=policy_result,
            order_id=order_id,
            trace_id=trace_id,
            execution_time_ms=execution_time_ms,
            user_email=user_email
        )

    def get_audit_trail(
        self,
        order_id: Optional[str] = None,
        trace_id: Optional[str] = None,
        event_type: Optional[str] = None,
        limit: int = 100
    ) -> List[AuditEvent]:
        """Fetches historical audit events from DB ledger matching filter criteria."""
        conn, engine = get_db_connection(self.db_path)
        cursor = conn.cursor()

        try:
            query = "SELECT * FROM audit_telemetry WHERE 1=1"
            params = []

            if order_id:
                query += " AND order_id = ?" if engine == "sqlite" else " AND order_id = %s"
                params.append(order_id)

            if trace_id:
                query += " AND trace_id = ?" if engine == "sqlite" else " AND trace_id = %s"
                params.append(trace_id)

            if event_type:
                query += " AND event_type = ?" if engine == "sqlite" else " AND event_type = %s"
                params.append(event_type)

            query += " ORDER BY id DESC LIMIT " + ("?" if engine == "sqlite" else "%s")
            params.append(limit)

            cursor.execute(query, tuple(params))
            rows = cursor.fetchall()

            # Batch lookup buyer_email for order IDs found in log rows
            # Batch lookup buyer_email for order IDs found in log rows
            order_ids_to_fetch = set()
            trace_order_map = {}
            trace_email_map = {}

            for row in rows:
                r_dict = dict(row)
                t_id = r_dict.get("trace_id")
                o_id = r_dict.get("order_id")
                if o_id:
                    order_ids_to_fetch.add(o_id)
                if t_id and o_id:
                    trace_order_map[t_id] = o_id

                if t_id and r_dict.get("payload_json"):
                    try:
                        p_dict = json.loads(r_dict["payload_json"]) if isinstance(r_dict["payload_json"], str) else r_dict["payload_json"]
                        u_e = p_dict.get("buyer_email") or p_dict.get("user_email")
                        if not u_e and isinstance(p_dict.get("arguments"), dict):
                            u_e = p_dict["arguments"].get("buyer_email") or p_dict["arguments"].get("user_email")
                        if u_e:
                            trace_email_map[t_id] = u_e
                    except Exception:
                        pass

            order_email_map = {}
            if order_ids_to_fetch:
                try:
                    placeholders = ", ".join(["?"] * len(order_ids_to_fetch)) if engine == "sqlite" else ", ".join(["%s"] * len(order_ids_to_fetch))
                    cursor.execute(f"SELECT id, buyer_email FROM orders WHERE id IN ({placeholders});", tuple(order_ids_to_fetch))
                    o_rows = cursor.fetchall()
                    for o in o_rows:
                        o_d = dict(o)
                        order_email_map[o_d["id"]] = o_d["buyer_email"]
                except Exception as e:
                    logger.warning(f"Could not batch fetch order buyer_emails: {e}")

            events = []
            for row in rows:
                row_dict = dict(row)
                raw_payload = row_dict.get("payload_json")
                parsed_payload = {}
                if raw_payload:
                    try:
                        parsed_payload = json.loads(raw_payload) if isinstance(raw_payload, str) else raw_payload
                    except Exception:
                        parsed_payload = {"raw": str(raw_payload)}

                pol_res = parsed_payload.get("policy_result") or row_dict.get("policy_result")

                final_order_id = row_dict.get("order_id") or trace_order_map.get(row_dict.get("trace_id"))
                user_email = (
                    parsed_payload.get("buyer_email") or
                    parsed_payload.get("user_email") or
                    parsed_payload.get("email")
                )
                if not user_email and isinstance(parsed_payload.get("arguments"), dict):
                    user_email = (
                        parsed_payload["arguments"].get("buyer_email") or
                        parsed_payload["arguments"].get("user_email")
                    )
                if not user_email and final_order_id:
                    user_email = order_email_map.get(final_order_id)
                if not user_email and row_dict.get("trace_id"):
                    user_email = trace_email_map.get(row_dict["trace_id"])

                events.append(
                    AuditEvent(
                        id=row_dict.get("id"),
                        trace_id=row_dict.get("trace_id", ""),
                        order_id=final_order_id,
                        user_email=user_email,
                        event_type=row_dict.get("event_type", ""),
                        actor=row_dict.get("actor", ""),
                        payload=parsed_payload,
                        policy_result=pol_res,
                        execution_time_ms=float(row_dict.get("execution_time_ms") or 0.0),
                        created_at=str(row_dict.get("created_at") or "")
                    )
                )

            return events
        finally:
            conn.close()

# Singleton service instance
audit_logger = AuditLogger()
