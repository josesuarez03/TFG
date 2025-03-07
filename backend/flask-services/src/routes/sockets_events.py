import logging
import uuid
from flask import request
from flask_socketio import emit, join_room, leave_room
from . import socketio
from routes.utils import process_message_logic, conversational_dataset_manager
from services.security.encryption import Encryption
from services.auth.auth import get_user_id_token

# Configurar logger
logger = logging.getLogger(__name__)


@socketio.on('connect')
def handle_connect():
    """Manejar la conexión de un cliente WebSocket"""
    logger.info(f"Cliente conectado: {request.sid}")
    
    # Se puede autenticar al usuario aquí si es necesario
    token = request.args.get('token')
    if token:
        try:
            user_id = get_user_id_token({'headers': {'Authorization': f'Bearer {token}'}})
            if user_id:
                # Asociar el ID de sesión WebSocket con el ID de usuario
                join_room(user_id)
                emit('connection_success', {'status': 'connected', 'user_id': user_id})
            else:
                emit('connection_error', {'error': 'Token de autenticación inválido'})
        except Exception as e:
            logger.error(f"Error de autenticación WebSocket: {str(e)}")
            emit('connection_error', {'error': 'Error de autenticación'})
    else:
        # Permitir conexión sin autenticación si tu política lo admite
        session_id = str(uuid.uuid4())
        join_room(session_id)
        emit('connection_success', {'status': 'connected', 'session_id': session_id})

@socketio.on('disconnect')
def handle_disconnect():
    """Manejar la desconexión de un cliente WebSocket"""
    logger.info(f"Cliente desconectado: {request.sid}")

@socketio.on('chat_message')
def handle_chat_message(data):
    """Procesar un mensaje de chat recibido vía WebSocket"""
    try:
        # Intentar obtener user_id del token o usar el proporcionado en el mensaje
        user_id = None
        token = data.get('token')
        if token:
            user_id = get_user_id_token({'headers': {'Authorization': f'Bearer {token}'}})
        
        if not user_id:
            user_id = data.get('user_id', 'Anonymous')
            logger.warning(f"WebSocket: No se encontró token válido, usando user_id: {user_id}")
        
        user_message = data.get('message', '')
        user_data = data.get('context', {})
        conversation_id = data.get('conversation_id', None)
        
        try:
            if conversation_id:
                conversation_id = Encryption.decrypt_string(conversation_id)
        except ValueError as e:
            emit('error', {"error": str(e)})
            return

        # Opcional: Emitir evento de "escribiendo" para mejorar UX
        emit('typing', {'status': 'bot is typing'}, room=request.sid)
        
        result, status_code = process_message_logic(user_id, user_message, user_data, conversation_id)
        
        if status_code != 200:
            emit('error', result, room=request.sid)
        else:
            emit('chat_response', result, room=request.sid)
                      
    except Exception as e:
        logger.error(f"Error en WebSocket chat_message: {str(e)}")
        emit('error', {"error": f"Error interno del servidor: {str(e)}"}, room=request.sid)

@socketio.on('join_conversation')
def on_join_conversation(data):
    """Permitir que un cliente se una a una sala específica para una conversación"""
    conversation_id = data.get('conversation_id')
    if conversation_id:
        try:
            if conversation_id:
                conversation_id = Encryption.decrypt_string(conversation_id)
        except ValueError as e:
            emit('error', {"error": str(e)})
            return
                
        join_room(conversation_id)
        emit('room_joined', {'room': conversation_id, 'status': 'joined'})
        logger.info(f"Cliente {request.sid} se unió a la conversación {conversation_id}")

@socketio.on('leave_conversation')
def on_leave_conversation(data):
    """Permitir que un cliente abandone una sala específica"""
    conversation_id = data.get('conversation_id')
    if conversation_id:
        try:
            if conversation_id:
                conversation_id = Encryption.decrypt_string(conversation_id)
        except ValueError:
            return
                
        leave_room(conversation_id)
        emit('room_left', {'room': conversation_id, 'status': 'left'})
        logger.info(f"Cliente {request.sid} abandonó la conversación {conversation_id}")

@socketio.on('sync_request')
def handle_sync_request(data):
    """Manejar solicitud de sincronización vía WebSocket"""
    try:
        token = data.get('token')
        user_id = None
        if token:
            user_id = get_user_id_token({'headers': {'Authorization': f'Bearer {token}'}})
        
        if not user_id:
            user_id = data.get('user_id')
        
        if not user_id:
            emit('sync_error', {"error": "Se requiere autenticación válida."})
            return
            
        conversation_id = data.get('conversation_id')
        try:
            if conversation_id:
                conversation_id = Encryption.decrypt_string(conversation_id)
        except ValueError as e:
            emit('sync_error', {"error": str(e)})
            return
        
        conversational_dataset_manager.sync_from_redis_to_mongo(user_id, conversation_id)
        emit('sync_complete', {"success": True, "message": "Sincronización completada."})
    except Exception as e:
        logger.error(f"Error en sincronización WebSocket: {str(e)}")
        emit('sync_error', {"error": f"Error en la sincronización: {str(e)}"})