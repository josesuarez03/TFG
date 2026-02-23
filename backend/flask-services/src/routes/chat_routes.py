from flask import jsonify, request
import logging
from datetime import datetime
from . import bp
from routes.utils import process_message_logic, conversational_dataset_manager
from services.auth.auth import get_user_id_token
from services.api.send_api import send_data_to_django
from services.process_data.medical_data import MedicalDataProcessor

# Configurar logger
logger = logging.getLogger(__name__)


def _serialize_timestamp(value):
    """Serializa timestamps sin romper si ya vienen como string desde Redis."""
    if value is None:
        return value
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value)

@bp.route('/message', methods=['POST'])
def process_message():

    user_id = get_user_id_token(request)
    data = request.get_json()

    if not user_id:

        user_id = data.get('user_id', 'Anonymous')
        logging.warning(f"No se encontró token de autenticación, usando: {user_id}. Usando ID de usuario genérico.")
    
    user_message = data.get('message', '')
    user_data = data.get('context', {})
    conversation_id = data.get('conversation_id', None)
    auth_header = request.headers.get("Authorization")
    token = auth_header.split(" ", 1)[1] if auth_header and auth_header.lower().startswith("bearer ") else None
    
    result, status_code = process_message_logic(user_id, user_message, user_data, conversation_id, jwt_token=token)
    
    if status_code != 200:
        return jsonify(result), status_code
    
    return jsonify(result), 200

@bp.route('/conversations', methods=['GET'])
def get_user_conversations():
    # Obtener user_id del token JWT
    user_id = get_user_id_token(request)
    
    # Si no hay token válido, intentar obtener de la URL como fallback
    if not user_id:
        user_id = request.args.get('user_id')
    
    if not user_id:
        return jsonify({"error": "Se requiere autenticación válida."}), 401
    
    try:
        conversations = conversational_dataset_manager.get_conversations(user_id)
        # Convertir UUID a string para serialización JSON
        for conv in conversations:
            if '_id' in conv:
                conv['_id'] = str(conv['_id'])
            if 'timestamp' in conv:
                conv['timestamp'] = _serialize_timestamp(conv.get('timestamp'))
        
        return jsonify({"conversations": conversations})
    except Exception as e:
        logger.error(f"Error al obtener conversaciones: {str(e)}")
        return jsonify({"error": f"Error al obtener conversaciones: {str(e)}"}), 500

@bp.route('/conversation/<conversation_id>', methods=['GET'])
def get_conversation(conversation_id):
    # Obtener user_id del token JWT
    user_id = get_user_id_token(request)
    
    # Si no hay token válido, intentar obtener de la URL como fallback
    if not user_id:
        user_id = request.args.get('user_id')
    
    if not user_id:
        return jsonify({"error": "Se requiere autenticación válida."}), 401
    
    try:
        conversation = conversational_dataset_manager.get_conversation(user_id, conversation_id)
        if not conversation:
            return jsonify({"error": "Conversación no encontrada."}), 404
        
        # Convertir UUID a string para serialización JSON
        if '_id' in conversation:
            conversation['_id'] = str(conversation['_id'])
        if 'timestamp' in conversation:
            conversation['timestamp'] = _serialize_timestamp(conversation.get('timestamp'))
        
        return jsonify({"conversation": conversation})
    except Exception as e:
        logger.error(f"Error al obtener conversación: {str(e)}")
        return jsonify({"error": f"Error al obtener conversación: {str(e)}"}), 500

@bp.route('/conversation/<conversation_id>', methods=['DELETE'])
def delete_conversation(conversation_id):
    # Obtener user_id del token JWT
    user_id = get_user_id_token(request)
    
    # Si no hay token válido, intentar obtener de la URL como fallback
    if not user_id:
        user_id = request.args.get('user_id')
    
    if not user_id:
        return jsonify({"error": "Se requiere autenticación válida."}), 401
    
    try:
        deleted = conversational_dataset_manager.delete_conversation(user_id, conversation_id)
        if not deleted:
            return jsonify({"error": "Conversación no encontrada o no pudo ser eliminada."}), 404
        
        return jsonify({"success": True, "message": "Conversación eliminada correctamente."})
    except Exception as e:
        logger.error(f"Error al eliminar conversación: {str(e)}")
        return jsonify({"error": f"Error al eliminar conversación: {str(e)}"}), 500

@bp.route('/sync', methods=['POST'])
def sync_redis_to_mongo():
    # Obtener user_id del token JWT
    user_id = get_user_id_token(request)
    
    # Si no hay token válido, intentar obtener del cuerpo como fallback
    if not user_id:
        data = request.get_json()
        user_id = data.get('user_id')
    
    if not user_id:
        return jsonify({"error": "Se requiere autenticación válida."}), 401
    
    conversation_id = request.get_json().get('conversation_id', None)
    
    try:
        conversational_dataset_manager.sync_from_redis_to_mongo(user_id, conversation_id)
        return jsonify({"success": True, "message": "Sincronización completada."})
    except Exception as e:
        logger.error(f"Error en la sincronización: {str(e)}")
        return jsonify({"error": f"Error en la sincronización: {str(e)}"}), 500
    
@bp.route('/process_medical_data', methods=['POST'])
def process_medical_data():

    user_id = get_user_id_token(request)
    data = request.get_json()

    if not user_id:
        user_id = request.args.get('user_id')
    
    if not user_id:
        return jsonify({"error": "Se requiere autenticación válida."}), 401
    
    conversation_id = data.get('conversation_id')
    django_api_url = data.get('django_api_url')
    
    if not conversation_id:
        return jsonify({"error": "Se requiere ID de conversación"}), 400
    
    try:
        # Process the medical data from conversation
        processor = MedicalDataProcessor(user_id)
        medical_data = processor.process_medical_data(user_id, conversation_id)
        
        if not medical_data or 'error' in medical_data:
            return jsonify(medical_data or {"error": "No se pudo procesar la conversación."}), 400
        
        # Send processed data to Django for storage
        auth_header = request.headers.get("Authorization")
        token = auth_header.split(" ", 1)[1] if auth_header and auth_header.lower().startswith("bearer ") else None
        django_response = send_data_to_django(
            user_id,
            medical_data,
            jwt_token=token,
            base_url=django_api_url,
        )
        
        return jsonify({
            "success": True,
            "message": "Datos médicos procesados correctamente.",
            "medical_data": medical_data,
            "django_response": django_response
        })
    
    except Exception as e:
        logger.error(f"Error al procesar datos médicos: {str(e)}")
        return jsonify({"error": f"Error al procesar datos médicos: {str(e)}"}), 500
