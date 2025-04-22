import requests
import logging
import json
import os
from services.security.encryption import Encryption
from config.config import Config

logger = logging.getLogger(__name__)

def send_to_django_api(endpoint, data):

    # URL de la API de Django
    django_api_url = os.getenv('DJANGO_API_URL')

    # Construir la URL completa
    url = f"{django_api_url}{endpoint}/"

    try:

        # Configurar los headers, incluyendo el token de autenticación
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f"Bearer {os.getenv('DJANGO_API_TOKEN', '')}"
        }

        sensitive_fields = ['medical_context', 'allergies', 'medications', 'medical_history']
        medical_data = data.get('medical_data', {})
        
        for field in sensitive_fields:
            if field in medical_data and medical_data[field]:
                medical_data[field] = Encryption.encrypt_string(medical_data[field])
        
        # Send POST request to Django API
        response = requests.post(
            url,
            headers=headers,
            data=json.dumps(data),
            timeout=10  # Set timeout to 10 seconds
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