# Vendor Dashboard Backend API Specification

This document details **only the backend API endpoints** hit directly by the **Vendor / Merchant Dashboard**, along with their exact request schemas and response bodies.

---

## Vendor Dashboard Endpoints Summary

| Endpoint | Method | Purpose |
| :--- | :--- | :--- |
| `GET /api/dashboard/stats` | `GET` | Fetches financial KPIs, revenue, autonomous vs. gated ratios, DB engine, and active policy cap |
| `PUT /api/dashboard/policy` | `PUT` | Dynamically updates the vendor's autonomous spending cap threshold |
| `GET /api/telemetry/stream` | `GET (SSE)` | Real-time Server-Sent Events stream pushing live AI agent audit traces |
| `GET /api/telemetry/logs` | `GET` | Retrieves historical audit trail logs on initial dashboard terminal load |
| `GET /api/orders/{order_id}` | `GET` | Fetches complete order details, state machine history, and Razorpay references |

---

## Detailed Request & Response Schemas

### 1. Vendor Financial & Security Metrics
#### `GET /api/dashboard/stats`

* **HTTP Method**: `GET`
* **URL**: `http://localhost:8000/api/dashboard/stats`
* **Request Headers**: `Accept: application/json`
* **Request Parameters / Body**: None

* **Response Body (`200 OK`)**:
```json
{
  "success": true,
  "total_revenue": 4832150.0,
  "currency": "INR",
  "db_engine": "POSTGRESQL",
  "total_orders": 50,
  "captured_orders": 42,
  "gated_orders": 8,
  "blocked_orders": 0,
  "autonomous_percentage": 84.0,
  "telemetry_events_count": 128,
  "active_policy": {
    "max_autonomous_txn_limit": 5000.0
  }
}
```

---

### 2. Dynamic Spending Cap Policy Update
#### `PUT /api/dashboard/policy`

* **HTTP Method**: `PUT`
* **URL**: `http://localhost:8000/api/dashboard/policy`
* **Request Headers**: `Content-Type: application/json`

* **Request Body**:
```json
{
  "max_autonomous_txn_limit": 10000.0
}
```

* **Response Body (`200 OK`)**:
```json
{
  "success": true,
  "message": "Autonomous limit updated to ₹10,000.00",
  "max_autonomous_txn_limit": 10000.0
}
```

---

### 3. Real-Time Telemetry Audit Log Stream (SSE)
#### `GET /api/telemetry/stream`

* **HTTP Method**: `GET`
* **URL**: `http://localhost:8000/api/telemetry/stream`
* **Request Headers**: `Accept: text/event-stream`
* **Request Parameters / Body**: None

* **Response Stream Event Format (`200 OK`)**:
```http
data: {
  "id": 42,
  "trace_id": "8a912b3c-4d5e-6f7a-8b9c",
  "tool_name": "create_order",
  "actor": "AI_BUYER_AGENT",
  "policy_result": "PASSED",
  "state_after": "AUTHORIZED_FOR_PAYMENT",
  "execution_time_ms": 1.4,
  "input_payload": {
    "buyer_email": "buyer@example.com",
    "items": [
      {
        "sku": "SKU_AUDIO_01",
        "quantity": 1,
        "unit_price": 4999.0
      }
    ]
  },
  "order_id": "ORD-20260826-A1B2C3",
  "razorpay_order_id": "rzp_test_991827364",
  "error_message": null,
  "timestamp": "2026-08-26T22:30:00Z"
}
```

---

### 4. Historical Audit Trail Logs (Terminal Initial Load)
#### `GET /api/telemetry/logs`

* **HTTP Method**: `GET`
* **URL**: `http://localhost:8000/api/telemetry/logs?limit=50`
* **Query Parameters**: `limit=50` (integer, default 100)

* **Response Body (`200 OK`)**:
```json
{
  "total": 50,
  "events": [
    {
      "id": 42,
      "trace_id": "8a912b3c-4d5e-6f7a-8b9c",
      "order_id": "ORD-20260826-A1B2C3",
      "event_type": "create_order",
      "actor": "AI_BUYER_AGENT",
      "payload_json": {
        "policy_result": "PASSED",
        "state_after": "AUTHORIZED_FOR_PAYMENT"
      },
      "execution_time_ms": 1.4,
      "created_at": "2026-08-26T22:30:00Z"
    }
  ]
}
```

---

### 5. Vendor Order Details & Financial State Machine
#### `GET /api/orders/{order_id}`

* **HTTP Method**: `GET`
* **URL**: `http://localhost:8000/api/orders/ORD-20260826-A1B2C3`
* **Request Headers**: `Accept: application/json`

* **Response Body (`200 OK`)**:
```json
{
  "id": "ORD-20260826-A1B2C3",
  "buyer_email": "buyer@example.com",
  "total_amount": 4999.0,
  "currency": "INR",
  "status": "RAZORPAY_CAPTURED",
  "razorpay_order_id": "rzp_test_991827364",
  "razorpay_payment_id": "pay_991827364",
  "auth_token": null,
  "items": [
    {
      "sku": "SKU_AUDIO_01",
      "name": "Wireless Noise-Canceling Headphones",
      "quantity": 1,
      "unit_price": 4999.0
    }
  ],
  "created_at": "2026-08-26T22:30:00Z",
  "updated_at": "2026-08-26T22:30:05Z"
}
```
