import logging
import uuid
from flask import request
from flask_socketio import emit, join_room, leave_room
from . import socketio
from routes.utils import process_message_logic, conversational_dataset_manager
from services.security.encryption import Encryption
from services.auth.auth import get_user_id_from_token 

# Configurar logger
logger = logging.getLogger(__name__)

encryption_instance = Encryption()

@socketio.on('connect')
def handle_connect():
    """Manejar la conexión de un cliente WebSocket"""
    sid = request.sid
    logger.info(f"Cliente conectado: {sid}")
    
    token_from_query = request.args.get('token')
    user_id = None

    if token_from_query:
        logger.debug(f"Intentando autenticación para SID {sid} con token de query param.")
        user_id = get_user_id_from_token(token_from_query)
        if user_id:
            join_room(user_id) # Unir al usuario a una sala con su user_id
            emit('connection_success', {'status': 'connected', 'user_id': user_id})
            logger.info(f"Cliente {sid} autenticado como user_id {user_id} y unido a su room.")
        else:
            logger.warning(f"Token inválido proporcionado en query para SID {sid}.")
            emit('connection_error', {'error': 'Token de autenticación inválido'})
            # Considera desconectar si la autenticación es obligatoria:
            # return False 
    else:
        # Política actual: permitir conexión sin token (anónima o con ID de sesión temporal)
        # Si la autenticación es obligatoria, aquí deberías emitir error y desconectar.
        session_id = str(uuid.uuid4()) # Fallback para usuarios no autenticados
        join_room(session_id)
        emit('connection_success', {'status': 'connected_anonymously', 'session_id': session_id})
        logger.info(f"Cliente {sid} conectado anónimamente. Room/Session ID: {session_id}")


@socketio.on('disconnect')
def handle_disconnect():
    sid = request.sid
    # 'reason' puede no estar siempre disponible o ser fiable, depende del cliente y desconexión.
    # Flask-SocketIO no lo pasa directamente como argumento a la función de disconnect.
    logger.info(f"Cliente desconectado: {sid}")


@socketio.on('chat_message')
def handle_chat_message(data):
    """Procesar un mensaje de chat recibido vía WebSocket"""
    sid = request.sid
    if not isinstance(data, dict):
        logger.warning(f"Tipo de datos inválido para chat_message de {sid}. Esperado: dict, Recibido: {type(data)}")
        emit('error', {"error": "Formato de mensaje inválido."}, room=sid)
        return

    try:
        user_id = None
        token_from_payload = data.get('token')

        if token_from_payload:
            logger.debug(f"Intentando obtener user_id del token en payload de chat_message para SID {sid}.")
            user_id = get_user_id_from_token(token_from_payload)

        if not user_id:
            user_id_from_data = data.get('user_id')
            if user_id_from_data:
                user_id = user_id_from_data
                logger.warning(f"WebSocket (SID {sid}): No se encontró token válido o token inválido. Usando user_id '{user_id}' proporcionado en el mensaje.")
            else:
                # Considera si se debe permitir mensajes sin user_id o token
                user_id = f"anonymous_{sid}" 
                logger.warning(f"WebSocket (SID {sid}): Ni token válido ni user_id en payload. Usando user_id temporal '{user_id}'.")
        else:
            logger.info(f"Usuario {user_id} identificado desde token para chat_message de SID {sid}.")
        
        user_message = data.get('message', '')
        if not user_message.strip():
            emit('error', {"error": "El mensaje no puede estar vacío."}, room=sid)
            return

        user_data = data.get('context', {})
        conversation_id_encrypted = data.get('conversation_id')
        conversation_id_decrypted = None

        if conversation_id_encrypted:
            try:
                conversation_id_decrypted = encryption_instance.decrypt_string(conversation_id_encrypted)
            except ValueError as e:
                logger.error(f"Error desencriptando conversation_id '{conversation_id_encrypted}' para SID {sid}: {str(e)}")
                emit('error', {"error": f"Formato de conversation_id inválido: {str(e)}"}, room=sid)
                return
        
        emit('typing', {'status': 'bot is typing'}, room=sid)
        
        result, status_code = process_message_logic(user_id, user_message, user_data, conversation_id_decrypted)
        
        if status_code != 200:
            emit('error', result, room=sid)
        else:
            emit('chat_response', result, room=sid)
                      
    except Exception as e:
        logger.error(f"Error en WebSocket chat_message para SID {sid}: {str(e)}", exc_info=True)
        emit('error', {"error": "Error interno del servidor."}, room=sid)


