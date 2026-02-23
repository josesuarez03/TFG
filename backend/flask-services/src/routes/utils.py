import logging
import json
import re
import unicodedata
import uuid
from datetime import datetime
from typing import Any, Dict, List, Tuple
from models.conversation import ConversationalDatasetManager
from services.chatbot.conversation_context_service import ConversationContextService
from services.chatbot.pain_utils import extract_pain_scale
from services.api.send_api import get_patient_global_context
from services.expert_system.orchestrator import ExpertOrchestrator
from services.expert_system.fallback_adapter import FallbackModelAdapter
from services.process_data.etl_runner import enqueue_etl_run

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

TRIAGE_RANK = {"LEVE": 1, "MODERADO": 2, "SEVERO": 3}
HYBRID_RESERVED_KEYS = {"analysis", "context_snapshot", "expert_state", "expert_trace", "hybrid_state"}
SAFETY_QUESTION_HINTS = ("dificultad para respirar", "dolor de pecho", "desmayo", "fiebre", "convuls")
EXPLICIT_CLOSE_PHRASES = (
    "eso es todo",
    "gracias termine",
    "termine",
    "fin",
    "cerrar chat",
    "hasta luego",
)


def _normalize_triage(level: str | None) -> str:
    value = str(level or "").strip().capitalize()
    if value in {"Leve", "Moderado", "Severo"}:
        return value
    return "Leve"


def _triage_rank(level: str | None) -> int:
    return TRIAGE_RANK.get(_normalize_triage(level).upper(), 1)


def _max_triage_level(level_a: str | None, level_b: str | None) -> str:
    a = _normalize_triage(level_a)
    b = _normalize_triage(level_b)
    return a if _triage_rank(a) >= _triage_rank(b) else b


def _safe_int_0_10(value: Any) -> int | None:
    return value if isinstance(value, int) and 0 <= value <= 10 else None


def _extract_prior_state(current_conversation: Dict[str, Any] | None) -> Tuple[Dict[str, Any], Dict[str, Any], Dict[str, Any], int | None]:
    prior_context: Dict[str, Any] = {}
    prior_expert_state: Dict[str, Any] = {}
    prior_hybrid_state: Dict[str, Any] = {}
    prior_pain: int | None = None

    if not current_conversation:
        return prior_context, prior_expert_state, prior_hybrid_state, prior_pain

    medical_context = current_conversation.get("medical_context", {})
    if not isinstance(medical_context, dict):
        prior_pain = _safe_int_0_10(current_conversation.get("pain_scale"))
        return prior_context, prior_expert_state, prior_hybrid_state, prior_pain

    snapshot = medical_context.get("context_snapshot")
    if isinstance(snapshot, dict):
        prior_context = dict(snapshot)
    else:
        # Backward compatibility: old conversations may not have context_snapshot
        prior_context = {
            key: value for key, value in medical_context.items() if key not in HYBRID_RESERVED_KEYS
        }

    hybrid_state = medical_context.get("hybrid_state")
    if isinstance(hybrid_state, dict):
        prior_hybrid_state = dict(hybrid_state)

    expert_state = prior_hybrid_state.get("expert_state")
    if isinstance(expert_state, dict):
        prior_expert_state = dict(expert_state)
    elif isinstance(medical_context.get("expert_state"), dict):
        prior_expert_state = dict(medical_context.get("expert_state", {}))

    prior_pain = _safe_int_0_10(prior_hybrid_state.get("last_pain_scale"))
    if prior_pain is None:
        prior_pain = _safe_int_0_10(current_conversation.get("pain_scale"))

    return prior_context, prior_expert_state, prior_hybrid_state, prior_pain


def _expert_state_payload(expert_decision) -> Dict[str, Any]:
    state = expert_decision.state
    return {
        "active_case_id": state.active_case_id,
        "active_node_id": state.active_node_id,
        "required_fields_status": state.required_fields_status,
        "confidence": state.confidence,
        "last_rule_ids": state.last_rule_ids,
        "fallback_reason": state.fallback_reason,
        "emergency_triggered": state.emergency_triggered,
        "collected_fields": state.collected_fields,
        "pain_scale": expert_decision.pain_scale,
        "triage_level": state.triage_level,
    }


