from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, ConfigDict

class AuditEvent(BaseModel):
    id: Optional[int] = Field(None, description="Unique autoincrement audit record ID")
    trace_id: str = Field(..., description="UUID trace correlation identifier")
    order_id: Optional[str] = Field(None, description="Associated merchant order ID if applicable")
    user_email: Optional[str] = Field(None, description="Associated user/buyer email if available")
    event_type: str = Field(..., description="Category of telemetry event (e.g. POLICY_CHECK, INVENTORY_RESERVED)")
    actor: str = Field(..., description="Originating actor: AI_BUYER, MERCHANT_ADMIN, SYSTEM, POLICY_ENGINE")
    payload: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Structured event metadata and request/response payloads")
    policy_result: Optional[str] = Field(None, description="Guardrail outcome: PASSED, BLOCKED, N/A")
    execution_time_ms: Optional[float] = Field(0.0, description="Latency in milliseconds")
    created_at: Optional[str] = Field(None, description="ISO timestamp of event creation")

    model_config = ConfigDict(from_attributes=True)

class AuditEventCreate(BaseModel):
    trace_id: Optional[str] = Field(None, description="UUID trace ID (auto-generated if omitted)")
    order_id: Optional[str] = Field(None, description="Order ID if applicable")
    user_email: Optional[str] = Field(None, description="User/buyer email address")
    event_type: str = Field(..., description="Telemetry event type identifier")
    actor: str = Field(default="SYSTEM", description="Actor triggering the event")
    payload: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Event payload dictionary")
    policy_result: Optional[str] = Field(None, description="Policy check result: PASSED, BLOCKED, N/A")
    execution_time_ms: Optional[float] = Field(0.0, description="Processing duration in ms")

class AuditTrailResponse(BaseModel):
    total: int = Field(..., description="Total count of audit log entries returned")
    events: List[AuditEvent] = Field(..., description="List of audit event records")
