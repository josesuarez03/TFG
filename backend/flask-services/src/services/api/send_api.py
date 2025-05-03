import requests
import logging
import json
import os
from services.security.encryption import Encryption
from config.config import Config

logger = logging.getLogger(__name__)

def send_data_to_django(user_id, medical_data):

    # URL de la API de Django
    django_api_url = os.getenv('DJANGO_API_URL')

    endpoint = "api/patients/medical_data_update"
    
    # URL de la API de Django
    django_api_url = os.getenv('DJANGO_API_URL')
    
    # Token JWT para autenticación
    jwt_token = Config.JWT_SECRET_KEY
    
    # Construir la URL completa
    url = f"{django_api_url}/{endpoint}"
    
    try:
        # Configurar los headers con JWT para autenticación
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {jwt_token}'
        }
        
        # Preparar los datos para enviar
        payload = {
            'user_id': user_id,
            'medical_data': medical_data,
            'source': 'chatbot'
        }
        
        # Enviar petición POST a la API de Django
        response = requests.post(
            url,
            headers=headers,
            json=payload,
            timeout=10  # Timeout de 10 segundos
        )
        # Check if request was successful
        if response.status_code in [200, 201]:
            logger.info(f"Datos enviados correctamente a Django API: {endpoint}")
            return response.json()
        else:
            logger.error(f"Error al enviar datos a Django API: {response.status_code} - {response.text}")
            return {
                "error": f"Error de la API de Django: {response.status_code}",
                "details": response.text
            }
    
    except requests.exceptions.RequestException as e:
        logger.error(f"Error de conexión con Django API: {str(e)}")
        return {"error": f"Error de conexión con la API de Django: {str(e)}"}
    
    except Exception as e:
        logger.error(f"Error inesperado al enviar datos a Django API: {str(e)}")
        return {"error": f"Error inesperado: {str(e)}"}