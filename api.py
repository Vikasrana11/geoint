from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import psycopg2
from psycopg2.extras import RealDictCursor
from urllib.parse import unquote
import re
import logging

app = FastAPI()

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Enable CORS to allow frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

db_params = {
    "dbname": "GIS_CRPF",
    "user": "postgres",
    "password": "test123",  # Replace with your actual password
    "host": "localhost",
    "port": "5432"
}

def get_db_connection():
    """Establish a connection to the PostgreSQL database."""
    try:
        return psycopg2.connect(**db_params)
    except Exception as e:
        logger.error(f"Database connection failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Database connection failed: {str(e)}")

def sanitize_table_name(table_name: str) -> str:
    """Sanitize table name to prevent SQL injection."""
    if not re.match(r'^[a-zA-Z0-9_ ]+$', table_name):
        raise HTTPException(status_code=400, detail="Invalid table name")
    return table_name

@app.get("/api/layers")
async def get_layers():
    """Fetch all available layers (tables) from the database."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT f_table_name FROM geometry_columns WHERE f_table_schema = 'public'")
        layers = [row[0] for row in cursor.fetchall()]
        cursor.close()
        conn.close()
        logger.info(f"Available layers: {layers}")
        return {"layers": layers}
    except Exception as e:
        logger.error(f"Error fetching layers: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/states")
async def get_states():
    """Fetch unique state values across all layers."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT DISTINCT state
            FROM (
                SELECT state FROM jkinput WHERE state IS NOT NULL
                UNION
                SELECT state FROM lweinput WHERE state IS NOT NULL
                UNION
                SELECT state FROM neinput WHERE state IS NOT NULL
                UNION
                SELECT state FROM crpfdeployment WHERE state IS NOT NULL
                UNION
                SELECT state FROM uavintercept WHERE state IS NOT NULL
                UNION
                SELECT state FROM crpfincident WHERE state IS NOT NULL
            ) AS states
            ORDER BY state
        """)
        states = [row[0] for row in cursor.fetchall()]
        cursor.close()
        conn.close()
        logger.info(f"Fetched states: {states}")
        return {"states": states}
    except Exception as e:
        logger.error(f"Error fetching states: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/districts")
async def get_districts(layers: str, state: str = None):
    """Fetch unique district values for the specified layers, optionally filtered by state."""
    try:
        layer_list = [sanitize_table_name(layer) for layer in layers.split(',')]
        conn = get_db_connection()
        cursor = conn.cursor()
        query = "SELECT DISTINCT district FROM ("
        subqueries = []
        params = []
        for layer in layer_list:
            cursor.execute("SELECT f_table_name FROM geometry_columns WHERE f_table_name = %s", (layer,))
            if not cursor.fetchone():
                continue  # Skip invalid layers
            subquery = f"SELECT district FROM {layer} WHERE district IS NOT NULL"
            if state:
                subquery += " AND state = %s"
                params.append(state)
            subqueries.append(subquery)
        if not subqueries:
            cursor.close()
            conn.close()
            return {"districts": []}
        query += " UNION ".join(subqueries) + ") AS districts ORDER BY district"
        cursor.execute(query, params)
        districts = [row[0] for row in cursor.fetchall()]
        cursor.close()
        conn.close()
        logger.info(f"Fetched districts for layers {layers}, state {state}: {districts}")
        return {"districts": districts}
    except Exception as e:
        logger.error(f"Error fetching districts: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/geojson/{table_name}")
async def get_geojson(table_name: str, limit: int = 1000, offset: int = 0):
    """Fetch GeoJSON data for a given table."""
    try:
        table_name = unquote(sanitize_table_name(table_name))
        logger.info(f"Fetching GeoJSON for table: {table_name}")
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("SELECT f_table_name FROM geometry_columns WHERE f_table_name = %s", (table_name,))
        if not cursor.fetchone():
            logger.error(f"Table '{table_name}' not found in geometry_columns")
            raise HTTPException(status_code=404, detail=f"Table '{table_name}' not found")
        cursor.execute("SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = %s AND column_name != 'geom'", (table_name,))
        columns = [col["column_name"] for col in cursor.fetchall()]
        props = ', '.join([f"'{col}', {col}" for col in columns])
        query = f"""
            SELECT json_build_object(
                'type', 'FeatureCollection',
                'features', json_agg(
                    json_build_object(
                        'type', 'Feature',
                        'geometry', ST_AsGeoJSON(geom)::json,
                        'properties', json_build_object({props}),
                        'id', id
                    )
                )
            ) AS geojson
            FROM "{table_name}"
            LIMIT %s OFFSET %s
        """
        cursor.execute(query, (limit, offset))
        result = cursor.fetchone()
        cursor.close()
        conn.close()
        return result["geojson"] if result["geojson"] else {"type": "FeatureCollection", "features": []}
    except Exception as e:
        logger.error(f"Error fetching GeoJSON for {table_name}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/filter/{table_name}")
async def filter_by_date(table_name: str, start_date: str, end_date: str, state: str = None, district: str = None, limit: int = 1000, offset: int = 0):
    """Filter GeoJSON data by date range, state, and district for a given table."""
    try:
        table_name = unquote(sanitize_table_name(table_name))
        logger.info(f"Filtering table: {table_name}, start_date: {start_date}, end_date: {end_date}, state: {state}, district: {district}")
        # Validate date format (YYYY-MM-DD)
        if not re.match(r'^\d{4}-\d{2}-\d{2}$', start_date) or not re.match(r'^\d{4}-\d{2}-\d{2}$', end_date):
            logger.error(f"Invalid date format: start_date={start_date}, end_date={end_date}")
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("SELECT f_table_name FROM geometry_columns WHERE f_table_name = %s", (table_name,))
        if not cursor.fetchone():
            logger.error(f"Table '{table_name}' not found in geometry_columns")
            raise HTTPException(status_code=404, detail=f"Table '{table_name}' not found")
        
        # Map table names to their date columns
        date_columns = {
            'neinput': 'inputdate',
            'jkinput': 'inputdate',
            'lweinput': 'inputdate',
            'uavintercept': 'missiondate',
            'crpfdeployment': 'inputdate',
            'crpfincident': 'inputdate'
        }
        
        date_column = date_columns.get(table_name)
        if not date_column:
            logger.error(f"No date column defined for table '{table_name}'")
            raise HTTPException(status_code=400, detail=f"No date column defined for table '{table_name}'")
        
        cursor.execute("SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = %s AND column_name = %s", (table_name, date_column))
        if not cursor.fetchone():
            logger.error(f"Table '{table_name}' has no {date_column} column")
            raise HTTPException(status_code=400, detail=f"Table '{table_name}' has no {date_column} column")
        
        cursor.execute("SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = %s AND column_name != 'geom'", (table_name,))
        columns = [col["column_name"] for col in cursor.fetchall()]
        props = ', '.join([f"'{col}', {col}" for col in columns])
        query = f"""
            SELECT json_build_object(
                'type', 'FeatureCollection',
                'features', json_agg(
                    json_build_object(
                        'type', 'Feature',
                        'geometry', ST_AsGeoJSON(geom)::json,
                        'properties', json_build_object({props}),
                        'id', id
                    )
                )
            ) AS geojson
            FROM "{table_name}"
            WHERE {date_column} BETWEEN %s AND %s
        """
        params = [start_date, end_date]
        if state:
            query += " AND state = %s"
            params.append(state)
        if district:
            query += " AND district = %s"
            params.append(district)
        query += " LIMIT %s OFFSET %s"
        params.extend([limit, offset])
        cursor.execute(query, params)
        result = cursor.fetchone()
        cursor.close()
        conn.close()
        return result["geojson"] if result["geojson"] else {"type": "FeatureCollection", "features": []}
    except Exception as e:
        logger.error(f"Error filtering {table_name}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/columns/{table_name}")
async def get_columns(table_name: str):
    """Fetch column names and types for a given table."""
    try:
        table_name = unquote(sanitize_table_name(table_name))
        logger.info(f"Fetching columns for table: {table_name}")
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("""
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = %s AND column_name != 'geom'
        """, (table_name,))
        columns = cursor.fetchall()
        cursor.close()
        conn.close()
        if not columns:
            logger.error(f"Table '{table_name}' not found or has no attributes")
            raise HTTPException(status_code=404, detail=f"Table '{table_name}' not found or has no attributes")
        return {"columns": [{"name": col["column_name"], "type": col["data_type"]} for col in columns]}
    except Exception as e:
        logger.error(f"Error fetching columns for {table_name}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))