import logging
from models.conversation import ConversationalDatasetManager
from services.chatbot.conversation_context_service import ConversationContextService
from services.api.send_api import get_patient_global_context
from services.expert_system.orchestrator import ExpertOrchestrator
from services.expert_system.fallback_adapter import FallbackModelAdapter

# Configurar logger
logger = logging.getLogger(__name__)

# Singleton para el manejador de conversaciones
conversational_dataset_manager = ConversationalDatasetManager()
conversation_context_service = ConversationContextService()
expert_orchestrator = ExpertOrchestrator()
fallback_model_adapter = FallbackModelAdapter()

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
                - No hagas listas largas de preguntas.
                - Haz máximo 1 o 2 preguntas por respuesta.
                - Si faltan varios datos, prioriza y pregunta por turnos.
                - Mantén respuestas breves (2-5 líneas).

                Recuerda que tu propósito es orientar hacia la atención médica adecuada, no sustituirla.
                """

def process_message_logic(user_id, user_message, user_data, conversation_id, jwt_token=None):
    
    if not user_message.strip():
        return {"error": "El mensaje no puede estar vacío."}, 400

    existing_context = user_data or {}
    postgres_context = {}
    if jwt_token:
        postgres_context = get_patient_global_context(jwt_token=jwt_token)
        profile = postgres_context.get("profile", {}) if isinstance(postgres_context, dict) else {}
        if isinstance(profile, dict):
            existing_context = {
                **existing_context,
                "patient_profile": profile,
            }
    current_conversation = None
    if conversation_id:
        try:
            current_conversation = conversational_dataset_manager.get_conversation(user_id, conversation_id)
            if current_conversation and isinstance(current_conversation.get("medical_context"), dict):
                existing_context = {**existing_context, **current_conversation.get("medical_context", {})}
        except Exception:
            pass

    prior_expert_state = {}
    if current_conversation and isinstance(current_conversation.get("medical_context"), dict):
        prior_expert_state = current_conversation.get("medical_context", {}).get("expert_state", {}) or {}

    expert_decision = expert_orchestrator.evaluate(
        user_message=user_message,
        prior_expert_state=prior_expert_state,
    )

    if expert_decision.action == "fallback_ai":
        response_data = fallback_model_adapter.respond(
            user_message=user_message,
            user_data=user_data,
            initial_prompt=INITIAL_PROMPT,
            user_id=user_id,
            conversation_id=conversation_id,
            existing_context=existing_context,
            postgres_context=postgres_context,
        )
        response_source = "llm"
        expert_meta = {
            "used": False,
            "case_id": expert_decision.case_id,
            "method_trace": expert_decision.method_trace,
            "confidence": expert_decision.confidence,
            "action": expert_decision.action,
            "rule_ids_applied": expert_decision.rule_ids_applied,
            "fallback_reason": expert_decision.fallback_reason,
            "emergency_triggered": expert_decision.emergency_triggered,
        }
    else:
        response_data = {
            "context": existing_context,
            "triaje_level": expert_decision.triage_level,
            "entities": [],
            "response": expert_decision.response,
            "symptoms": expert_decision.symptoms,
            "symptoms_pattern": {},
            "pain_scale": expert_decision.pain_scale,
            "missing_questions": [],
            "analysis_type": "expert_system",
            "conversation_state": {
                "missing_fields": [k for k, v in expert_decision.state.required_fields_status.items() if not v],
                "collected_fields": [k for k, v in expert_decision.state.required_fields_status.items() if v],
                "next_intent": "collect_missing_data" if expert_decision.action == "ask" else "triage_recommendation",
                "loop_guard_triggered": False,
                "questions_selected": [expert_decision.response] if expert_decision.action == "ask" else [],
                "max_questions_per_turn": 2,
                "expert_state": {
                    "active_case_id": expert_decision.state.active_case_id,
                    "active_node_id": expert_decision.state.active_node_id,
                    "required_fields_status": expert_decision.state.required_fields_status,
                    "confidence": expert_decision.state.confidence,
                    "last_rule_ids": expert_decision.state.last_rule_ids,
                    "fallback_reason": expert_decision.state.fallback_reason,
                    "emergency_triggered": expert_decision.state.emergency_triggered,
                    "collected_fields": expert_decision.state.collected_fields,
                    "pain_scale": expert_decision.pain_scale,
                    "triage_level": expert_decision.state.triage_level,
                },
            },
        }
        response_source = "expert_system"
        expert_meta = {
            "used": True,
            "case_id": expert_decision.case_id,
            "method_trace": expert_decision.method_trace,
            "confidence": expert_decision.confidence,
            "action": expert_decision.action,
            "rule_ids_applied": expert_decision.rule_ids_applied,
            "fallback_reason": expert_decision.fallback_reason,
            "emergency_triggered": expert_decision.emergency_triggered,
        }

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
    medical_context = {
        "analysis": response_data["entities"],
        "context_snapshot": response_data.get("context", {}),
        "expert_state": response_data.get("conversation_state", {}).get("expert_state", {}),
        "expert_trace": expert_meta,
    }

    if conversation_id:
        if current_conversation:
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
                triaje_level=triaje_level,
                medical_context=medical_context,
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
    try:
        questions_selected = response_data.get("conversation_state", {}).get("questions_selected", [])
        question_strategy = "single" if len(questions_selected) <= 1 else "dual"
        conversation_context_service.append_turn(
            user_id=user_id,
            conversation_id=conversation_id,
            user_msg=user_message,
            bot_msg=response_data["response"],
            metadata={
                "source_turn_id": len((current_conversation or {}).get("messages", [])) + 1,
                "triaje_level": triaje_level,
                "symptoms": symptoms,
                "pain_scale": pain_scale,
                "questions_selected": questions_selected,
                "answers_detected": bool(user_message and user_message.strip()),
                "question_strategy": question_strategy,
                "response_source": response_source,
                "expert_system": expert_meta,
            },
        )
    except Exception as e:
        logger.warning("No se pudo actualizar memoria contextual de embeddings: %s", e)

    return {
        "user_message": user_message,
        "ai_response": response_data["response"],
        "analysis": response_data["entities"],
        "context": response_data["context"],
        "symptoms": symptoms,
        "symptoms_pattern": symptoms_pattern,
        "pain_scale": pain_scale,
        "triaje_level": triaje_level,
        "conversation_state": response_data.get("conversation_state", {}),
        "conversation_id": conversation_id,
        "response_source": response_source,
        "expert_system": expert_meta,
    }, 200
