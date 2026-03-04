import logging
import uuid
from flask import request
from flask_socketio import emit, join_room, leave_room
from . import socketio
from .ws_utils import resolve_ws_leave_user_id, resolve_ws_user_id
from services.chatbot.application.chat_turn_service import process_message_logic
from services.chatbot.application.conversation_service import conversation_service
from services.auth.auth import get_user_id_from_token
from services.process_data.etl_runner import clear_inactivity_timer, enqueue_etl_run

# Configurar logger
logger = logging.getLogger(__name__)
AUTHENTICATED_USERS_BY_SID = {}
ACTIVE_CONVERSATION_BY_SID = {}

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
            AUTHENTICATED_USERS_BY_SID[sid] = user_id
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
def handle_disconnect(reason=None):
    sid = request.sid
    user_id = AUTHENTICATED_USERS_BY_SID.get(sid)
    conversation_id = ACTIVE_CONVERSATION_BY_SID.pop(sid, None)
    if user_id and conversation_id:
        run_id = str(uuid.uuid4())
        try:
            clear_inactivity_timer(user_id, conversation_id)
            enqueue_etl_run(
                user_id=user_id,
                conversation_id=conversation_id,
                jwt_token=None,
                reasons=["websocket_disconnect"],
                run_id=run_id,
            )
            logger.info(
                "ETL encolada por disconnect sid=%s user=%s conversation=%s run_id=%s",
                sid,
                user_id,
                conversation_id,
                run_id,
            )
        except Exception as e:
            logger.warning(
                "No se pudo encolar ETL por disconnect sid=%s user=%s conversation=%s: %s",
                sid,
                user_id,
                conversation_id,
                str(e),
            )
    AUTHENTICATED_USERS_BY_SID.pop(sid, None)
    logger.info(f"Cliente desconectado: {sid}. Razón: {reason}")


@socketio.on('chat_message')
def handle_chat_message(data):
    """Procesar un mensaje de chat recibido vía WebSocket"""
    sid = request.sid
    if not isinstance(data, dict):
        logger.warning(f"Tipo de datos inválido para chat_message de {sid}. Esperado: dict, Recibido: {type(data)}")
        emit('error', {"error": "Formato de mensaje inválido."}, room=sid)
        return

    try:
        token_from_payload = data.get('token')
        user_id, auth_source = resolve_ws_user_id(
            data=data,
            sid=sid,
            authenticated_users_by_sid=AUTHENTICATED_USERS_BY_SID,
            allow_anonymous=True,
        )
        if auth_source == "token_payload":
            logger.debug(f"WebSocket (SID {sid}): user_id obtenido desde token en payload.")
        elif auth_source == "socket_connect_auth":
            logger.info(f"WebSocket (SID {sid}): Usando user_id autenticado en conexión: '{user_id}'.")
        elif auth_source == "payload_user_id_fallback":
            logger.info(f"WebSocket (SID {sid}): Token ausente/invalidado en payload. Usando user_id '{user_id}' proporcionado en el mensaje.")
        elif auth_source == "anonymous_sid_fallback":
            logger.warning(f"WebSocket (SID {sid}): Ni token válido ni user_id en payload. Usando user_id temporal '{user_id}'.")
        
        logger.info(f"Usuario {user_id} identificado para chat_message de SID {sid} (source={auth_source}).")
        
        user_message = data.get('message', '')
        if not user_message.strip():
            emit('error', {"error": "El mensaje no puede estar vacío."}, room=sid)
            return

        user_data = data.get('context', {})
        conversation_id_decrypted = data.get('conversation_id')
        
        emit('typing', {'status': 'bot is typing'}, room=sid)
        
        result, status_code = process_message_logic(
            user_id,
            user_message,
            user_data,
            conversation_id_decrypted,
            jwt_token=token_from_payload,
        )
        
        if status_code != 200:
            emit('error', result, room=sid)
        else:
            result_conversation_id = result.get("conversation_id")
            if result_conversation_id:
                ACTIVE_CONVERSATION_BY_SID[sid] = result_conversation_id
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
        join_room(conversation_id_encrypted)
        ACTIVE_CONVERSATION_BY_SID[sid] = conversation_id_encrypted
        emit('room_joined', {'room': conversation_id_encrypted, 'status': 'joined'}, room=sid)
        logger.info(f"Cliente {sid} se unió a la conversación {conversation_id_encrypted}")
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
        token_from_payload = data.get("token")
        user_id = resolve_ws_leave_user_id(data, sid, AUTHENTICATED_USERS_BY_SID)

        leave_room(conversation_id_encrypted)
        ACTIVE_CONVERSATION_BY_SID.pop(sid, None)
        etl_enqueued = False
        etl_run_id = ""
        if user_id:
            etl_run_id = str(uuid.uuid4())
            try:
                clear_inactivity_timer(user_id, conversation_id_encrypted)
                enqueue_etl_run(
                    user_id=user_id,
                    conversation_id=conversation_id_encrypted,
                    jwt_token=token_from_payload,
                    reasons=["websocket_room_closed"],
                    run_id=etl_run_id,
                )
                etl_enqueued = True
            except Exception as e:
                logger.warning(
                    "No se pudo encolar ETL por cierre de room sid=%s user=%s conversation=%s: %s",
                    sid,
                    user_id,
                    conversation_id_encrypted,
                    str(e),
                )

        emit(
            'room_left',
            {
                'room': conversation_id_encrypted,
                'status': 'left',
                'etl_queued': etl_enqueued,
                'etl_run_id': etl_run_id,
            },
            room=sid,
        )
        logger.info(f"Cliente {sid} abandonó la conversación {conversation_id_encrypted}")
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
        user_id, auth_source = resolve_ws_user_id(
            data=data,
            sid=sid,
            authenticated_users_by_sid=AUTHENTICATED_USERS_BY_SID,
            allow_anonymous=False,
        )
        if auth_source == "token_payload":
            logger.debug(f"WebSocket (SID {sid}): user_id obtenido desde token en payload de sync.")
        elif auth_source == "socket_connect_auth":
            logger.info(f"WebSocket (SID {sid}): Usando user_id autenticado en conexión para sync: '{user_id}'.")
        elif auth_source == "payload_user_id_fallback":
            logger.info(f"WebSocket (SID {sid}): Token ausente/invalidado en sync payload. Usando user_id '{user_id}' proporcionado en el mensaje.")

        if not user_id: # Aún sin user_id después de los intentos
            logger.warning(f"Autenticación requerida para sync_request fallida para SID {sid}. Ni token válido ni user_id proporcionado.")
            emit('sync_error', {"error": "Se requiere autenticación válida."}, room=sid)
            return
        else:
            logger.info(f"Usuario {user_id} identificado para sync_request de SID {sid}.")
            
        conversation_id_decrypted = data.get('conversation_id')
        
        # Asumo que sync_from_redis_to_mongo puede manejar conversation_id_decrypted siendo None (para todas las conversaciones del usuario)
        conversation_service.sync_to_mongo(user_id, conversation_id_decrypted)
        emit('sync_complete', {"success": True, "message": "Sincronización completada."}, room=sid)
    except Exception as e:
        logger.error(f"Error en sincronización WebSocket para SID {sid}: {str(e)}", exc_info=True)
        emit('sync_error', {"error": "Error en la sincronización."}, room=sid)

