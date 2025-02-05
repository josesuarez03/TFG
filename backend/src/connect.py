import psycopg2
from psycopg2 import OperationalError
import logging
from config import Config
from contextlib import contextmanager

logging.basicConfig(
    level=getattr(logging, Config.LOG_LEVEL),
    format='%(asctime)s - %(levelname)s - %(message)s'
)

@contextmanager
def get_connection():
    conn = None
    try:
        conn = psycopg2.connect(
            host=Config.DB_HOST,
            dbname=Config.DB_NAME,
            user=Config.DB_USER,
            password=Config.DB_PASSWORD,
            port=Config.DB_PORT
        )
        logging.info("Se ha establecido correctamente la conexión a la base de datos")
        yield conn
    except OperationalError as e:
        logging.error(f"Error de conexión a la base de datos: {e}")
        raise
    finally:
        if conn is not None:
            conn.close()
            logging.info("Conexión cerrada")