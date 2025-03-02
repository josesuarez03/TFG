from flask import jsonify, request
import logging
from . import bp
from .utils import process_message_logic, conversational_dataset_manager
from services.auth.auth import get_user_id_token
from ....django_services.common.security.encryption import Encryption

# Configurar logger
logger = logging.getLogger(__name__)

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
    
    try:

        if conversation_id:
            conversation_id = Encryption.decrypt_string(conversation_id)

    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    result, status_code = process_message_logic(user_id, user_message, user_data, conversation_id)
    
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
                conv['timestamp'] = conv['timestamp'].isoformat()
        
        return jsonify({"conversations": conversations})
    except Exception as e:
        logger.error(f"Error al obtener conversaciones: {str(e)}")
        return jsonify({"error": f"Error al obtener conversaciones: {str(e)}"}), 500

@bp.route('/conversation/<encrypted_conversation_id>', methods=['GET'])
def get_conversation(encrypted_conversation_id):
    # Obtener user_id del token JWT
    user_id = get_user_id_token(request)
    
    # Si no hay token válido, intentar obtener de la URL como fallback
    if not user_id:
        user_id = request.args.get('user_id')
    
    if not user_id:
        return jsonify({"error": "Se requiere autenticación válida."}), 401
    
    try:
        conversation_id = Encryption.decrypt_string(encrypted_conversation_id)
        conversation = conversational_dataset_manager.get_conversation(user_id, conversation_id)
        if not conversation:
            return jsonify({"error": "Conversación no encontrada."}), 404
        
        # Convertir UUID a string para serialización JSON
        if '_id' in conversation:
            conversation['_id'] = str(conversation['_id'])
        if 'timestamp' in conversation:
            conversation['timestamp'] = conversation['timestamp'].isoformat()
        
        return jsonify({"conversation": conversation})
    except Exception as e:
        logger.error(f"Error al obtener conversación: {str(e)}")
        return jsonify({"error": f"Error al obtener conversación: {str(e)}"}), 500

@bp.route('/conversation/<encrypted_conversation_id>', methods=['DELETE'])
def delete_conversation(encrypted_conversation_id):
    # Obtener user_id del token JWT
    user_id = get_user_id_token(request)
    
    # Si no hay token válido, intentar obtener de la URL como fallback
    if not user_id:
        user_id = request.args.get('user_id')
    
    if not user_id:
        return jsonify({"error": "Se requiere autenticación válida."}), 401
    
    try:
        conversation_id = Encryption.decrypt_string(encrypted_conversation_id)
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