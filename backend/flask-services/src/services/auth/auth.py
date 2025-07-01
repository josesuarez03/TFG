import jwt
import logging
from config.config import Config

# Configurar logger
logger = logging.getLogger(__name__)

def get_user_id_from_token(token: str) -> str | None:
    """
    Decodifica un token JWT para extraer el ID de usuario.
    Devuelve user_id si el token es válido, None en caso contrario.
    """
    if not token:
        logger.debug("get_user_id_from_token: Token está vacío o es None.")
        return None

    if not isinstance(token, str):
        logger.warning(f"get_user_id_from_token: Tipo de token inválido recibido: {type(token)}. Se esperaba un string.")
        return None

    try:
        # IMPORTANTE: Usar la misma SECRET_KEY que Django
        secret_key = Config.JWT_SECRET
        algorithm = Config.JWT_ALGORITHM or 'HS256'

        if not secret_key:
            logger.error("get_user_id_from_token: Ni SECRET_KEY ni JWT_SECRET están configurados.")
            return None
        
        logger.debug(f"get_user_id_from_token: Usando algoritmo {algorithm}")
        logger.debug(f"get_user_id_from_token: SECRET_KEY configurada: {'Sí' if secret_key else 'No'}")
        
        # Decodificar el token
        payload = jwt.decode(token, secret_key, algorithms=[algorithm])
        logger.debug(f"get_user_id_from_token: Payload decodificado: {payload}")
        
        # Django REST Framework JWT puede usar diferentes campos
        user_id = (payload.get('user_id') or 
                  payload.get('sub') or 
                  payload.get('id') or
                  str(payload.get('user_pk', '')))  # Django REST Framework suele usar user_pk

        if not user_id:
            logger.warning("get_user_id_from_token: No se encontró user_id en el payload del token.")
            logger.debug(f"get_user_id_from_token: Campos disponibles en payload: {list(payload.keys())}")
            return None
        
        return str(user_id)  # Convertir a string por consistencia

    except jwt.ExpiredSignatureError:
        logger.warning("get_user_id_from_token: Token expirado.")
        return None
    except jwt.InvalidSignatureError:
        logger.warning("get_user_id_from_token: Firma del token inválida. Verifique que SECRET_KEY coincida con Django.")
        return None
    except jwt.DecodeError:
        logger.warning("get_user_id_from_token: Token malformado o corrupto.")
        return None
    except jwt.InvalidTokenError as e:
        logger.warning(f"get_user_id_from_token: Token inválido: {str(e)}")
        return None
    except Exception as e:
        logger.error(f"get_user_id_from_token: Error inesperado al procesar token: {str(e)}", exc_info=True)
        return None


def get_user_id_token(request) -> str | None:
    """
    Extrae user_id del token JWT en la cabecera Authorization.
    """
    auth_header = request.headers.get("Authorization")

    if not auth_header:
        logger.debug("get_user_id_token: Cabecera Authorization ausente.")
        return None

    parts = auth_header.split()
    if len(parts) != 2 or parts[0].lower() != 'bearer':
        logger.warning(f"get_user_id_token: Formato de cabecera Authorization inválido: {auth_header}")
        return None

    token = parts[1]
    return get_user_id_from_token(token)
