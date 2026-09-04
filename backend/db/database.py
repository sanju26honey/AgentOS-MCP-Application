import os
import sqlite3
import logging
from pathlib import Path
from backend.config import settings

logger = logging.getLogger("db_manager")

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
    from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
    HAS_PSYCOPG2 = True
except ImportError:
    HAS_PSYCOPG2 = False


def create_postgres_db_if_not_exists():
    """Connects to default postgres DB and creates target DB if it does not exist (local dev)."""
    if not HAS_PSYCOPG2 or settings.POSTGRES_URL:
        return False
    try:
        conn = psycopg2.connect(
            dbname="postgres",
            user=settings.POSTGRES_USER,
            password=settings.POSTGRES_PASSWORD,
            host=settings.POSTGRES_HOST,
            port=settings.POSTGRES_PORT,
            connect_timeout=5
        )
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cursor = conn.cursor()
        cursor.execute("SELECT 1 FROM pg_database WHERE datname = %s;", (settings.POSTGRES_DB,))
        exists = cursor.fetchone()
        if not exists:
            cursor.execute(f'CREATE DATABASE "{settings.POSTGRES_DB}";')
            logger.info(f"Created PostgreSQL database '{settings.POSTGRES_DB}'")
        cursor.close()
        conn.close()
        return True
    except Exception as e:
        logger.warning(f"Could not create PostgreSQL database locally: {e}")
        return False


def get_db_connection(db_path: str = None, engine_type: str = None):
    """
    Returns an active database connection wrapper.
    Supports PostgreSQL (Supabase / Cloud / Local) with fallback to SQLite if PostgreSQL is unavailable.
    """
    if engine_type:
        target_engine = engine_type
    elif db_path:
        target_engine = "sqlite"
    else:
        target_engine = settings.DB_ENGINE

    if target_engine == "postgresql" and HAS_PSYCOPG2:
        try:
            # If explicit POSTGRES_URL is provided (e.g. Supabase, Neon, RDS connection string)
            if settings.POSTGRES_URL and settings.POSTGRES_URL.strip():
                conn = psycopg2.connect(
                    settings.POSTGRES_URL.strip(),
                    cursor_factory=RealDictCursor,
                    connect_timeout=2
                )
                conn.autocommit = False
                return conn, "postgresql"
            
            # Otherwise connect using discrete local parameters
            create_postgres_db_if_not_exists()
            conn = psycopg2.connect(
                dbname=settings.POSTGRES_DB,
                user=settings.POSTGRES_USER,
                password=settings.POSTGRES_PASSWORD,
                host=settings.POSTGRES_HOST,
                port=settings.POSTGRES_PORT,
                cursor_factory=RealDictCursor,
                connect_timeout=2
            )
            conn.autocommit = False
            return conn, "postgresql"
        except Exception as e:
            logger.warning(f"PostgreSQL connection failed ({e}). Falling back to SQLite...")

    # Fallback to SQLite
    target_path = db_path or settings.DB_PATH
    if not os.path.isabs(target_path):
        from backend.config import BASE_DIR
        target_path = str(BASE_DIR / target_path)

    os.makedirs(os.path.dirname(os.path.abspath(target_path)), exist_ok=True)
    
    conn = sqlite3.connect(target_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA foreign_keys=ON;")
    return conn, "sqlite"


def init_db(db_path: str = None, engine_type: str = None):
    """Initializes tables for either PostgreSQL or SQLite based on active engine."""
    conn, engine = get_db_connection(db_path, engine_type)
    cursor = conn.cursor()

    try:
        if engine == "postgresql":
            # 1. Products Table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS products (
                    sku VARCHAR(100) PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    description TEXT,
                    category VARCHAR(100) NOT NULL,
                    price NUMERIC(12,2) NOT NULL,
                    currency VARCHAR(10) DEFAULT 'INR',
                    image_url TEXT,
                    tags JSONB,
                    cross_sell_skus JSONB,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                );
            """)

            # 2. Inventory Table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS inventory (
                    sku VARCHAR(100) PRIMARY KEY REFERENCES products(sku) ON DELETE CASCADE,
                    available_stock INT NOT NULL DEFAULT 0,
                    reserved_stock INT NOT NULL DEFAULT 0,
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                );
            """)

            # 3. Orders Table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS orders (
                    id VARCHAR(100) PRIMARY KEY,
                    buyer_email VARCHAR(255) NOT NULL,
                    total_amount NUMERIC(12,2) NOT NULL,
                    currency VARCHAR(10) DEFAULT 'INR',
                    status VARCHAR(50) NOT NULL,
                    razorpay_order_id VARCHAR(100),
                    razorpay_payment_id VARCHAR(100),
                    auth_token TEXT,
                    items_json JSONB NOT NULL,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                );
            """)

            # 4. Audit Telemetry Table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS audit_telemetry (
                    id BIGSERIAL PRIMARY KEY,
                    trace_id VARCHAR(100) NOT NULL,
                    order_id VARCHAR(100),
                    event_type VARCHAR(100) NOT NULL,
                    actor VARCHAR(100) NOT NULL,
                    payload_json JSONB,
                    execution_time_ms NUMERIC(10,2),
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                );
            """)
        else:
            # SQLite Tables
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS products (
                    sku TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    description TEXT,
                    category TEXT NOT NULL,
                    price REAL NOT NULL,
                    currency TEXT DEFAULT 'INR',
                    image_url TEXT,
                    tags TEXT,
                    cross_sell_skus TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS inventory (
                    sku TEXT PRIMARY KEY,
                    available_stock INTEGER NOT NULL DEFAULT 0,
                    reserved_stock INTEGER NOT NULL DEFAULT 0,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (sku) REFERENCES products (sku) ON DELETE CASCADE
                )
            """)

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS orders (
                    id TEXT PRIMARY KEY,
                    buyer_email TEXT NOT NULL,
                    total_amount TEXT NOT NULL,
                    currency TEXT DEFAULT 'INR',
                    status TEXT NOT NULL,
                    razorpay_order_id TEXT,
                    razorpay_payment_id TEXT,
                    auth_token TEXT,
                    items_json TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS audit_telemetry (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    trace_id TEXT NOT NULL,
                    order_id TEXT,
                    event_type TEXT NOT NULL,
                    actor TEXT NOT NULL,
                    payload_json TEXT,
                    execution_time_ms REAL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

        conn.commit()
    finally:
        conn.close()
