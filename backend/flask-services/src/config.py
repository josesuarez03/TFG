from dotenv import load_dotenv
import os
import sys
import logging

# Cargar variables de entorno
load_dotenv()

# Configurar logging
logger = logging.getLogger(__name__)

# Intentar importar configuración de Django
DJANGO_INTEGRATION = False
try:
    # Determinar la ruta al proyecto Django
    current_dir = os.path.dirname(os.path.abspath(__file__))
    django_project_path = os.path.abspath(os.path.join(current_dir, '../..', 'django_services'))
    
    if django_project_path not in sys.path:
        sys.path.append(django_project_path)
    
    # Configurar el entorno Django
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
    
    # Importar configuración de Django
    from django.conf import settings
    
    # Usar la misma clave secreta y algoritmo JWT que Django
    DJANGO_INTEGRATION = True
    DJANGO_SECRET_KEY = settings.SECRET_KEY
    JWT_ALGORITHM = os.getenv("JWT_ALGORITHM") # Usar el mismo algoritmo que en Django
    
    logger.info("Integración con Django configurada correctamente")
    
except (ImportError, ModuleNotFoundError) as e:
    logger.warning(f"No se pudo importar la configuración de Django: {str(e)}")
    DJANGO_SECRET_KEY = None
    JWT_ALGORITHM = None

class Config:
    # Configuraciones de la aplicación
    DEBUG = os.getenv('FLASK_DEBUG', 'True') == 'True'
    SECRET_KEY = os.getenv("SECRET_KEY", "default_secret_key")

    # Credenciales para Amazon Web Services
    AWS_ACCESS_KEY = os.getenv("AWS_ACCESS_KEY")
    AWS_SECRET_KEY = os.getenv("AWS_SECRET_KEY")
    AWS_REGION = os.getenv("AWS_REGION")

    MONGO_HOST = os.getenv("MONGO_HOST")
    MONGO_PORT = int(os.getenv("MONGO_PORT"))
    MONGO_DB = os.getenv("MONGO_INITDB_DATABASE")
    MONGO_USER = os.getenv("MONGO_INITDB_ROOT_USERNAME")
    MONGO_PASS = os.getenv("MONGO_INITDB_ROOT_PASSWORD")

    REDIS_HOST = os.getenv("REDIS_HOST")
    REDIS_PORT = int(os.getenv("REDIS_PORT"))

    JWT_SECRET = os.getenv("DJANGO_SECRET_KEY")
    JWT_ALGORITHM = os.getenv("JWT_ALGORITHM")

    # Integración con Django
    DJANGO_INTEGRATION = DJANGO_INTEGRATION


    # Configuraciones de logging
    LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO')
    LOG_FILE = os.getenv('LOG_FILE', 'app.log')