def _build_expert_response_data(expert_decision, existing_context: Dict[str, Any], expert_state: Dict[str, Any]) -> Dict[str, Any]:
    if expert_decision.action == "fallback_ai":
        return {
            "context": existing_context,
            "triaje_level": expert_decision.triage_level,
            "entities": [],
            "response": "",
            "symptoms": expert_decision.symptoms,
            "symptoms_pattern": {},
            "pain_scale": expert_decision.pain_scale,
            "missing_questions": [],
            "analysis_type": "expert_system",
            "conversation_state": {
                "missing_fields": [k for k, v in expert_decision.state.required_fields_status.items() if not v],
                "collected_fields": [k for k, v in expert_decision.state.required_fields_status.items() if v],
                "next_intent": "collect_missing_data",
                "loop_guard_triggered": False,
                "questions_selected": [],
                "max_questions_per_turn": 2,
                "expert_state": expert_state,
            },
        }

    questions = [expert_decision.response] if expert_decision.action == "ask" and expert_decision.response else []
    return {
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
            "questions_selected": questions,
            "max_questions_per_turn": 2,
            "expert_state": expert_state,
        },
    }


def _extract_questions(payload: Dict[str, Any] | None) -> List[str]:
    if not isinstance(payload, dict):
        return []
    state = payload.get("conversation_state", {})
    if not isinstance(state, dict):
        return []
    questions = state.get("questions_selected", [])
    if not isinstance(questions, list):
        return []
    return [q.strip() for q in questions if isinstance(q, str) and q.strip()]


def _merge_questions(expert_questions: List[str], llm_questions: List[str], max_questions: int = 2) -> List[str]:
    seen = set()
    ordered: List[str] = []
    for q in expert_questions + llm_questions:
        lowered = q.lower()
        if lowered in seen:
            continue
        seen.add(lowered)
        ordered.append(q)

    safety = [q for q in ordered if any(hint in q.lower() for hint in SAFETY_QUESTION_HINTS)]
    regular = [q for q in ordered if q not in safety]
    return (safety + regular)[:max_questions]


def _compact_llm_guidance(text: str, max_len: int = 200) -> str:
    if not text:
        return ""
    first_line = text.strip().splitlines()[0].strip()
    if len(first_line) <= max_len:
        return first_line
    return first_line[: max_len - 3].rstrip() + "..."


def _normalize_user_text(text: str) -> str:
    lowered = (text or "").strip().lower()
    no_accents = "".join(
        ch for ch in unicodedata.normalize("NFKD", lowered) if unicodedata.category(ch) != "Mn"
    )
    no_punct = re.sub(r"[^\w\s]", " ", no_accents)
    return re.sub(r"\s+", " ", no_punct).strip()


def _detect_finalization(
    user_message: str,
    conversation_state: Dict[str, Any],
    triage_level: str,
    controller_mode: str,
) -> Tuple[bool, List[str]]:
    reasons: List[str] = []

    next_intent = str((conversation_state or {}).get("next_intent", "")).strip().lower()
    if next_intent == "triage_recommendation":
        reasons.append("triage_recommendation")

    if _normalize_triage(triage_level) == "Severo" or str(controller_mode).strip().lower() == "emergency_combined":
        reasons.append("emergency")

    normalized_message = _normalize_user_text(user_message)
    if normalized_message:
        if any(phrase in normalized_message for phrase in EXPLICIT_CLOSE_PHRASES):
            reasons.append("explicit_close_phrase")

    reasons = list(dict.fromkeys(reasons))
    return len(reasons) > 0, reasons