@socketio.on('join_conversation')
def on_join_conversation(data):
    sid = request.sid
    if not isinstance(data, dict):
        logger.warning(f"Tipo de datos inválido para join_conversation de {sid}. Esperado: dict, Recibido: {type(data)}")
        emit('error', {"error": "Formato de mensaje inválido."}, room=sid)
        return

    conversation_id_encrypted = data.get('conversation_id')
    if conversation_id_encrypted:
        try:
            conversation_id_decrypted = encryption_instance.decrypt_string(conversation_id_encrypted)
            join_room(conversation_id_decrypted)
            emit('room_joined', {'room': conversation_id_decrypted, 'status': 'joined'}, room=sid)
            logger.info(f"Cliente {sid} se unió a la conversación {conversation_id_decrypted}")
        except ValueError as e:
            logger.error(f"Error desencriptando conversation_id para join '{conversation_id_encrypted}' para SID {sid}: {str(e)}")
            emit('error', {"error": f"Formato de conversation_id inválido para join: {str(e)}"}, room=sid)
    else:
        logger.warning(f"No se proporcionó conversation_id para join_conversation por SID {sid}")
        emit('error', {"error": "conversation_id es requerido."}, room=sid)


@socketio.on('leave_conversation')
def on_leave_conversation(data):
    sid = request.sid
    if not isinstance(data, dict):
        logger.warning(f"Tipo de datos inválido para leave_conversation de {sid}. Esperado: dict, Recibido: {type(data)}")
        emit('error', {"error": "Formato de mensaje inválido."}, room=sid)
        return

    conversation_id_encrypted = data.get('conversation_id')
    if conversation_id_encrypted:
        try:
            conversation_id_decrypted = encryption_instance.decrypt_string(conversation_id_encrypted)
            leave_room(conversation_id_decrypted)
            emit('room_left', {'room': conversation_id_decrypted, 'status': 'left'}, room=sid)
            logger.info(f"Cliente {sid} abandonó la conversación {conversation_id_decrypted}")
        except ValueError as e:
            logger.error(f"Error desencriptando conversation_id para leave '{conversation_id_encrypted}' para SID {sid}: {str(e)}")
            emit('error', {"error": f"Formato de conversation_id inválido para leave: {str(e)}"}, room=sid)
    else:
        logger.warning(f"No se proporcionó conversation_id para leave_conversation por SID {sid}")
        emit('error', {"error": "conversation_id es requerido."}, room=sid)


@socketio.on('sync_request')
def handle_sync_request(data):
    """Manejar solicitud de sincronización vía WebSocket"""
    sid = request.sid
    if not isinstance(data, dict):
        logger.warning(f"Tipo de datos inválido para sync_request de {sid}. Esperado: dict, Recibido: {type(data)}")
        emit('sync_error', {"error": "Formato de mensaje inválido."}, room=sid)
        return

    try:
        user_id = None
        token_from_payload = data.get('token')

        if token_from_payload:
            logger.debug(f"Intentando obtener user_id del token en payload de sync_request para SID {sid}.")
            user_id = get_user_id_from_token(token_from_payload)
        
        if not user_id:
            user_id_from_data = data.get('user_id')
            if user_id_from_data:
                user_id = user_id_from_data
                logger.warning(f"WebSocket (SID {sid}): No se encontró token válido o token inválido para sync. Usando user_id '{user_id}' proporcionado en el mensaje.")
        
        if not user_id: # Aún sin user_id después de los intentos
            logger.warning(f"Autenticación requerida para sync_request fallida para SID {sid}. Ni token válido ni user_id proporcionado.")
            emit('sync_error', {"error": "Se requiere autenticación válida."}, room=sid)
            return
        else:
            logger.info(f"Usuario {user_id} identificado para sync_request de SID {sid}.")
            
        conversation_id_encrypted = data.get('conversation_id')
        conversation_id_decrypted = None 

        if conversation_id_encrypted:
            try:
                conversation_id_decrypted = encryption_instance.decrypt_string(conversation_id_encrypted)
            except ValueError as e:
                logger.error(f"Error desencriptando conversation_id para sync '{conversation_id_encrypted}' para SID {sid}: {str(e)}")
                emit('sync_error', {"error": f"Formato de conversation_id inválido para sync: {str(e)}"}, room=sid)
                return
        
        # Asumo que sync_from_redis_to_mongo puede manejar conversation_id_decrypted siendo None (para todas las conversaciones del usuario)
        conversational_dataset_manager.sync_from_redis_to_mongo(user_id, conversation_id_decrypted)
        emit('sync_complete', {"success": True, "message": "Sincronización completada."}, room=sid)
    except Exception as e:
        logger.error(f"Error en sincronización WebSocket para SID {sid}: {str(e)}", exc_info=True)
        emit('sync_error', {"error": "Error en la sincronización."}, room=sid)