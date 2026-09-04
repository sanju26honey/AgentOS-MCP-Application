import json
import os
import re
from pathlib import Path
from typing import List, Optional
from backend.db.database import get_db_connection, init_db
from backend.models.catalog import (
    Product,
    ProductSearchResponse,
    StockReservationResult,
    StockCommitResult,
    InventoryItem,
    InventoryStatusResponse,
    CategoryListResponse,
    CatalogStatsResponse
)
from backend.services.audit_logger import audit_logger

_backend_dir = Path(__file__).resolve().parent.parent
if (_backend_dir / "data" / "catalog.json").exists():
    DEFAULT_SEED_FILE = _backend_dir / "data" / "catalog.json"
else:
    DEFAULT_SEED_FILE = _backend_dir.parent / "backend" / "data" / "catalog.json"

class CatalogService:
    def __init__(self, db_path: str = None, engine_type: str = None):
        self.db_path = db_path
        self.engine_type = engine_type
        init_db(self.db_path, self.engine_type)
        self.seed_catalog_if_empty()

    def _exec(self, cursor, engine: str, sql: str, params: tuple = ()):
        if engine == "postgresql":
            sql_pg = sql.replace("?", "%s")
            cursor.execute(sql_pg, params)
        else:
            cursor.execute(sql, params)

    def seed_catalog_if_empty(self, seed_file: str = None):
        """Seeds the database from catalog.json if the products table is empty."""
        conn, engine = get_db_connection(self.db_path, self.engine_type)
        cursor = conn.cursor()
        
        try:
            self._exec(cursor, engine, "SELECT COUNT(*) as count FROM products")
            row = cursor.fetchone()
            count = row["count"] if row else 0
            if count > 0:
                return  # Database already seeded

            file_path = seed_file or str(DEFAULT_SEED_FILE)
            if not os.path.exists(file_path):
                return

            with open(file_path, "r", encoding="utf-8") as f:
                items = json.load(f)

            for item in items:
                tags = item.get("tags", [])
                cross_sell = item.get("cross_sell_skus", [])
                
                tags_param = json.dumps(tags) if engine == "sqlite" else json.dumps(tags)
                cross_sell_param = json.dumps(cross_sell) if engine == "sqlite" else json.dumps(cross_sell)

                self._exec(cursor, engine, """
                    INSERT INTO products (sku, name, description, category, price, currency, image_url, tags, cross_sell_skus)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT (sku) DO NOTHING;
                """, (
                    item["sku"],
                    item["name"],
                    item.get("description", ""),
                    item["category"],
                    item["price"],
                    item.get("currency", "INR"),
                    item.get("image_url", ""),
                    tags_param,
                    cross_sell_param
                ))

                initial_stock = item.get("initial_stock", 500)
                if initial_stock < 500:
                    initial_stock = 500
                self._exec(cursor, engine, """
                    INSERT INTO inventory (sku, available_stock, reserved_stock)
                    VALUES (?, ?, 0)
                    ON CONFLICT (sku) DO NOTHING;
                """, (item["sku"], initial_stock))

            conn.commit()
        finally:
            conn.close()

    def _row_to_product(self, row) -> Product:
        raw_tags = row["tags"]
        raw_cross = row["cross_sell_skus"]

        if isinstance(raw_tags, str):
            tags = json.loads(raw_tags) if raw_tags else []
        elif isinstance(raw_tags, list):
            tags = raw_tags
        else:
            tags = []

        if isinstance(raw_cross, str):
            cross_sell = json.loads(raw_cross) if raw_cross else []
        elif isinstance(raw_cross, list):
            cross_sell = raw_cross
        else:
            cross_sell = []

        row_keys = row.keys() if hasattr(row, "keys") else row

        return Product(
            sku=row["sku"],
            name=row["name"],
            description=row["description"],
            category=row["category"],
            price=float(row["price"]),
            currency=row["currency"],
            image_url=row["image_url"],
            tags=tags,
            cross_sell_skus=cross_sell,
            available_stock=row["available_stock"] if "available_stock" in row_keys else 0,
            reserved_stock=row["reserved_stock"] if "reserved_stock" in row_keys else 0
        )

    def get_product_by_sku(self, sku: str) -> Optional[Product]:
        """Fetches product details and stock by SKU."""
        conn, engine = get_db_connection(self.db_path, self.engine_type)
        cursor = conn.cursor()
        try:
            self._exec(cursor, engine, """
                SELECT p.*, i.available_stock, i.reserved_stock
                FROM products p
                JOIN inventory i ON p.sku = i.sku
                WHERE UPPER(p.sku) = UPPER(?)
            """, (sku.strip(),))
            row = cursor.fetchone()
            if not row:
                return None
            return self._row_to_product(row)
        finally:
            conn.close()

    def _get_term_variants(self, word: str) -> List[str]:
        word = word.lower().strip()
        variants = [word]
        if word.endswith('ies') and len(word) > 4:
            variants.append(word[:-3] + 'y')
        elif word.endswith('es') and len(word) > 4 and word not in ('shoes',):
            variants.append(word[:-2])
            variants.append(word[:-1])
        elif word.endswith('s') and len(word) > 3 and not word.endswith('ss'):
            variants.append(word[:-1])
        elif not word.endswith('s'):
            variants.append(word + 's')
        
        seen = set()
        res = []
        for v in variants:
            if v not in seen:
                seen.add(v)
                res.append(v)
        return res

    def search_products(
        self,
        query: Optional[str] = None,
        category: Optional[str] = None,
        min_price: Optional[float] = None,
        max_price: Optional[float] = None,
        in_stock_only: Optional[bool] = False,
        sort_by: Optional[str] = None,
        limit: int = 10
    ) -> ProductSearchResponse:
        """Executes multi-criteria keyword and parameter search over products."""
        conn, engine = get_db_connection(self.db_path, self.engine_type)
        cursor = conn.cursor()
        try:
            tags_col_expr = "CAST(p.tags AS TEXT)" if engine == "postgresql" else "p.tags"
            
            def _run_query(q_clause: str = "", q_params: list = []):
                sql = f"""
                    SELECT p.*, i.available_stock, i.reserved_stock
                    FROM products p
                    JOIN inventory i ON p.sku = i.sku
                    WHERE 1=1
                """
                params = []
                if category:
                    sql += " AND LOWER(p.category) = LOWER(?)"
                    params.append(category.strip())
                if min_price is not None:
                    sql += " AND p.price >= ?"
                    params.append(min_price)
                if max_price is not None:
                    sql += " AND p.price <= ?"
                    params.append(max_price)
                if in_stock_only:
                    sql += " AND i.available_stock > 0"
                
                sql += q_clause
                params.extend(q_params)

                order_sql = "ORDER BY p.price ASC"
                if sort_by:
                    s_clean = sort_by.lower().strip().replace('_', '-')
                    if s_clean in ('price-high', 'price-desc'):
                        order_sql = "ORDER BY p.price DESC"
                    elif s_clean in ('name-asc', 'name'):
                        order_sql = "ORDER BY p.name ASC"
                    elif s_clean in ('stock-high', 'stock-desc'):
                        order_sql = "ORDER BY i.available_stock DESC"
                    elif s_clean in ('price-low', 'price-asc'):
                        order_sql = "ORDER BY p.price ASC"

                sql += f" {order_sql} LIMIT ?"
                params.append(limit)

                self._exec(cursor, engine, sql, tuple(params))
                rows = cursor.fetchall()
                return [self._row_to_product(row) for row in rows]

            stopwords = {
                'find', 'buy', 'get', 'purchase', 'under', 'inr', 'rs', 'rupees',
                'price', 'less', 'than', 'a', 'an', 'the', 'with', 'for', 'and', 'or',
                'in', 'on', 'at', 'to', 'of', 'below', 'max', 'budget',
                'hi', 'hello', 'hey', 'greetings', 'yo', 'sup', 'test', 'help', 'pls', 'please'
            }

            products = []
            if query:
                clean_q = query.strip().lower()
                clean_q_norm = re.sub(r'(?<=\d),(?=\d)', '', clean_q)
                
                # Check for natural language budget constraint in query
                p_matches = re.findall(r'\b(?:under|below|less|max|budget)\b.*?(?:[₹\u20b9]|rs\.?|inr)?\s*(\d+(?:\.\d+)?)', clean_q_norm)
                if not p_matches:
                    p_matches = re.findall(r'(?:[₹\u20b9]|rs\.?|inr)\s*(\d+(?:\.\d+)?)', clean_q_norm)
                if p_matches:
                    try:
                        extracted_max = float(p_matches[0])
                        if extracted_max > 0:
                            max_price = min(max_price, extracted_max) if max_price is not None else extracted_max
                    except ValueError:
                        pass
                
                # Check if prompt is purely greetings or non-commerce
                raw_words = [w.strip(".,!?\"'()") for w in clean_q.split()]
                keywords = [w for w in raw_words if w and w not in stopwords and not w.replace(',', '').replace('.', '').isdigit() and len(w) >= 3]

                if not keywords and len(clean_q) < 4:
                    return ProductSearchResponse(total=0, products=[])

                # 1. Attempt exact substring match for longer specific terms
                if len(clean_q) >= 4:
                    q_expr = f"%{clean_q}%"
                    clause = f" AND (LOWER(p.name) LIKE ? OR LOWER(p.description) LIKE ? OR LOWER({tags_col_expr}) LIKE ? OR LOWER(p.sku) LIKE ?)"
                    products = _run_query(clause, [q_expr, q_expr, q_expr, q_expr])

                # 2. Extract key tokens from natural language prompt
                if not products and keywords:
                    # Add plural/singular variants & synonyms
                    expanded = []
                    for kw in keywords:
                        for v in self._get_term_variants(kw):
                            expanded.append(v)
                            if v in ('headphones', 'headphone'):
                                expanded.extend(['earbuds', 'audio', 'anc'])
                            elif v in ('earbuds', 'earphone', 'earphones'):
                                expanded.extend(['headphones', 'audio'])

                    if expanded:
                        token_clauses = []
                        token_params = []
                        for kw in expanded:
                            kw_expr = f"%{kw}%"
                            token_clauses.append(f"(LOWER(p.name) LIKE ? OR LOWER(p.description) LIKE ? OR LOWER({tags_col_expr}) LIKE ? OR LOWER(p.category) LIKE ?)")
                            token_params.extend([kw_expr, kw_expr, kw_expr, kw_expr])
                        
                        clause = " AND (" + " OR ".join(token_clauses) + ")"
                        products = _run_query(clause, token_params)

            else:
                products = _run_query()

            # Filter & score relevance
            if query and products:
                raw_words = [w.strip(".,!?\"'()") for w in query.strip().lower().split()]
                keywords = [w for w in raw_words if w and w not in stopwords and not w.replace(',', '').replace('.', '').isdigit() and len(w) >= 3]
                expanded_terms = set()
                for kw in keywords:
                    for v in self._get_term_variants(kw):
                        expanded_terms.add(v)
                        if v in ('headphones', 'headphone'):
                            expanded_terms.update(['earbuds', 'audio', 'anc', 'headphones'])
                        elif v in ('earbuds', 'earphone', 'earphones'):
                            expanded_terms.update(['headphones', 'audio', 'earbuds'])

                modifier_words = {
                    'blue', 'black', 'white', 'red', 'green', 'yellow', 'brown', 'grey', 'gray', 'pink',
                    'purple', 'cheap', 'expensive', 'small', 'medium', 'large', 'best', 'top', 'new',
                    'casual', 'formal', 'luxury', 'slim', 'oversized', 'lightweight', 'waterproof'
                }
                product_nouns = [kw for kw in keywords if kw not in modifier_words]

                if expanded_terms:
                    def _score(p: Product) -> int:
                        p_name = p.name.lower()
                        p_tags = [t.lower() for t in p.tags]
                        p_desc = p.description.lower()
                        p_cat = p.category.lower()
                        p_full_text = f"{p_name} {p_cat} {' '.join(p_tags)} {p_desc}"

                        # GUARDRAIL: If user prompt contains product nouns (e.g. "kurta"),
                        # at least one noun or its expanded synonym MUST match product text.
                        if product_nouns:
                            noun_matched = False
                            for noun in product_nouns:
                                syns = self._get_term_variants(noun)
                                for s_term in list(syns):
                                    if s_term in ('headphones', 'headphone'):
                                        syns.extend(['earbuds', 'audio', 'anc'])
                                    elif s_term in ('earbuds', 'earphone', 'earphones'):
                                        syns.extend(['headphones', 'audio'])
                                
                                if any(syn in p_full_text for syn in syns):
                                    noun_matched = True
                                    break
                            if not noun_matched:
                                return 0  # Rejects matching ONLY a color/modifier like "blue" when "kurta" is missing

                        s = 0
                        for term in expanded_terms:
                            if term in p_name:
                                s += 3
                            if any(term in t for t in p_tags):
                                s += 3
                            if term in p_cat:
                                s += 2
                            if term in p_desc:
                                s += 1
                        return s

                    # Filter products with score > 0
                    scored = [(p, _score(p)) for p in products]
                    matched_scored = [item for item in scored if item[1] > 0]
                    matched_scored.sort(key=lambda item: item[1], reverse=True)
                    products = [item[0] for item in matched_scored]
                else:
                    products = []

            return ProductSearchResponse(total=len(products), products=products)
        finally:
            conn.close()


    def get_smart_upsell(
        self,
        sku: str,
        cart_skus: Optional[List[str]] = None,
        limit: int = 3
    ) -> List[Product]:
        """Recommends cross-sell items based on complementary SKU mappings."""
        product = self.get_product_by_sku(sku)
        if not product or not product.cross_sell_skus:
            return []

        cart_set = set(s.upper() for s in (cart_skus or []))
        cart_set.add(sku.upper())

        recommendations = []
        for target_sku in product.cross_sell_skus:
            if target_sku.upper() in cart_set:
                continue
            rec_product = self.get_product_by_sku(target_sku)
            if rec_product and rec_product.available_stock > 0:
                recommendations.append(rec_product)
                if len(recommendations) >= limit:
                    break

        return recommendations

    def reserve_stock(self, sku: str, quantity: int) -> StockReservationResult:
        """Atomically checks and reserves stock for an order draft."""
        conn, engine = get_db_connection(self.db_path, self.engine_type)
        cursor = conn.cursor()
        
        try:
            if engine == "sqlite":
                cursor.execute("BEGIN IMMEDIATE;")
            
            self._exec(cursor, engine, """
                SELECT available_stock, reserved_stock FROM inventory WHERE UPPER(sku) = UPPER(?) FOR UPDATE
            """ if engine == "postgresql" else """
                SELECT available_stock, reserved_stock FROM inventory WHERE UPPER(sku) = UPPER(?)
            """, (sku.strip(),))
            row = cursor.fetchone()
            
            if not row:
                conn.rollback()
                return StockReservationResult(
                    success=False,
                    sku=sku,
                    requested_quantity=quantity,
                    available_stock=0,
                    reserved_stock=0,
                    message=f"Product with SKU '{sku}' not found."
                )

            avail = row["available_stock"]
            res = row["reserved_stock"]

            if avail < quantity:
                conn.rollback()
                return StockReservationResult(
                    success=False,
                    sku=sku,
                    requested_quantity=quantity,
                    available_stock=avail,
                    reserved_stock=res,
                    message=f"Insufficient available stock ({avail} available, {quantity} requested)."
                )

            # Atomic decrement available, increment reserved
            new_avail = avail - quantity
            new_res = res + quantity

            self._exec(cursor, engine, """
                UPDATE inventory
                SET available_stock = ?, reserved_stock = ?, updated_at = CURRENT_TIMESTAMP
                WHERE UPPER(sku) = UPPER(?)
            """, (new_avail, new_res, sku.strip()))

            conn.commit()
            
            res_obj = StockReservationResult(
                success=True,
                sku=sku,
                requested_quantity=quantity,
                available_stock=new_avail,
                reserved_stock=new_res,
                message=f"Successfully reserved {quantity} unit(s) of '{sku}'."
            )

            audit_logger.log_event(
                event_type="INVENTORY_RESERVED",
                actor="SYSTEM",
                payload={
                    "sku": sku,
                    "requested_quantity": quantity,
                    "available_stock": new_avail,
                    "reserved_stock": new_res
                },
                policy_result="PASSED"
            )

            return res_obj
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            conn.close()

    def release_stock(self, sku: str, quantity: int) -> StockReservationResult:
        """Reverts reserved stock back to available stock (e.g., on order cancellation)."""
        conn, engine = get_db_connection(self.db_path, self.engine_type)
        cursor = conn.cursor()
        
        try:
            if engine == "sqlite":
                cursor.execute("BEGIN IMMEDIATE;")
            
            self._exec(cursor, engine, """
                SELECT available_stock, reserved_stock FROM inventory WHERE UPPER(sku) = UPPER(?) FOR UPDATE
            """ if engine == "postgresql" else """
                SELECT available_stock, reserved_stock FROM inventory WHERE UPPER(sku) = UPPER(?)
            """, (sku.strip(),))
            row = cursor.fetchone()
            
            if not row:
                conn.rollback()
                return StockReservationResult(
                    success=False,
                    sku=sku,
                    requested_quantity=quantity,
                    available_stock=0,
                    reserved_stock=0,
                    message=f"Product with SKU '{sku}' not found."
                )

            avail = row["available_stock"]
            res = row["reserved_stock"]
            release_qty = min(res, quantity)

            new_avail = avail + release_qty
            new_res = res - release_qty

            self._exec(cursor, engine, """
                UPDATE inventory
                SET available_stock = ?, reserved_stock = ?, updated_at = CURRENT_TIMESTAMP
                WHERE UPPER(sku) = UPPER(?)
            """, (new_avail, new_res, sku.strip()))

            conn.commit()
            
            return StockReservationResult(
                success=True,
                sku=sku,
                requested_quantity=release_qty,
                available_stock=new_avail,
                reserved_stock=new_res,
                message=f"Released {release_qty} reserved unit(s) of '{sku}' back to available stock."
            )
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            conn.close()

    def commit_stock_deduction(self, sku: str, quantity: int) -> StockCommitResult:
        """Permanently deducts stock from reserved pool upon successful payment capture."""
        conn, engine = get_db_connection(self.db_path, self.engine_type)
        cursor = conn.cursor()
        try:
            if engine == "sqlite":
                cursor.execute("BEGIN IMMEDIATE;")
            self._exec(cursor, engine, """
                SELECT reserved_stock FROM inventory WHERE UPPER(sku) = UPPER(?) FOR UPDATE
            """ if engine == "postgresql" else """
                SELECT reserved_stock FROM inventory WHERE UPPER(sku) = UPPER(?)
            """, (sku.strip(),))
            row = cursor.fetchone()
            if not row:
                conn.rollback()
                return StockCommitResult(
                    success=False,
                    sku=sku,
                    deducted_quantity=0,
                    remaining_reserved_stock=0,
                    message=f"Product with SKU '{sku}' not found."
                )
            
            res = row["reserved_stock"]
            deduct_qty = min(res, quantity)
            new_res = res - deduct_qty
            
            self._exec(cursor, engine, """
                UPDATE inventory
                SET reserved_stock = ?, updated_at = CURRENT_TIMESTAMP
                WHERE UPPER(sku) = UPPER(?)
            """, (new_res, sku.strip()))
            
            conn.commit()
            return StockCommitResult(
                success=True,
                sku=sku,
                deducted_quantity=deduct_qty,
                remaining_reserved_stock=new_res,
                message=f"Successfully committed stock deduction of {deduct_qty} unit(s) for '{sku}'."
            )
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            conn.close()

    def get_inventory_status(
        self,
        category: Optional[str] = None,
        low_stock_threshold: int = 5
    ) -> InventoryStatusResponse:
        """Returns inventory levels and stock status across products."""
        conn, engine = get_db_connection(self.db_path, self.engine_type)
        cursor = conn.cursor()
        try:
            sql = """
                SELECT p.sku, p.name, p.category, p.price, p.currency, i.available_stock, i.reserved_stock
                FROM products p
                JOIN inventory i ON p.sku = i.sku
                WHERE 1=1
            """
            params = []
            if category:
                sql += " AND LOWER(p.category) = LOWER(?)"
                params.append(category.strip())

            sql += " ORDER BY p.sku ASC"
            self._exec(cursor, engine, sql, tuple(params))
            rows = cursor.fetchall()

            items = []
            for r in rows:
                avail = r["available_stock"]
                if avail == 0:
                    status_str = "OUT_OF_STOCK"
                elif avail <= low_stock_threshold:
                    status_str = "LOW_STOCK"
                else:
                    status_str = "IN_STOCK"

                items.append(InventoryItem(
                    sku=r["sku"],
                    name=r["name"],
                    category=r["category"],
                    price=float(r["price"]),
                    currency=r["currency"],
                    available_stock=avail,
                    reserved_stock=r["reserved_stock"],
                    stock_status=status_str
                ))

            return InventoryStatusResponse(total_items=len(items), items=items)
        finally:
            conn.close()

    def update_inventory(self, sku: str, stock_delta: int) -> Optional[Product]:
        """Adjusts available stock for a product (e.g. restocking or manual stock updates)."""
        conn, engine = get_db_connection(self.db_path, self.engine_type)
        cursor = conn.cursor()
        try:
            if engine == "sqlite":
                cursor.execute("BEGIN IMMEDIATE;")
            self._exec(cursor, engine, """
                SELECT available_stock FROM inventory WHERE UPPER(sku) = UPPER(?) FOR UPDATE
            """ if engine == "postgresql" else """
                SELECT available_stock FROM inventory WHERE UPPER(sku) = UPPER(?)
            """, (sku.strip(),))
            row = cursor.fetchone()
            if not row:
                conn.rollback()
                return None

            current_avail = row["available_stock"]
            new_avail = max(0, current_avail + stock_delta)

            self._exec(cursor, engine, """
                UPDATE inventory
                SET available_stock = ?, updated_at = CURRENT_TIMESTAMP
                WHERE UPPER(sku) = UPPER(?)
            """, (new_avail, sku.strip()))

            conn.commit()
            return self.get_product_by_sku(sku)
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            conn.close()

    def get_categories(self) -> CategoryListResponse:
        """Retrieves list of distinct product categories in merchant catalog."""
        conn, engine = get_db_connection(self.db_path, self.engine_type)
        cursor = conn.cursor()
        try:
            self._exec(cursor, engine, "SELECT DISTINCT category FROM products WHERE category IS NOT NULL ORDER BY category ASC")
            rows = cursor.fetchall()
            cats = [r["category"] for r in rows if r["category"]]
            return CategoryListResponse(categories=cats, total=len(cats))
        finally:
            conn.close()

    def get_catalog_stats(self) -> CatalogStatsResponse:
        """Retrieves aggregated statistics for the storefront catalog."""
        conn, engine = get_db_connection(self.db_path, self.engine_type)
        cursor = conn.cursor()
        try:
            self._exec(cursor, engine, """
                SELECT 
                    COUNT(DISTINCT p.sku) as total_products,
                    COUNT(DISTINCT p.category) as total_categories,
                    SUM(CASE WHEN i.available_stock > 0 THEN 1 ELSE 0 END) as in_stock_count,
                    SUM(CASE WHEN i.available_stock > 0 AND i.available_stock <= 5 THEN 1 ELSE 0 END) as low_stock_count,
                    COALESCE(SUM(i.available_stock), 0) as total_available_units
                FROM products p
                JOIN inventory i ON p.sku = i.sku
            """)
            row = cursor.fetchone()
            if not row:
                return CatalogStatsResponse(
                    total_products=0,
                    total_categories=0,
                    in_stock_count=0,
                    low_stock_count=0,
                    total_available_units=0
                )
            return CatalogStatsResponse(
                total_products=int(row["total_products"] or 0),
                total_categories=int(row["total_categories"] or 0),
                in_stock_count=int(row["in_stock_count"] or 0),
                low_stock_count=int(row["low_stock_count"] or 0),
                total_available_units=int(row["total_available_units"] or 0)
            )
        finally:
            conn.close()


