from flask import jsonify, request
import logging
import uuid
from datetime import datetime
from . import bp
from routes.utils import process_message_logic, conversational_dataset_manager
from services.auth.auth import get_user_id_token
from services.process_data.etl_runner import execute_etl_once

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
        auth_header = request.headers.get("Authorization")
        token = auth_header.split(" ", 1)[1] if auth_header and auth_header.lower().startswith("bearer ") else None
        run_id = str(uuid.uuid4())
        reasons = ["manual_endpoint"]
        queued_time = datetime.utcnow().isoformat()
        conversational_dataset_manager.update_conversation_etl_state(
            user_id,
            conversation_id,
            {
                "last_status": "queued",
                "attempts": 0,
                "last_run_id": run_id,
                "last_reasons": reasons,
                "last_error": "",
                "last_attempt_at": queued_time,
            },
        )
        conversational_dataset_manager.update_conversation_etl_state(
            user_id,
            conversation_id,
            {
                "last_status": "running",
                "attempts": 1,
                "last_run_id": run_id,
                "last_reasons": reasons,
                "last_error": "",
                "last_attempt_at": datetime.utcnow().isoformat(),
            },
        )

        etl_result = execute_etl_once(
            user_id=user_id,
            conversation_id=conversation_id,
            jwt_token=token,
            django_api_url=django_api_url,
        )
        success = bool(etl_result.get("success"))
        medical_data = etl_result.get("medical_data")
        django_response = etl_result.get("django_response")

        if not medical_data or (isinstance(medical_data, dict) and medical_data.get("error")):
            conversational_dataset_manager.update_conversation_etl_state(
                user_id,
                conversation_id,
                {
                    "last_status": "failed",
                    "attempts": 1,
                    "last_run_id": run_id,
                    "last_reasons": reasons,
                    "last_error": (medical_data or {}).get("error", "No se pudo procesar la conversación."),
                    "last_attempt_at": datetime.utcnow().isoformat(),
                },
            )
            return jsonify(medical_data or {"error": "No se pudo procesar la conversación."}), 400

        if success:
            success_time = datetime.utcnow().isoformat()
            conversational_dataset_manager.update_conversation_etl_state(
                user_id,
                conversation_id,
                {
                    "last_status": "success",
                    "attempts": 1,
                    "last_run_id": run_id,
                    "last_reasons": reasons,
                    "last_error": "",
                    "last_attempt_at": success_time,
                    "last_success_at": success_time,
                },
            )
        else:
            conversational_dataset_manager.update_conversation_etl_state(
                user_id,
                conversation_id,
                {
                    "last_status": "failed",
                    "attempts": 1,
                    "last_run_id": run_id,
                    "last_reasons": reasons,
                    "last_error": str(etl_result.get("error") or "Error desconocido al enviar a backend principal."),
                    "last_attempt_at": datetime.utcnow().isoformat(),
                },
            )

        return jsonify({
            "success": success,
            "message": "Datos médicos procesados correctamente." if success else "Datos médicos procesados con error de envío.",
            "medical_data": medical_data,
            "django_response": django_response
        })
    
    except Exception as e:
        logger.error(f"Error al procesar datos médicos: {str(e)}")
        return jsonify({"error": f"Error al procesar datos médicos: {str(e)}"}), 500
