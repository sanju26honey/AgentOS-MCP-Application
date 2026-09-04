import json
import asyncio
import logging
from typing import Optional, List
from fastapi import APIRouter, Request, Query, HTTPException, status
from fastapi.responses import StreamingResponse
from backend.services.audit_logger import audit_logger
from backend.models.telemetry import AuditEvent, AuditTrailResponse

logger = logging.getLogger("telemetry_router")

router = APIRouter(prefix="/api/telemetry", tags=["Telemetry"])


@router.get(
    "/stream",
    summary="Real-Time Telemetry SSE Stream",
    description="Server-Sent Events (SSE) endpoint pushing live audit event traces to connected merchant dashboards."
)
async def stream_telemetry(request: Request):
    """Subscribes client to live Server-Sent Event stream of audit logs."""

    async def event_generator():
        queue = audit_logger.subscribe()
        try:
            # Yield initial connection confirmation message
            conn_payload = json.dumps({"event_type": "SSE_CONNECTED", "actor": "SYSTEM", "message": "Telemetry stream initialized"})
            yield f"data: {conn_payload}\n\n"

            while True:
                if await request.is_disconnected():
                    logger.info("Client disconnected from SSE telemetry stream.")
                    break
                try:
                    event: AuditEvent = await asyncio.wait_for(queue.get(), timeout=15.0)
                    yield f"data: {event.model_dump_json()}\n\n"
                except asyncio.TimeoutError:
                    # Periodic heartbeat ping to keep connection alive
                    yield ": heartbeat\n\n"
        except asyncio.CancelledError:
            logger.info("SSE telemetry stream task cancelled.")
        finally:
            audit_logger.unsubscribe(queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )


@router.get(
    "/logs",
    response_model=AuditTrailResponse,
    summary="Get Audit Log Trail",
    description="Retrieves historical immutable audit event records from SQLite/PostgreSQL WAL database."
)
async def get_logs(
    order_id: Optional[str] = Query(None, description="Filter logs by merchant Order ID"),
    trace_id: Optional[str] = Query(None, description="Filter logs by UUID Trace ID"),
    event_type: Optional[str] = Query(None, description="Filter logs by event category"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of log entries to retrieve")
):
    """Queries audit log records matching filter parameters."""
    events = audit_logger.get_audit_trail(
        order_id=order_id,
        trace_id=trace_id,
        event_type=event_type,
        limit=limit
    )
    return AuditTrailResponse(total=len(events), events=events)


@router.get(
    "/logs/{order_id}",
    response_model=AuditTrailResponse,
    summary="Get Audit Log Trail for Order",
    description="Retrieves all immutable audit event records for a specific order."
)
async def get_logs_by_order(order_id: str):
    """Retrieves audit trail associated with an explicit order ID."""
    events = audit_logger.get_audit_trail(order_id=order_id, limit=500)
    if not events:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No audit telemetry events found for order ID '{order_id}'."
        )
    return AuditTrailResponse(total=len(events), events=events)