def process_message_logic(user_id, user_message, user_data, conversation_id, jwt_token=None):
    if not user_message.strip():
        return {"error": "El mensaje no puede estar vacío."}, 400

    incoming_context = user_data or {}
    postgres_context = {}
    if jwt_token:
        postgres_context = get_patient_global_context(jwt_token=jwt_token)
        profile = postgres_context.get("profile", {}) if isinstance(postgres_context, dict) else {}
        if isinstance(profile, dict):
            incoming_context = {**incoming_context, "patient_profile": profile}

    current_conversation = None
    if conversation_id:
        try:
            current_conversation = conversational_dataset_manager.get_conversation(user_id, conversation_id)
        except Exception:
            current_conversation = None

    prior_context, prior_expert_state, prior_hybrid_state, prior_pain = _extract_prior_state(current_conversation)
    existing_context = {**prior_context, **incoming_context}

    expert_decision = expert_orchestrator.evaluate(
        user_message=user_message,
        prior_expert_state=prior_expert_state,
    )
    expert_state = _expert_state_payload(expert_decision)
    expert_response_data = _build_expert_response_data(expert_decision, existing_context, expert_state)

    llm_response_data = None
    try:
        llm_candidate = fallback_model_adapter.respond(
            user_message=user_message,
            user_data=user_data,
            initial_prompt=INITIAL_PROMPT,
            user_id=user_id,
            conversation_id=conversation_id,
            existing_context=existing_context,
            postgres_context=postgres_context,
        )
        if isinstance(llm_candidate, dict) and "error" not in llm_candidate:
            llm_response_data = llm_candidate
        elif isinstance(llm_candidate, dict) and llm_candidate.get("error"):
            logger.warning("Fallback LLM candidate returned error: %s", llm_candidate.get("error"))
    except Exception as e:
        logger.warning("Fallback LLM candidate failed: %s", e)

    triage_expert = _normalize_triage(expert_response_data.get("triaje_level"))
    triage_llm = _normalize_triage((llm_response_data or {}).get("triaje_level")) if llm_response_data else triage_expert
    triage_final = _max_triage_level(triage_expert, triage_llm)

    prior_controller_mode = str(prior_hybrid_state.get("controller_mode") or "llm_primary")
    if prior_controller_mode not in {"llm_primary", "expert_primary", "emergency_combined"}:
        prior_controller_mode = "llm_primary"

    prior_active_case_locked = bool(prior_hybrid_state.get("active_case_locked"))
    prior_non_match_streak = int(prior_hybrid_state.get("expert_non_match_streak") or 0)

    expert_active_case = bool(expert_decision.state.active_case_id)
    expert_action = str(expert_decision.action or "")
    previous_node_id = prior_expert_state.get("active_node_id")
    current_node_id = expert_decision.state.active_node_id
    node_advanced = bool(current_node_id != previous_node_id)
    expert_emergency = bool(expert_decision.emergency_triggered or expert_action == "escalate")
    expert_match = bool(expert_active_case and expert_action != "fallback_ai")
    expert_non_match = bool(
        expert_action == "fallback_ai"
        or not expert_active_case
        or (expert_action == "ask" and not node_advanced)
    )

    takeover_reason = None
    handoff_reason = None

    if expert_match:
        expert_non_match_streak = 0
    elif expert_non_match and (prior_controller_mode == "expert_primary" or prior_active_case_locked):
        expert_non_match_streak = prior_non_match_streak + 1
    else:
        expert_non_match_streak = 0 if prior_controller_mode == "llm_primary" else prior_non_match_streak

    if expert_emergency:
        controller_mode = "emergency_combined"
        takeover_reason = "emergency_detected"
        active_case_locked = True
        triage_final = "Severo"
    elif expert_match:
        controller_mode = "expert_primary"
        active_case_locked = True
        if prior_controller_mode != "expert_primary":
            takeover_reason = "expert_case_match"
    elif prior_controller_mode == "expert_primary" and expert_non_match_streak >= 2:
        controller_mode = "llm_primary"
        active_case_locked = False
        handoff_reason = "expert_non_match_streak"
    elif prior_controller_mode == "expert_primary":
        controller_mode = "expert_primary"
        active_case_locked = True
    else:
        controller_mode = "llm_primary"
        active_case_locked = False

    if controller_mode == "llm_primary":
        selected = llm_response_data if llm_response_data else expert_response_data
    elif controller_mode == "expert_primary":
        selected = expert_response_data
    else:
        selected = expert_response_data

    explicit_pain = extract_pain_scale(user_message)
    if explicit_pain is not None:
        pain_scale = explicit_pain
    elif prior_pain is not None:
        pain_scale = prior_pain
    else:
        pain_candidates = [
            _safe_int_0_10(expert_response_data.get("pain_scale")),
            _safe_int_0_10((llm_response_data or {}).get("pain_scale")),
        ]
        pain_scale = next((p for p in pain_candidates if p is not None), 0)

    context_base = existing_context if isinstance(existing_context, dict) else {}
    selected_context = selected.get("context", {})
    if not isinstance(selected_context, dict):
        selected_context = {}
    context_final = {**context_base, **selected_context}
    context_final["pain_scale"] = pain_scale
    context_final["pain_level_reported"] = pain_scale
    context_final["pain_level"] = pain_scale

    conversation_state = selected.get("conversation_state", {})
    if not isinstance(conversation_state, dict):
        conversation_state = {}

    expert_questions = _extract_questions(expert_response_data)
    llm_questions = _extract_questions(llm_response_data)
    if controller_mode == "expert_primary":
        questions_selected = expert_questions[:2] if expert_questions else _merge_questions(expert_questions, llm_questions, max_questions=2)
    elif controller_mode == "llm_primary":
        questions_selected = llm_questions[:2] if llm_questions else _merge_questions([], expert_questions, max_questions=2)
    else:
        questions_selected = _merge_questions(expert_questions, llm_questions, max_questions=2)

    conversation_state["questions_selected"] = questions_selected
    conversation_state["expert_state"] = expert_state
    if controller_mode == "expert_primary":
        conversation_state["missing_fields"] = [k for k, v in expert_decision.state.required_fields_status.items() if not v]
        conversation_state["collected_fields"] = [k for k, v in expert_decision.state.required_fields_status.items() if v]
        conversation_state["next_intent"] = (
            "collect_missing_data" if expert_decision.action == "ask" else "triage_recommendation"
        )
    elif controller_mode == "llm_primary" and "next_intent" not in conversation_state:
        conversation_state["next_intent"] = "collect_missing_data"

    response_text = selected.get("response") or expert_response_data.get("response") or ""
    if controller_mode == "emergency_combined":
        expert_emergency_text = expert_response_data.get("response") or response_text
        llm_hint = _compact_llm_guidance((llm_response_data or {}).get("response", ""))
        if llm_hint:
            response_text = f"{expert_emergency_text}\n\nOrientación adicional: {llm_hint}"
        else:
            response_text = expert_emergency_text
    if not response_text.strip():
        if questions_selected:
            if len(questions_selected) == 1:
                response_text = f"Para continuar:\n{questions_selected[0]}"
            else:
                response_text = f"Para continuar:\n1. {questions_selected[0]}\n2. {questions_selected[1]}"
        else:
            response_text = "Gracias por la información. Continuemos con una pregunta clínica adicional."
    symptoms = selected.get("symptoms", [])
    if not symptoms:
        symptoms = expert_response_data.get("symptoms", [])
    symptoms_pattern = selected.get("symptoms_pattern", {})
    entities = selected.get("entities", [])

    if controller_mode == "llm_primary":
        response_source = "llm" if llm_response_data else "expert"
    elif controller_mode == "expert_primary":
        response_source = "expert"
    else:
        response_source = "hybrid"

    controller_source = "llm" if controller_mode == "llm_primary" else ("expert" if controller_mode == "expert_primary" else "hybrid")
    expert_meta = {
        "used": True,
        "case_id": expert_decision.case_id,
        "method_trace": expert_decision.method_trace,
        "confidence": expert_decision.confidence,
        "action": expert_decision.action,
        "rule_ids_applied": expert_decision.rule_ids_applied,
        "fallback_reason": expert_decision.fallback_reason,
        "emergency_triggered": expert_decision.emergency_triggered,
        "controller_source": controller_source,
        "controller_mode": controller_mode,
    }
    hybrid_state = {
        "controller_mode": controller_mode,
        "expert_state": expert_state,
        "last_pain_scale": pain_scale,
        "active_case_locked": active_case_locked,
        "expert_non_match_streak": expert_non_match_streak,
        "last_arbitration": {
            "controller": controller_source,
            "controller_mode_prev": prior_controller_mode,
            "controller_mode_next": controller_mode,
            "triage_expert": triage_expert,
            "triage_llm": triage_llm if llm_response_data else None,
            "triage_final": triage_final,
            "questions_selected_final": questions_selected,
            "takeover_reason": takeover_reason,
            "handoff_reason": handoff_reason,
            "timestamp": datetime.utcnow().isoformat(),
        },
    }
    prior_etl_state = prior_hybrid_state.get("etl")
    if isinstance(prior_etl_state, dict):
        hybrid_state["etl"] = prior_etl_state

    logger.info(
        "chat_hybrid_turn %s",
        json.dumps(
            {
                "conversation_id": conversation_id,
                "response_source": response_source,
                "case_id": expert_decision.case_id,
                "controller_mode_prev": prior_controller_mode,
                "controller_mode_next": controller_mode,
                "active_case_locked": active_case_locked,
                "fallback_reason": expert_decision.fallback_reason,
                "takeover_reason": takeover_reason,
                "handoff_reason": handoff_reason,
                "expert_non_match_streak": expert_non_match_streak,
                "pain_prev": prior_pain,
                "pain_new": pain_scale,
                "triaje_experto": triage_expert,
                "triaje_llm": triage_llm if llm_response_data else None,
                "triaje_final": triage_final,
                "questions_selected_final": questions_selected,
            },
            ensure_ascii=False,
        ),
    )
    if llm_response_data and triage_expert != triage_llm:
        logger.warning(
            "chat_hybrid_divergence %s",
            json.dumps(
                {
                    "conversation_id": conversation_id,
                    "case_id": expert_decision.case_id,
                    "triage_expert": triage_expert,
                    "triage_llm": triage_llm,
                    "triage_final": triage_final,
                    "controller": controller_source,
                },
                ensure_ascii=False,
            ),
        )

    response_data = {
        "context": context_final,
        "triaje_level": triage_final,
        "entities": entities,
        "response": response_text,
        "symptoms": symptoms,
        "symptoms_pattern": symptoms_pattern,
        "pain_scale": pain_scale,
        "missing_questions": selected.get("missing_questions", []),
        "analysis_type": "hybrid_system" if llm_response_data else selected.get("analysis_type", "expert_system"),
        "conversation_state": conversation_state,
    }
    etl_triggered, etl_reasons = _detect_finalization(
        user_message=user_message,
        conversation_state=conversation_state,
        triage_level=triage_final,
        controller_mode=controller_mode,
    )
    etl_payload = {
        "triggered": False,
        "status": "not_triggered",
        "reasons": [],
        "run_id": "",
    }

    messages = [
        {"role": "user", "content": user_message},
        {"role": "assistant", "content": response_data["response"]},
    ]

    medical_context = {
        "analysis": response_data["entities"],
        "context_snapshot": response_data.get("context", {}),
        "expert_state": expert_state,
        "expert_trace": expert_meta,
        "hybrid_state": hybrid_state,
    }

    if conversation_id:
        if current_conversation:
            all_messages = current_conversation.get("messages", [])
            all_messages.extend(messages)
            conversational_dataset_manager.update_conversation(
                user_id,
                conversation_id,
                messages=all_messages,
                symptoms=response_data.get("symptoms", []),
                symptoms_pattern=response_data.get("symptoms_pattern", {}),
                pain_scale=response_data.get("pain_scale", 0),
                triaje_level=response_data.get("triaje_level", ""),
                medical_context=medical_context,
            )
        else:
            conversation_id = conversational_dataset_manager.add_conversation(
                user_id,
                medical_context,
                messages,
                response_data.get("symptoms", []),
                response_data.get("symptoms_pattern", {}),
                response_data.get("pain_scale", 0),
                response_data.get("triaje_level", ""),
            )
    else:
        conversation_id = conversational_dataset_manager.add_conversation(
            user_id,
            medical_context,
            messages,
            response_data.get("symptoms", []),
            response_data.get("symptoms_pattern", {}),
            response_data.get("pain_scale", 0),
            response_data.get("triaje_level", ""),
        )
    if etl_triggered and conversation_id:
        run_id = str(uuid.uuid4())
        try:
            enqueue_etl_run(
                user_id=user_id,
                conversation_id=conversation_id,
                jwt_token=jwt_token,
                reasons=etl_reasons,
                run_id=run_id,
            )
            etl_payload = {
                "triggered": True,
                "status": "queued",
                "reasons": etl_reasons,
                "run_id": run_id,
            }
        except Exception as e:
            logger.error(
                "No se pudo encolar ETL para conversación %s del usuario %s: %s",
                conversation_id,
                user_id,
                str(e),
            )
    try:
        question_strategy = "single" if len(questions_selected) <= 1 else "dual"
        conversation_context_service.append_turn(
            user_id=user_id,
            conversation_id=conversation_id,
            user_msg=user_message,
            bot_msg=response_data["response"],
            metadata={
                "source_turn_id": len((current_conversation or {}).get("messages", [])) + 1,
                "triaje_level": response_data.get("triaje_level"),
                "symptoms": response_data.get("symptoms"),
                "pain_scale": response_data.get("pain_scale"),
                "questions_selected": questions_selected,
                "answers_detected": bool(user_message and user_message.strip()),
                "question_strategy": question_strategy,
                "response_source": response_source,
                "expert_system": expert_meta,
                "hybrid_state": hybrid_state,
            },
        )
    except Exception as e:
        logger.warning("No se pudo actualizar memoria contextual de embeddings: %s", e)

    return {
        "user_message": user_message,
        "ai_response": response_data["response"],
        "timestamp": datetime.utcnow().isoformat(),
        "analysis": response_data["entities"],
        "context": response_data["context"],
        "symptoms": response_data.get("symptoms", []),
        "symptoms_pattern": response_data.get("symptoms_pattern", {}),
        "pain_scale": response_data.get("pain_scale", 0),
        "triaje_level": response_data.get("triaje_level", "Leve"),
        "conversation_state": response_data.get("conversation_state", {}),
        "conversation_id": conversation_id,
        "response_source": response_source,
        "expert_system": expert_meta,
        "etl": etl_payload,
    }, 200
