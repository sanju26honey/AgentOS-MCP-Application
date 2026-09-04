import sys
import types
from pathlib import Path

# Enable compatibility for standalone backend repository deployments
CURRENT_DIR = Path(__file__).resolve().parent
if "backend" not in sys.modules:
    backend_pkg = types.ModuleType("backend")
    backend_pkg.__path__ = [str(CURRENT_DIR)]
    sys.modules["backend"] = backend_pkg

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.config import settings
from backend.services.catalog_service import CatalogService
from backend.routes.catalog import router as catalog_router
from backend.routes.policy import router as policy_router
from backend.routes.payment import router as payment_router
from backend.routes.telemetry import router as telemetry_router
from backend.routes.mcp_router import router as mcp_router
from backend.routes.dashboard import router as dashboard_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Ensure database tables are initialized and seeded
    catalog_service = CatalogService()
    catalog_service.seed_catalog_if_empty()
    yield

app = FastAPI(
    title="Universal AI-Commerce Adapter for Razorpay Merchants",
    description="Middleware enabling AI buyers to interact with merchant catalogs, evaluate spending policies, and process Razorpay transactions securely.",
    version="1.0.0",
    lifespan=lifespan
)

# Include Catalog, Inventory, Policy/Order, Razorpay Payment, Telemetry & Dashboard Endpoints
app.include_router(catalog_router)
app.include_router(policy_router)
app.include_router(payment_router)
app.include_router(telemetry_router)
app.include_router(mcp_router)
app.include_router(dashboard_router)


# Enable CORS for Merchant Admin UI and Customer Agent Frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health", tags=["System"])
async def health_check():
    """Health check endpoint to verify adapter status."""
    return {
        "status": "healthy",
        "service": "Universal AI-Commerce Adapter",
        "version": app.version,
        "environment": settings.ENVIRONMENT
    }

@app.get("/api/config", tags=["System"])
async def get_config():
    """Returns public adapter configuration and merchant guardrail thresholds."""
    return {
        "merchant_name": settings.MERCHANT_NAME,
        "currency": settings.CURRENCY,
        "max_autonomous_txn_limit": settings.MAX_AUTONOMOUS_TXN_LIMIT,
        "razorpay_configured": bool(
            settings.RAZORPAY_KEY_ID and 
            settings.RAZORPAY_KEY_ID != "rzp_test_placeholder_key"
        )
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "backend.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=True
    )
