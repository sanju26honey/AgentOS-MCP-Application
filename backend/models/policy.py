from enum import Enum
from datetime import datetime
from typing import List, Optional, Dict, Any, Union
from pydantic import BaseModel, Field, ConfigDict

class OrderState(str, Enum):
    INITIALIZED = "INITIALIZED"
    POLICY_CHECK = "POLICY_CHECK"
    DRAFT_AWAITING_AUTH = "DRAFT_AWAITING_AUTH"
    AUTHORIZED_FOR_PAYMENT = "AUTHORIZED_FOR_PAYMENT"
    RAZORPAY_CAPTURED = "RAZORPAY_CAPTURED"
    BLOCKED_BY_POLICY = "BLOCKED_BY_POLICY"
    EXPIRED = "EXPIRED"
    CANCELLED = "CANCELLED"

class GuardrailStatus(str, Enum):
    PASSED = "PASSED"
    FAILED = "FAILED"
    WARNING = "WARNING"

class PolicyCheckItem(BaseModel):
    sku: str = Field(..., description="Unique Stock Keeping Unit code")
    quantity: int = Field(..., gt=0, description="Quantity to purchase")
    claimed_unit_price: float = Field(..., ge=0, description="Claimed unit price in INR submitted by AI buyer")
    name: Optional[str] = Field(None, description="Product name")

class PolicyEvaluationRequest(BaseModel):
    buyer_email: str = Field(..., description="Email identifier of the buyer")
    items: List[PolicyCheckItem] = Field(..., min_length=1, description="List of items in purchase request")
    total_amount: float = Field(..., ge=0, description="Claimed total purchase amount in INR")
    currency: str = Field(default="INR", description="3-letter currency code")

class GuardrailResult(BaseModel):
    guardrail_name: str = Field(..., description="Identifier of the policy rule")
    status: GuardrailStatus = Field(..., description="Evaluation outcome: PASSED, FAILED, WARNING")
    passed: bool = Field(..., description="True if guardrail criteria are met")
    reason: str = Field(..., description="Detailed explanation of evaluation result")

class PolicyEvaluationResponse(BaseModel):
    approved: bool = Field(..., description="True if order passes all critical merchant guardrails")
    status: str = Field(..., description="Overall decision status: APPROVED_AUTONOMOUS, REQUIRES_HUMAN_AUTH, BLOCKED_BY_POLICY")
    allowed_amount: float = Field(..., description="Maximum allowed autonomous transaction limit")
    calculated_total: float = Field(..., description="Authoritative catalog calculated total")
    guardrail_results: List[GuardrailResult] = Field(default_factory=list, description="Per-guardrail evaluation breakdown")
    violations: List[str] = Field(default_factory=list, description="List of failed guardrail rule explanations")

class OrderCreateRequest(BaseModel):
    buyer_email: str = Field(..., description="Email identifier of the buyer")
    items: List[PolicyCheckItem] = Field(..., min_length=1, description="Items to purchase")
    total_amount: float = Field(..., ge=0, description="Total order amount")
    currency: str = Field(default="INR", description="3-letter currency code")

class OrderRecord(BaseModel):
    id: str = Field(..., description="Unique internal order ID")
    buyer_email: str = Field(..., description="Buyer email")
    total_amount: float = Field(..., description="Authoritative total amount")
    currency: str = Field(default="INR")
    status: OrderState = Field(..., description="Current state in financial transition state machine")
    razorpay_order_id: Optional[str] = Field(None, description="Razorpay Order ID once created")
    razorpay_payment_id: Optional[str] = Field(None, description="Razorpay Payment ID once captured")
    auth_token: Optional[str] = Field(None, description="HMAC authorization token")
    items_json: List[Dict[str, Any]] = Field(default_factory=list, description="Purchased items with authoritative prices")
    created_at: Optional[Union[str, datetime]] = None
    updated_at: Optional[Union[str, datetime]] = None

    model_config = ConfigDict(from_attributes=True)

class StateTransitionRequest(BaseModel):
    target_state: OrderState = Field(..., description="Target state to transition to")
    razorpay_order_id: Optional[str] = Field(None, description="Razorpay Order ID if transitioning to draft/authorized")
    razorpay_payment_id: Optional[str] = Field(None, description="Razorpay Payment ID if captured")
    auth_token: Optional[str] = Field(None, description="HMAC authorization token")
    reason: Optional[str] = Field(None, description="Optional note or reason for state transition")

class StateTransitionResponse(BaseModel):
    success: bool = Field(..., description="True if state transition succeeded")
    order_id: str = Field(..., description="Order identifier")
    previous_state: OrderState = Field(..., description="State before transition")
    current_state: OrderState = Field(..., description="State after transition")
    message: str = Field(..., description="Status summary message")
