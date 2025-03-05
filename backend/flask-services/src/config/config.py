from dotenv import load_dotenv
import os
import sys
import logging

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Cargar variables de entorno
load_dotenv()

# Integración con Django
DJANGO_INTEGRATION = False
DJANGO_SETTINGS = None
DJANGO_MODELS_AVAILABLE = False

try:
    # Determinar la ruta al proyecto Django si aún no está en el sys.path
    current_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.abspath(os.path.join(current_dir, '../..', '..'))
    django_project_path = os.path.join(project_root, 'django_services')
    
    if django_project_path not in sys.path:
        sys.path.insert(0, django_project_path)
        sys.path.insert(0, project_root)
        logger.info(f"Añadidos a sys.path: {project_root}, {django_project_path}")
    
    # Configurar el entorno Django
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'django_services.config.settings')
    
    # Importar configuración de Django
    from django.conf import settings
    import django
    
    # Inicializar Django si no está ya configurado
    if not django.conf.settings.configured:
        django.setup()  # Inicializar Django para poder usar sus modelos
    
    # Usar la misma clave secreta y algoritmo JWT que Django
    DJANGO_INTEGRATION = True
    DJANGO_SETTINGS = settings
    DJANGO_SECRET_KEY = settings.SECRET_KEY
    JWT_ALGORITHM = os.getenv("JWT_ALGORITHM") # Usar el mismo algoritmo que en Django
    
    # Verificar si podemos acceder a los modelos de Django
    try:
        from django.apps import apps
        DJANGO_MODELS_AVAILABLE = True
        logger.info("Modelos de Django disponibles para la aplicación Flask")
    except Exception as e:
        logger.warning(f"No se pudo acceder a los modelos de Django: {str(e)}")
    
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
    MONGO_PORT = int(os.getenv("MONGO_PORT", "27017"))
    MONGO_DB = os.getenv("MONGO_INITDB_DATABASE")
    MONGO_USER = os.getenv("MONGO_INITDB_ROOT_USERNAME")
    MONGO_PASS = os.getenv("MONGO_INITDB_ROOT_PASSWORD")

    REDIS_HOST = os.getenv("REDIS_HOST")
    REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))

    # Usar la clave secreta de Django si está disponible
    JWT_SECRET = DJANGO_SECRET_KEY or os.getenv("JWT_SECRET", "default_jwt_secret")
    JWT_ALGORITHM = JWT_ALGORITHM or os.getenv("JWT_ALGORITHM", "HS256")

    # Integración con Django
    DJANGO_INTEGRATION = DJANGO_INTEGRATION
    DJANGO_MODELS_AVAILABLE = DJANGO_MODELS_AVAILABLE

    # Configuraciones de logging
    LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO')
    LOG_FILE = os.getenv('LOG_FILE', 'app.log')