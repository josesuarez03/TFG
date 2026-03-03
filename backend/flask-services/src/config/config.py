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
    AWS_ACCESS_KEY = os.getenv("AWS_ACCESS_KEY") or os.getenv("AWS_ACCESS_KEY_ID")
    AWS_SECRET_KEY = os.getenv("AWS_SECRET_KEY") or os.getenv("AWS_SECRET_ACCESS_KEY")
    AWS_REGION = os.getenv("AWS_REGION")
    BEDROCK_EMBEDDING_MODEL_ID = os.getenv("BEDROCK_EMBEDDING_MODEL_ID")
    BEDROCK_CLAUDE_MODEL_ID = os.getenv("BEDROCK_CLAUDE_MODEL_ID")
    BEDROCK_CLAUDE_INFERENCE_PROFILE_ID = os.getenv("BEDROCK_CLAUDE_INFERENCE_PROFILE_ID")

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
    CHAT_REDIS_DB_CONTEXT = int(os.getenv("CHAT_REDIS_DB_CONTEXT", "2"))
    CHAT_CONTEXT_TTL_SECONDS = int(os.getenv("CHAT_CONTEXT_TTL_SECONDS", str(60 * 60 * 24)))
    CHAT_CONTEXT_WINDOW_N = int(os.getenv("CHAT_CONTEXT_WINDOW_N", "8"))
    CHAT_CONTEXT_TOP_K = int(os.getenv("CHAT_CONTEXT_TOP_K", "5"))
    CHAT_CONTROLLER_MODE = os.getenv("CHAT_CONTROLLER_MODE", "expert_owner_on_match")
    CHAT_EMERGENCY_MODE = os.getenv("CHAT_EMERGENCY_MODE", "combined")
    CHAT_FORCE_PAIN_BY_TURN = int(os.getenv("CHAT_FORCE_PAIN_BY_TURN", "2"))
    CHAT_EXPERT_GUARD_MAX_QUESTIONS = int(os.getenv("CHAT_EXPERT_GUARD_MAX_QUESTIONS", "1"))
    CHAT_DECISION_LOG_FLAGS = os.getenv("CHAT_DECISION_LOG_FLAGS", "true").strip().lower() in {"1", "true", "yes", "on"}

    # Usar la clave secreta de Django si está disponible
    JWT_SECRET =  SECRET_KEY
    JWT_SECRET_KEY = SECRET_KEY
    JWT_ALGORITHM =  os.getenv("JWT_ALGORITHM")
    DJANGO_INTEGRATION = os.getenv("DJANGO_INTEGRATION", "False") == "True"

    # Configuraciones de logging
    LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO')
    LOG_FILE = os.getenv('LOG_FILE', 'app.log')
