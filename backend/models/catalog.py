from typing import List, Optional
from pydantic import BaseModel, Field, ConfigDict

class ProductBase(BaseModel):
    sku: str = Field(..., description="Unique Stock Keeping Unit code")
    name: str = Field(..., description="Product title")
    description: Optional[str] = Field(None, description="Detailed product description")
    category: str = Field(..., description="Product category")
    price: float = Field(..., description="Product price in INR")
    currency: str = Field(default="INR", description="3-letter currency code")
    image_url: Optional[str] = Field(None, description="Image URL")
    tags: List[str] = Field(default_factory=list, description="Search and classification tags")
    cross_sell_skus: List[str] = Field(default_factory=list, description="SKUs of complementary items")

class Product(ProductBase):
    available_stock: int = Field(default=0, description="Real-time available stock")
    reserved_stock: int = Field(default=0, description="Currently reserved stock")

    model_config = ConfigDict(from_attributes=True)

class ProductSearchRequest(BaseModel):
    query: Optional[str] = Field(None, description="Keyword search query across title, description, and tags")
    category: Optional[str] = Field(None, description="Filter by product category")
    max_price: Optional[float] = Field(None, description="Filter products <= max_price")
    min_price: Optional[float] = Field(None, description="Filter products >= min_price")
    limit: int = Field(default=10, ge=1, le=50, description="Maximum number of results")

class ProductSearchResponse(BaseModel):
    total: int
    products: List[Product]

class StockReservationRequest(BaseModel):
    sku: str
    quantity: int = Field(..., gt=0, description="Quantity to reserve")

class StockReservationResult(BaseModel):
    success: bool
    sku: str
    requested_quantity: int
    available_stock: int
    reserved_stock: int
    message: str

class UpsellRecommendationResponse(BaseModel):
    source_sku: str
    recommendations: List[Product]

class StockReleaseRequest(BaseModel):
    sku: str
    quantity: int = Field(..., gt=0, description="Quantity to release back to available stock")

class StockCommitRequest(BaseModel):
    sku: str
    quantity: int = Field(..., gt=0, description="Quantity to permanently deduct from reserved stock")

class StockCommitResult(BaseModel):
    success: bool
    sku: str
    deducted_quantity: int
    remaining_reserved_stock: int
    message: str

class InventoryUpdateRequest(BaseModel):
    sku: str
    stock_delta: int = Field(..., description="Units to add (positive) or remove (negative) from available stock")

class InventoryItem(BaseModel):
    sku: str
    name: str
    category: str
    price: float
    currency: str = "INR"
    available_stock: int
    reserved_stock: int
    stock_status: str = Field(..., description="Stock availability status: IN_STOCK, LOW_STOCK, OUT_OF_STOCK")

class InventoryStatusResponse(BaseModel):
    total_items: int
    items: List[InventoryItem]

class CategoryListResponse(BaseModel):
    categories: List[str]
    total: int

class CatalogStatsResponse(BaseModel):
    total_products: int
    total_categories: int
    in_stock_count: int
    low_stock_count: int
    total_available_units: int


