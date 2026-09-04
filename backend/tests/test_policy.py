import os
import tempfile
import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.services.audit_logger import audit_logger, AuditLogger
from backend.services.policy_engine import PolicyEngineService
from backend.services.catalog_service import CatalogService
from backend.models.policy import OrderCreateRequest, PolicyCheckItem, OrderState


@pytest.fixture
def test_db():
    temp_dir = tempfile.mkdtemp()
    db_path = os.path.join(temp_dir, "test_audit.db")
    
    # Configure global singleton and services to use isolated test_db
    audit_logger.db_path = db_path
    cat_service = CatalogService(db_path=db_path)
    cat_service.seed_catalog_if_empty()
    
    yield db_path
    
    audit_logger.db_path = None
    try:
        if os.path.exists(db_path):
            os.remove(db_path)
        os.rmdir(temp_dir)
    except Exception:
        pass


def test_log_event_persistence(test_db):
    logger_service = AuditLogger(db_path=test_db)
    
    event = logger_service.log_event(
        event_type="TEST_EVENT",
        actor="AI_BUYER",
        payload={"action": "test_search", "query": "jacket"},
        policy_result="PASSED",
        order_id="ORD-TEST-001"
    )

    assert event.id is not None
    assert event.event_type == "TEST_EVENT"
    assert event.actor == "AI_BUYER"
    assert event.order_id == "ORD-TEST-001"
    assert event.payload["query"] == "jacket"
    assert event.policy_result == "PASSED"

    # Fetch trail
    trail = logger_service.get_audit_trail(order_id="ORD-TEST-001")
    assert len(trail) >= 1
    assert trail[0].event_type == "TEST_EVENT"


import uuid

def test_audit_trail_filtering(test_db):
    logger_service = AuditLogger(db_path=test_db)

    ord_a = f"ORD-FLT-A-{uuid.uuid4().hex[:6]}"
    ord_b = f"ORD-FLT-B-{uuid.uuid4().hex[:6]}"
    evt_b = f"TYPE_B_{uuid.uuid4().hex[:6]}"

    logger_service.log_event(event_type="TYPE_A", actor="SYSTEM", order_id=ord_a)
    logger_service.log_event(event_type=evt_b, actor="SYSTEM", order_id=ord_b)
    logger_service.log_event(event_type="TYPE_A", actor="SYSTEM", order_id=ord_a)

    events_ord_a = logger_service.get_audit_trail(order_id=ord_a)
    assert len(events_ord_a) == 2

    events_type_b = logger_service.get_audit_trail(event_type=evt_b)
    assert len(events_type_b) == 1
    assert events_type_b[0].order_id == ord_b


def test_policy_engine_audit_integration(test_db):
    policy_service = PolicyEngineService(db_path=test_db)
    logger_service = AuditLogger(db_path=test_db)

    request = OrderCreateRequest(
        buyer_email="buyer_audit@example.com",
        items=[PolicyCheckItem(sku="APEX-GDG-001", quantity=1, claimed_unit_price=3499.0)],
        total_amount=3499.0,
        currency="INR"
    )

    order_record, policy_res = policy_service.create_order(request)
    assert order_record is not None
    assert order_record.status == OrderState.DRAFT_AWAITING_AUTH

    # Check that policy check and order creation were logged
    logs = logger_service.get_audit_trail(order_id=order_record.id)
    assert len(logs) >= 1
    
    event_types = [l.event_type for l in logs]
    assert "ORDER_CREATED" in event_types


def test_telemetry_api_endpoints():
    client = TestClient(app)

    res = client.get("/api/telemetry/logs?limit=10")
    assert res.status_code == 200
    data = res.json()
    assert "total" in data
    assert "events" in data
