import logging
from services.chatbot.chatbot import Chatbot
from models.conversation import ConversationalDatasetManager
from services.security.encryption import Encryption

# Configurar logger
logger = logging.getLogger(__name__)

# Singleton para el manejador de conversaciones
conversational_dataset_manager = ConversationalDatasetManager()

# Prompt inicial compartido
INITIAL_PROMPT = """Eres un asistente medico virtual. Tu tarea es realizar un triaje inicial a los pacientes para ayudarlos a identificar sus sintomas,
                tienes que proporcionar información general sobre las codiciones medicas proporcionadas por el usuario y ofrecer una orientación inicial para buscar
                atencion medica. Tienes que proporcionar informacion detallada y precisas sobre el sintomas y condiciones medicas. Y dar un diagnostico presuntivo.
                No puedes medicar ni diagnosticar enfermedades ni condiciones del usuario. Tu deber es orientar y recopilar informacion sobre el usuario.
                Si no puedes responder a una pregunta, debes decirle al usuario que consulte a un medico.
                Si el usuario no proporciona suficiente información, debes pedirle más detalles.
                Si el usuario proporciona información incorrecta, debes corregirlo.
                Si el usuario proporciona información correcta, debes confirmarla.
                """

def process_message_logic(user_id, user_message, user_data, conversation_id):
    
    if not user_message.strip():
        return {"error": "El mensaje no puede estar vacío."}, 400

    # Crear instancia del chatbot con la entrada del usuario y su contexto
    chatbot = Chatbot(user_message, user_data, initial_prompt=INITIAL_PROMPT)
    response_data = chatbot.initialize_conversation()

    if "error" in response_data:
        return response_data, 400

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

    return {
        "user_message": user_message,
        "ai_response": response_data["response"],
        "analysis": response_data["entities"],
        "context": response_data["context"],
        "symptoms": symptoms,
        "symptoms_pattern": symptoms_pattern,
        "pain_scale": pain_scale,
        "triaje_level": triaje_level,
        "conversation_id": encrypted_conversation_id
    }, 200
