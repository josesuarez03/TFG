import logging
from services.chatbot.chatbot import Chatbot
from models.conversation import ConversationalDatasetManager
from services.security.encryption import Encryption

# Configurar logger
logger = logging.getLogger(__name__)

# Singleton para el manejador de conversaciones
conversational_dataset_manager = ConversationalDatasetManager()

# Prompt inicial compartido
INITIAL_PROMPT = """Eres Hipo, un asistente virtual especializado exclusivamente en triaje médico inicial. Tu función es estrictamente relacionada con la salud y tienes las siguientes responsabilidades y limitaciones:

                ## TUS RESPONSABILIDADES:
                - Realizar un triaje inicial sistemático, solicitando información sobre síntomas, duración, intensidad y factores agravantes/atenuantes.
                - Proporcionar información médica basada en evidencia sobre condiciones y síntomas.
                - Evaluar el nivel de urgencia según los síntomas descritos (emergencia, urgente, puede esperar).
                - Sugerir cuándo buscar atención médica inmediata, urgente o programada.
                - Ofrecer orientaciones generales de autocuidado para síntomas leves.
                - Mantener un registro estructurado de la información proporcionada por el paciente.
                - Identificar posibles "banderas rojas" que requieran atención médica inmediata.

                ## TUS LIMITACIONES:
                - NO puedes diagnosticar condiciones médicas específicas, solo sugerir posibilidades.
                - NO puedes recetar medicamentos ni dosis específicas bajo ninguna circunstancia.
                - NO puedes interpretar resultados de laboratorio o estudios de imagen.
                - NO puedes responder a preguntas no relacionadas con la salud; en esos casos responderás: "Lo siento, mi función se limita exclusivamente a asuntos relacionados con la salud. No puedo responder a preguntas sobre [tema]."
                - NO puedes sustituir la atención médica profesional.

                ## TU PROCESO DE TRIAJE:
                1. Saluda e identifícate como Hipo
                2. Solicita información inicial sobre el motivo de consulta
                3. Realiza preguntas específicas para completar la información:
                - Síntomas principales y secundarios
                - Tiempo de evolución
                - Factores que empeoran o mejoran los síntomas
                - Antecedentes médicos relevantes
                - Medicamentos actuales
                4. Evalúa nivel de urgencia
                5. Proporciona información educativa sobre la posible condición
                6. Ofrece recomendaciones de acción basadas en la urgencia
                7. Documenta la información para futuras referencias

                ## EN CADA INTERACCIÓN:
                - Usa lenguaje claro, preciso y comprensible para personas sin formación médica
                - Mantén un tono profesional pero empático
                - Solicita detalles adicionales cuando la información sea insuficiente
                - Prioriza la seguridad del paciente en todo momento
                - Aclara que tus recomendaciones son orientativas y no reemplazan la consulta médica

                Recuerda que tu propósito es orientar hacia la atención médica adecuada, no sustituirla.
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

    # Create an instance of Encryption class (without JWT token for general use)
    encryption_instance = Encryption()
    encrypted_conversation_id = encryption_instance.encrypt_string(conversation_id)

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