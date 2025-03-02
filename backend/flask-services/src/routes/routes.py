from flask import Blueprint, jsonify, request
from config import Config
from services.comprehend_medical import detect_entities
from datetime import datetime, timedelta
from models.conversation import ConversationalDatasetManager, RedisCacheManager
from services.chatbot import Chatbot
import jwt
import logging
from ....django_services.common.security.encryption import Encryption

# Configurar logger
logger = logging.getLogger(__name__)

bp = Blueprint('chat', __name__, url_prefix='/chat')
conversational_dataset_manager = ConversationalDatasetManager()

INITIAL_PROMPT = """Eres un asistente medico virtual. Tu tarea es realizar un triaje inicial a los pacientes para ayudarlos a identificar sus sintomas,
                tienes que proporcionar información general sobre las codiciones medicas proporcionadas por el usuario y ofrecer una orientación inicial para buscar
                atencion medica. Tienes que proporcionar informacion detallada y precisas sobre el sintomas y condiciones medicas. Y dar un diagnostico presuntivo.
                No puedes medicar ni diagnosticar enfermedades ni condiciones del usuario. Tu deber es orientar y recopilar informacion sobre el usuario.
                Si no puedes responder a una pregunta, debes decirle al usuario que consulte a un medico.
                Si el usuario no proporciona suficiente información, debes pedirle más detalles.
                Si el usuario proporciona información incorrecta, debes corregirlo.
                Si el usuario proporciona información correcta, debes confirmarla.
                """

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

    if not user_message.strip():
        return jsonify({"error": "El mensaje no puede estar vacío."}), 400

    # Crear instancia del chatbot con la entrada del usuario y su contexto
    chatbot = Chatbot(user_message, user_data, initial_prompt=INITIAL_PROMPT)
    response_data = chatbot.initialize_conversation()

    if "error" in response_data:
        return jsonify(response_data), 400

    messages = [
        {"role": "user", "content": user_message},
        {"role": "assistant", "content": response_data["response"]}
    ]

    symptoms = response_data.get("symptoms", [])
    symptoms_pattern = response_data.get("symptoms_pattern", "")
    pain_scale = response_data.get("pain_scale", 0)
    triaje_level = response_data.get("triaje_level", "")
    medical_context = {"analysis": response_data["entities"]}

    # Si es continuación de una conversación existente
    if conversation_id:
        # Obtener conversación actual
        current_conversation = conversational_dataset_manager.get_conversation(user_id, conversation_id)
        if current_conversation:
            # Actualizar mensajes existentes
            all_messages = current_conversation.get("messages", [])
            all_messages.extend(messages)
            
            # Actualizar conversación
            conversational_dataset_manager.update_conversation(
                user_id, 
                conversation_id, 
                messages=all_messages,
                symptoms=symptoms,
                symptoms_pattern=symptoms_pattern,
                pain_scale=pain_scale,
                triaje_level=triaje_level
            )
        else:
            # Si no existe la conversación, crear una nueva
            conversation_id = conversational_dataset_manager.add_conversation(
                user_id, 
                medical_context, 
                messages, 
                symptoms, 
                symptoms_pattern, 
                pain_scale, 
                triaje_level
            )
    else:
        # Crear nueva conversación
        conversation_id = conversational_dataset_manager.add_conversation(
            user_id, 
            medical_context, 
            messages,
            symptoms,
            symptoms_pattern,
            pain_scale, 
            triaje_level
        )

    encrypted_conversation_id = Encryption.encrypt_string(conversation_id)

    return jsonify({
        "user_message": user_message,
        "ai_response": response_data["response"],
        "analysis": response_data["entities"],
        "context": response_data["context"],
        "symptoms": symptoms,
        "symptoms_pattern": symptoms_pattern,
        "pain_scale": pain_scale,
        "triaje_level": triaje_level,
        "conversation_id": encrypted_conversation_id
    })

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