from dotenv import load_dotenv
import os
import sys
import logging

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Cargar variables de entorno (solo se usará si no están ya definidas en el entorno)
load_dotenv()


class Config:
    # Configuraciones de la aplicación
    DEBUG = os.getenv('DEBUG') == 'True'
    SECRET_KEY = os.getenv("SECRET_KEY",)

    # Credenciales para Amazon Web Services
    AWS_ACCESS_KEY = os.getenv("AWS_ACCESS_KEY")
    AWS_SECRET_KEY = os.getenv("AWS_SECRET_KEY")
    AWS_REGION = os.getenv("AWS_REGION")

    # Configuración MongoDB - usar nombres de host de Docker si estamos en contenedores
    MONGO_HOST = os.getenv("MONGO_HOST", "localhost")
    MONGO_PORT = int(os.getenv("MONGO_PORT", "27017"))
    MONGO_DB = os.getenv("MONGO_INITDB_DATABASE", "DB")
    MONGO_USER = os.getenv("MONGO_INITDB_ROOT_USERNAME")
    MONGO_PASS = os.getenv("MONGO_INITDB_ROOT_PASSWORD")

    # Configuración Redis - usar nombres de host de Docker si estamos en contenedores
    REDIS_HOST = os.getenv("REDIS_HOST")
    REDIS_PORT = int(os.getenv("REDIS_PORT"))
    REDIS_DB = int(os.getenv("REDIS_DB", "0"))

    # Usar la clave secreta de Django si está disponible
    JWT_SECRET =  SECRET_KEY
    JWT_ALGORITHM =  os.getenv("JWT_ALGORITHM")

    # Configuraciones de logging
    LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO')
    LOG_FILE = os.getenv('LOG_FILE', 'app.log')
