import jwt
import logging
from config import Config

# Configurar logger
logger = logging.getLogger(__name__)

def get_user_id_token(request):
    auth_header = request.headers.get("Authorization")

    if not auth_header:
        return None
    
    parts = auth_header.split()
    if parts[0].lower() != 'bearer' or len(parts) != 2:
        return None
    
    token = parts[1]

    try:

        secret_key = Config.JWT_SECRET
        algorithm = Config.JWT_ALGORITHM

        payload = jwt.decode(token, secret_key, algorithms=[algorithm])
        user_id = payload.get('user_id') or payload.get('sub')

        return user_id
    except jwt.ExpiredSignatureError:
        logger.warning("Token expirado")
        return None
    except jwt.InvalidTokenError as e:
        logger.warning(f"Token inválido: {str(e)}")
        return None
    except Exception as e:
        logger.error(f"Error al procesar token: {str(e)}")
        return None