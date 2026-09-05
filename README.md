# Universal AI-Commerce Adapter for Razorpay Merchants

<img src="https://readme-typing-svg.demolab.com?font=JetBrains+Mono&size=22&duration=3000&pause=500&color=3B82F6&vCenter=true&width=900&lines=23%20Endpoints%20%E2%80%A2%208%20MCP%20Tools%20%E2%80%A2%20Real-time%20SSE%20Telemetry;AI%20Commerce%20Middleware%20for%20Razorpay%20Merchants;Zero-Trust%20Agent%20Shopping%20with%20Human-in-the-Loop%20Approval" />

### Model Context Protocol (MCP) Commerce Middleware

[![Python Version](https://img.shields.io/badge/python-3.10%2B-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110%2B-009688.svg)](https://fastapi.tiangolo.com/)
[![MCP Spec](https://img.shields.io/badge/MCP_Spec-2024--11--05-orange.svg)](https://modelcontextprotocol.io/)
[![Razorpay](https://img.shields.io/badge/Razorpay-Integration-0C2340.svg)](https://razorpay.com/)

---

## Executive Overview

The **AgentOS Universal AI-Commerce Adapter** is an **enterprise-grade backend for merchants** and **Model Context Protocol (MCP) Server** enabling AI Buyer Agents (such as Claude Desktop, Cursor, and custom LLM agents) to seamlessly discover merchant catalog items, receive intelligent cross-sell recommendations, validate deterministic spending policies, and safely execute transactions via **Razorpay**.

---

## System Roles and Operational Distinction

This system maintains a strict separation between **Merchant Backend Operations** and **Customer AI Agent Integrations**:

```
┌───────────────────────────────────────────────────────────────────────────────────┐
│                          1. MERCHANT / VENDOR ROLE                                │
│                     (FastAPI REST Backend + Dashboard)                            │
│                                                                                   │
│  • Used by: Merchants, Store Administrators, Inventory Managers, Finance          │
│  • Core Actions:                                                                  │
│    - Restock & adjust inventory stock levels (POST /api/catalog/inventory/update) │
│    - Monitor low-stock alerts & stock health (GET /api/catalog/inventory)         │
│    - Tune autonomous spending limits dynamically (PUT /api/dashboard/policy)      │
│    - Monitor revenue, transaction volume & throughput (GET /api/dashboard/stats)  │
│    - Audit transaction logs & SSE telemetry streams (GET /api/telemetry/stream)   │
│    - Receive automated Razorpay Webhooks (POST /api/webhooks/razorpay)            │
│    - Download itemized PDF receipts for fulfilled orders                          │
└───────────────────────────────────────────────────────────────────────────────────┘

                                      ▲
                                      │ Database & Shared Services
                                      ▼

┌───────────────────────────────────────────────────────────────────────────────────┐
│                      2. CUSTOMER / AI BUYER AGENT ROLE                            │
│                   (Model Context Protocol - MCP Server)                           │
│                                                                                   │
│  • Used by: Customers, AI Buyer Agents (Claude, Cursor, Gemini or any other LLM)  │
│  • Core Actions:                                                                  │
│    - Added into customer AI agents as an MCP tool standard                        │
│    - Search merchant catalog & query product specs (search_products)              │
│    - Evaluate smart growth upsells & bundle discounts (get_smart_upsell)          │
│    - Submit purchase orders validated against policy rules (create_order)         │
│    - Submit step-up auth for orders > spending limit (authorize_payment)          │
│    - Verify Razorpay signatures & commit payments (confirm_payment)               │
│    - Query real-time order state & tracking status (get_order_status)             │
└───────────────────────────────────────────────────────────────────────────────────┘
```

---

## System Architecture

```mermaid
flowchart TD
    subgraph Customer_Layer ["Customer & AI Buyer Layer"]
        CD["Claude Desktop / Cursor"]
        AGT["AgentOS / Custom LLM Agent"]
    end

    subgraph MCP_Transports ["MCP Transports (Customer Tools)"]
        STDIO["Stdio Transport (mcp_stdio_server.py)"]
        HTTP_MCP["HTTP REST MCP Router (/api/mcp)"]
    end

    subgraph Merchant_Backend ["Merchant Core Backend (FastAPI:8080)"]
        MCPServer["MCP Server Core (mcp_server.py)"]
        PolicyEngine["Policy Engine & Guardrails"]
        CatalogSvc["Catalog & Inventory Management"]
        RazorpaySvc["Razorpay Gateway Service"]
        AuditLogger["Audit & Telemetry Logger"]
        AdminDashboard["Merchant Admin API (/api/dashboard)"]
    end

    subgraph Merchant_Layer ["Merchant / Vendor Layer"]
        VendorUI["Merchant Admin React Dashboard"]
        StoreAdmin["Store Manager / Restock System"]
    end

    subgraph External_Storage ["Storage & Payment Gateway"]
        DB[(SQLite / PostgreSQL DB)]
        RZP["Razorpay Payment Gateway API"]
    end

    CD -->|JSON-RPC via Stdio| STDIO
    AGT -->|REST API Calls| HTTP_MCP
    STDIO --> MCPServer
    HTTP_MCP --> MCPServer

    VendorUI --> AdminDashboard
    StoreAdmin --> CatalogSvc

    MCPServer --> PolicyEngine
    MCPServer --> CatalogSvc
    MCPServer --> RazorpaySvc

    AdminDashboard --> PolicyEngine
    AdminDashboard --> DB
    CatalogSvc --> DB
    PolicyEngine --> AuditLogger
    PolicyEngine --> DB
    RazorpaySvc --> RZP
```

---

## Project Directory Structure

```
Razorpay Buildathon/
├── backend/
│   ├── agent/                 # Autonomous AI Buyer Agent implementations
│   │   ├── ai_buyer_agent.py  # Structured shopping goal workflow agent
│   │   └── llm_buyer_agent.py # Conversational LLM agent pipeline
│   ├── data/                  # SQLite database storage (adapter.db)
│   ├── db/                    # SQLAlchemy database engine and schema definitions
│   │   └── database.py
│   ├── models/                # Pydantic & ORM models (catalog, policy, telemetry)
│   ├── routes/                # FastAPI API Endpoint Routers
│   │   ├── catalog.py         # Catalog search, SKU lookups, stock update & upsells
│   │   ├── dashboard.py       # Merchant statistics & guardrail settings
│   │   ├── mcp_router.py      # MCP HTTP endpoints & agent execution
│   │   ├── payment.py         # Razorpay checkout, verification & receipts
│   │   ├── policy.py          # Pre-flight policy checks & order drafts
│   │   └── telemetry.py       # Audit logs & SSE telemetry streaming
│   ├── services/              # Core business services
│   │   ├── audit_logger.py    # Persistent audit trail recorder
│   │   ├── catalog_service.py # Catalog querying, restocking & auto-seeding
│   │   ├── policy_engine.py   # State machine & guardrail validator
│   │   ├── razorpay_service.py# Razorpay order creation & signature verification
│   │   ├── receipt_service.py # PDF receipt generator
│   │   └── telemetry_service.py # Audit telemetry service
│   ├── tests/                 # Pytest unit and integration test suite
│   │   └── test_policy.py
│   ├── config.py              # Central application settings (Pydantic BaseSettings)
│   ├── main.py                # FastAPI Application Entrypoint (Port 8080)
│   ├── mcp_server.py          # Core MCP Tools manifest & dispatcher implementation
│   └── mcp_stdio_server.py    # MCP Stdio JSON-RPC 2.0 Server entrypoint
├── frontend/                  # React + Vite + Tailwind CSS Admin & Sandbox UI
├── .env                       # Environment configuration file
├── pytest.ini                 # Pytest configuration
├── requirements.txt           # Python backend dependencies
└── postman_collection.json    # Postman API testing suite
```

---

## Environment Configuration

Create or update `.env` in the project root:

```ini
# ==========================================
# Razorpay API Credentials
# ==========================================
RAZORPAY_KEY_ID=rzp_test_your_key_id
RAZORPAY_KEY_SECRET=your_razorpay_secret_key
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret

# Set to true to bypass live Razorpay API calls during local testing
ENABLE_RAZORPAY_MOCK=true

# ==========================================
# Merchant Guardrail Configuration
# ==========================================
# Maximum amount (in INR) an AI agent can spend autonomously before requiring HITL approval
MAX_AUTONOMOUS_TXN_LIMIT=5000.00
CURRENCY=INR
MERCHANT_NAME=Apex Fashion & Lifestyle Store

# ==========================================
# Server Settings
# ==========================================
HOST=127.0.0.1
PORT=8080
ENVIRONMENT=development
LOG_LEVEL=info

# ==========================================
# Database Configuration
# ==========================================
# Switch between 'sqlite' (zero-config local DB) and 'postgresql'
DB_ENGINE=sqlite
DB_PATH=backend/data/adapter.db

# PostgreSQL Settings (Used only if DB_ENGINE=postgresql)
POSTGRES_URL=postgresql://user:password@localhost:5432/razorpay_adapter
```

---

## Endpoint and MCP Reference Tables

### Table 1: Merchant / Vendor Backend API Endpoints (`/api/*`)

> **Target User**: Store Managers, Vendors, Admin Dashboard, and Accounting Systems.

| Module | Method | Endpoint Path | Description & Purpose | Target Audience |
| :--- | :---: | :--- | :--- | :--- |
| **Inventory Control** | `POST` | `/api/catalog/inventory/update` | **Restock or adjust available stock** for a specific product SKU. | Merchant / Vendor |
| **Inventory Control** | `GET` | `/api/catalog/inventory` | View real-time merchant inventory levels, stock status, and low-stock alerts. | Merchant / Vendor |
| **Inventory Control** | `POST` | `/api/catalog/seed` | Reset / re-seed merchant product catalog with default inventory. | Merchant / Vendor |
| **Merchant Dashboard**| `GET` | `/api/dashboard/stats` | Retrieve revenue metrics, autonomous vs gated order counts, throughput & DB status. | Merchant / Vendor |
| **Merchant Policy**   | `PUT` | `/api/dashboard/policy` | **Dynamically update autonomous limit threshold** (`max_autonomous_txn_limit`). | Merchant / Vendor |
| **Order Management**  | `GET` | `/api/orders` | List all internal customer/agent orders from database with status filters. | Merchant / Vendor |
| **Order Management**  | `GET` | `/api/orders/{order_id}` | Retrieve complete order details, item breakdown, and payment states. | Merchant / Vendor |
| **Order Management**  | `GET` | `/api/orders/{order_id}/receipt` | Generate and download itemized PDF purchase receipt for fulfilled orders. | Merchant / Customer |
| **Payment Gateway**   | `POST` | `/api/payments/create-order` | Convert INR order total to Paise and create official Razorpay Order ID. | Internal / Payment System |
| **Payment Gateway**   | `POST` | `/api/payments/create-link` | Generate hosted Razorpay Payment Link for Human Step-Up Auth (`REQUIRES_HUMAN_AUTH`). | Merchant / Customer |
| **Payment Gateway**   | `POST` | `/api/payments/verify` | Verify Razorpay HMAC-SHA256 payment signature and capture funds. | Payment System |
| **Payment Webhooks**  | `POST` | `/api/webhooks/razorpay` | Asynchronous Razorpay webhook handler for `payment.captured` & `payment.failed`. | Razorpay Server |
| **Audit Telemetry**   | `GET` | `/api/telemetry/stream` | **Server-Sent Events (SSE)** real-time live telemetry stream for dashboard monitors. | Merchant / Vendor |
| **Audit Telemetry**   | `GET` | `/api/telemetry/logs` | Fetch historical immutable audit logs with filtering by `order_id`, `trace_id`, `event_type`. | Merchant / Vendor |
| **Audit Telemetry**   | `GET` | `/api/telemetry/logs/{order_id}` | Fetch audit trail history specifically for a target Order ID. | Merchant / Vendor |
| **Catalog Search**    | `GET` | `/api/catalog/search` | Search product catalog by keyword, category, price range, and stock availability. | Public / Merchant |
| **Catalog Search**    | `GET` | `/api/catalog/products/{sku}` | Fetch product specifications, unit price, and current available stock. | Public / Merchant |
| **Catalog Search**    | `GET` | `/api/catalog/categories` | List distinct merchant product categories. | Public / Merchant |
| **Catalog Search**    | `GET` | `/api/catalog/stats` | Aggregated catalog statistics (total SKUs, active categories, total inventory value). | Public / Merchant |
| **Catalog Search**    | `GET` | `/api/catalog/upsell` | Query AI-recommended complementary products for a given SKU. | Public / Merchant |
| **System**            | `GET` | `/health` | Server health check endpoint. | Operations |
| **System**            | `GET` | `/api/config` | Returns merchant configuration, currency, and active spending limit. | Operations |

---

### Table 2: Customer & AI Buyer Agent MCP Tools (`mcp_stdio_server` & `/api/mcp/*`)

> **Target User**: Customer AI Agents (Claude Desktop, Cursor, AgentOS, Autonomous Shopping Bots).
> **Integration**: Added by buyers into their AI Agent configuration to enable autonomous merchant commerce.

| Tool Name | Tool Purpose & Description | Input Arguments | Output Return Value |
| :--- | :--- | :--- | :--- |
| `search_products` | Search catalog by natural language keyword, category filter, or budget cap. | `query` (string), `category` (string), `max_price` (number), `limit` (integer) | Matching products array & recommendation metadata. |
| `get_product_details` | Retrieve comprehensive specs, available stock count, and cross-sell options. | `sku` (string, required) | Full product object, inventory level, and upsell list. |
| `get_smart_upsell` | Generate smart cross-sell recommendations & bundle discounts based on primary SKU. | `sku` (string, required), `cart_skus` (array of strings) | Complementary upsell recommendations & bundle savings. |
| `create_order` | Validate price integrity, check stock availability, enforce spending limits, reserve stock, and generate order draft + Razorpay Order ID. | `items` (list of SKU & quantity, required), `buyer_email` (string, required) | Internal Order ID, Razorpay Order ID, total amount, and state (`AUTHORIZED_FOR_PAYMENT` or `DRAFT_AWAITING_AUTH`). |
| `authorize_payment` | Submit HMAC authorization token / OTP for high-value orders awaiting HITL approval. | `order_id` (string, required), `auth_token` (string, required) | Authorization verification result and updated state. |
| `verify_stepup_auth` | Verify Human-in-the-Loop approval token for gated orders exceeding autonomous spending limit. | `order_id` (string, required), `auth_token` (string, required), `buyer_email` (string) | Step-up validation response and state transition. |
| `confirm_payment` | Verify Razorpay payment signature, capture transaction funds, and permanently commit stock deduction. | `order_id` (string, required), `razorpay_order_id` (string), `razorpay_payment_id` (string), `razorpay_signature` (string) | Transaction capture confirmation, stock commit status, and `RAZORPAY_CAPTURED` order state. |
| `get_order_status` | Query real-time state machine status, Razorpay reference IDs, and complete audit trail. | `order_id` (string, required) | Current order status, payment reference IDs, and audit event logs. |

---

## Setup and Execution Guide

### 1. Backend Setup and Execution (Merchant Engine)

#### Step A: Create and Activate Virtual Environment
```bash
# Windows (PowerShell)
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# Linux / macOS
python3 -m venv .venv
source .venv/bin/activate
```

#### Step B: Install Dependencies
```bash
pip install -r requirements.txt
```

#### Step C: Start the FastAPI Backend Server
```bash
python -m backend.main
```
*Server runs at `http://127.0.0.1:8080`*

#### Step D: Verify Operations
- **Health Check**: [http://127.0.0.1:8080/health](http://127.0.0.1:8080/health)
- **Interactive OpenAPI (Swagger) Docs**: [http://127.0.0.1:8080/docs](http://127.0.0.1:8080/docs)

---

### 2. Model Context Protocol (MCP) Server Setup (Customer Agent)

#### Option A: Stdio Mode (For Claude Desktop / Cursor / AgentOS)

The Stdio server reads standard input (`stdin`) and writes standard JSON-RPC 2.0 protocol output to `stdout`.

##### Direct CLI Execution:
```bash
python -m backend.mcp_stdio_server
```

##### Claude Desktop Configuration (`claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "razorpay-commerce-adapter": {
      "command": "<path-to-project>/.venv/Scripts/python.exe",
      "args": [
        "-m",
        "backend.mcp_stdio_server"
      ],
      "cwd": "<path-to-project>"
    }
  }
}
```

##### Cursor / AgentOS Configuration:
```json
{
  "name": "razorpay-commerce-adapter",
  "command": "python",
  "args": ["-m", "backend.mcp_stdio_server"],
  "env": {
    "PYTHONUNBUFFERED": "1"
  }
}
```

---

#### Option B: HTTP REST Transport Mode

When the FastAPI backend is running, MCP tools can be invoked via REST endpoints:

- **List Tool Schemas**: `GET /api/mcp/tools`
- **Execute Tool Call**: `POST /api/mcp/call`
  ```json
  {
    "name": "search_products",
    "arguments": {
      "query": "headphones",
      "max_price": 5000
    }
  }
  ```
- **Execute End-to-End Agent Shopping Goal**: `POST /api/mcp/agent/run`
  ```json
  {
    "buyer_email": "buyer@example.com",
    "search_query": "Wireless Headphones under 5000",
    "max_price": 5000.0,
    "include_upsell": true
  }
  ```

---

### 3. Frontend Setup (Optional Merchant Admin UI)

```bash
cd frontend
npm install
npm run dev
```
*Open [http://localhost:5173](http://localhost:5173) in browser.*

---

## Testing and Verification

```bash
# Run pytest unit & integration test suite
.\.venv\Scripts\pytest.exe
```

The automated test suite verifies:
- Audit trail event logging & persistent filtering.
- Policy Engine guardrail execution (`MaxTxnLimit`, `PriceIntegrity`).
- Order state machine transitions (`DRAFT_AWAITING_AUTH` -> `AUTHORIZED_FOR_PAYMENT` -> `RAZORPAY_CAPTURED`).
- Telemetry API endpoints.

---

## Security and Policy Engine Guardrails

```
[Order Draft Request] 
       │
       ▼
 [Price Integrity Check] ──(Mismatch)──► REJECTED (Tamper Detected)
       │ (Pass)
       ▼
 [Inventory Stock Lock]  ──(Out of Stock)► REJECTED (Insufficient Stock)
       │ (Pass)
       ▼
 [Velocity Rate Limit]  ──(Exceeded)──► REJECTED (Rate Limit Exceeded)
       │ (Pass)
       ▼
 [Max Autonomous Limit] ──(> ₹5,000)──► DRAFT_AWAITING_AUTH (HITL Step-Up Triggered)
       │ (<= ₹5,000)
       ▼
 AUTHORIZED_FOR_PAYMENT ──► Razorpay Order Creation
```

---

## License and Attribution

Built by [Sanju](https://sanju26.in) for the **Razorpay Buildathon** | Powered by **FastAPI**, **Model Context Protocol (MCP)**, and **Razorpay**.
