from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query, status
from backend.services.catalog_service import CatalogService
from backend.models.catalog import (
    Product,
    ProductSearchResponse,
    StockReservationRequest,
    StockReservationResult,
    StockReleaseRequest,
    StockCommitRequest,
    StockCommitResult,
    InventoryUpdateRequest,
    InventoryStatusResponse,
    CategoryListResponse,
    CatalogStatsResponse
)

router = APIRouter(prefix="/api/catalog", tags=["Catalog & Inventory"])
catalog_service = CatalogService()

@router.get("/categories", response_model=CategoryListResponse)
async def get_categories():
    """Retrieves all distinct product categories available in the merchant catalog."""
    return catalog_service.get_categories()

@router.get("/stats", response_model=CatalogStatsResponse)
async def get_catalog_stats():
    """Retrieves aggregated statistics and stock metrics for the storefront catalog."""
    return catalog_service.get_catalog_stats()

@router.get("/search", response_model=ProductSearchResponse)
async def search_products(
    query: Optional[str] = Query(None, description="Search query across name, description, tags, or SKU"),
    category: Optional[str] = Query(None, description="Filter by product category"),
    min_price: Optional[float] = Query(None, ge=0, description="Minimum price filter"),
    max_price: Optional[float] = Query(None, ge=0, description="Maximum price filter"),
    in_stock_only: Optional[bool] = Query(False, description="Filter to show only in-stock items"),
    sort_by: Optional[str] = Query(None, description="Sort order: price-low, price-high, name-asc, stock-high"),
    limit: int = Query(50, ge=1, le=100, description="Maximum number of results to return")
):
    """Searches merchant product catalog with filters for keyword, category, price range, stock status, and sorting."""
    return catalog_service.search_products(
        query=query,
        category=category,
        min_price=min_price,
        max_price=max_price,
        in_stock_only=in_stock_only,
        sort_by=sort_by,
        limit=limit
    )

@router.get("/products/{sku}", response_model=Product)
async def get_product_by_sku(sku: str):
    """Retrieves detailed product metadata and real-time available stock for a given SKU."""
    product = catalog_service.get_product_by_sku(sku)
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with SKU '{sku}' not found in merchant catalog."
        )
    return product

@router.get("/upsell", response_model=List[Product])
async def get_smart_upsell(
    sku: str = Query(..., description="Target product SKU to base recommendations on"),
    cart_skus: Optional[str] = Query(None, description="Comma-separated list of SKUs currently in buyer's cart"),
    limit: int = Query(3, ge=1, le=5, description="Maximum recommendations")
):
    """Returns AI-recommended complementary products for cross-selling and upsells."""
    parsed_cart = [s.strip() for s in cart_skus.split(",")] if cart_skus else []
    return catalog_service.get_smart_upsell(sku=sku, cart_skus=parsed_cart, limit=limit)

@router.post("/reserve", response_model=StockReservationResult)
async def reserve_stock(req: StockReservationRequest):
    """Atomically reserves stock for a pending AI order draft."""
    result = catalog_service.reserve_stock(sku=req.sku, quantity=req.quantity)
    if not result.success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.message
        )
    return result

@router.post("/release", response_model=StockReservationResult)
async def release_stock(req: StockReleaseRequest):
    """Reverts reserved stock back to available stock upon order cancellation or timeout."""
    result = catalog_service.release_stock(sku=req.sku, quantity=req.quantity)
    if not result.success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.message
        )
    return result

@router.post("/commit", response_model=StockCommitResult)
async def commit_stock(req: StockCommitRequest):
    """Permanently deducts reserved stock upon payment capture."""
    result = catalog_service.commit_stock_deduction(sku=req.sku, quantity=req.quantity)
    if not result.success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.message
        )
    return result

@router.get("/inventory", response_model=InventoryStatusResponse)
async def get_inventory_status(
    category: Optional[str] = Query(None, description="Filter inventory by category"),
    low_stock_threshold: int = Query(5, ge=0, description="Threshold to classify low stock status")
):
    """Retrieves real-time merchant inventory dashboard listing stock levels and statuses."""
    return catalog_service.get_inventory_status(
        category=category,
        low_stock_threshold=low_stock_threshold
    )

@router.post("/inventory/update", response_model=Product)
async def update_inventory(req: InventoryUpdateRequest):
    """Restocks or adjusts available stock for a specific SKU."""
    product = catalog_service.update_inventory(sku=req.sku, stock_delta=req.stock_delta)
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with SKU '{req.sku}' not found."
        )
    return product

@router.post("/seed", status_code=status.HTTP_200_OK)
async def seed_catalog():
    """Admin endpoint to ensure catalog database is initialized and seeded."""
    catalog_service.seed_catalog_if_empty()
    return {"status": "success", "message": "Catalog database initialization and seeding verified."}

