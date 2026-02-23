from services.chatbot.comprehend_medical import detect_entities
from services.chatbot.duration_utils import extract_duration_text
import re


def _extract_pain_level_reported(text):
    if not text:
        return None
    lowered = text.strip().lower()

    # Accept direct short answers like "4" or "un 4"
    direct = re.fullmatch(r"(?:un|una)?\s*(10|[1-9])", lowered)
    if direct:
        return int(direct.group(1))

    # Accept answers that mention pain intensity explicitly
    contextual = re.search(r"(?:dolor|intensidad|escala|nivel)[^\d]{0,12}(10|[1-9])", lowered)
    if contextual:
        return int(contextual.group(1))

    return None


def _extract_symptom_duration(text):
    return extract_duration_text(text)


def _extract_red_flags_answer(text):
    if not text:
        return None
    lowered = text.strip().lower()
    has_red_flags = re.search(
        r"(dificultad para respirar|dolor de pecho|desmayo|fiebre|convuls|sangrado|debilidad)",
        lowered,
    )
    has_negation = re.search(r"\b(no|ninguno|ninguna|nada|niego|sin)\b", lowered)
    if has_red_flags:
        return "no" if has_negation else "sí"
    return None

def init_context(text, user_data=None, existing_context=None):
    entities = detect_entities(text)

    context = existing_context.copy() if isinstance(existing_context, dict) else {
        "name": None,
        "age": None,
        "sex": None,
        "location": None,
        "occupation": None,
        "hobbies": None,
        "lifestyle": None,
        "chief_complaint": None,
        "symptom_duration": None,
        "pain_level_reported": None,
        "red_flags_checked": None,
        "current_medications": None,
        "known_allergies": None,
        "medical_history_known": None
    }

    # Merge with provided user_data if available
    if user_data and isinstance(user_data, dict):
        context.update(user_data)

    # Extract entities detected from text
    if entities:
        for entity in entities:
            if isinstance(entity, dict):
                if entity.get("Category") == "PERSONAL_IDENTIFIABLE_INFORMATION":
                    if entity.get("Type") == "NAME":
                        context["name"] = entity.get("Text")
                elif entity.get("Category") == "PROTECTED_HEALTH_INFORMATION":
                    if entity.get("Type") == "AGE":
                        context["age"] = entity.get("Text")
                    elif entity.get("Type") == "GENDER":
                        context["sex"] = entity.get("Text")

    if text and not context.get("chief_complaint"):
        context["chief_complaint"] = text.strip()

    # Infer structured answers from free text so asked questions are not repeated
    if context.get("symptom_duration") in (None, "", [], {}):
        duration = _extract_symptom_duration(text)
        if duration:
            context["symptom_duration"] = duration

    if context.get("pain_level_reported") in (None, "", [], {}):
        pain_value = _extract_pain_level_reported(text)
        if pain_value is not None:
            context["pain_level_reported"] = pain_value

    if context.get("red_flags_checked") in (None, "", [], {}):
        red_flags = _extract_red_flags_answer(text)
        if red_flags:
            context["red_flags_checked"] = red_flags

    # Prioridad clínica de preguntas (menor número = más prioridad)
    missing_question_meta = []

    def add_question(field, question, priority):
        value = context.get(field)
        if value in (None, "", [], {}):
            missing_question_meta.append(
                {
                    "field": field,
                    "question": question,
                    "priority": priority,
                }
            )

    # 1) Síntoma principal / evolución
    add_question("symptom_duration", "¿Desde cuándo tienes estos síntomas?", 1)
    # 2) Intensidad
    add_question("pain_level_reported", "En una escala del 1 al 10, ¿qué tan intenso es el dolor ahora?", 2)
    # 3) Red flags
    add_question("red_flags_checked", "¿Has tenido dificultad para respirar, dolor de pecho, desmayo o fiebre muy alta?", 3)
    # 4) Medicación / alergias / antecedentes
    add_question("current_medications", "¿Estás tomando algún medicamento actualmente?", 4)
    add_question("known_allergies", "¿Tienes alergias a medicamentos o alimentos?", 4)
    add_question("medical_history_known", "¿Tienes algún antecedente médico importante?", 4)
    # 5) Demográficos secundarios
    add_question("name", "¿Cuál es tu nombre?", 5)
    add_question("sex", "¿Cuál es tu sexo?", 5)
    add_question("age", "¿Cuál es tu edad?", 5)
    if (context.get("location") in (None, "")) and (context.get("occupation") in (None, "")):
        missing_question_meta.append(
            {
                "field": "location_or_occupation",
                "question": "¿Dónde te encuentras o cuál es tu ocupación?",
                "priority": 5,
            }
        )

    missing_question_meta.sort(key=lambda x: x["priority"])
    missing_questions = [item["question"] for item in missing_question_meta]

    return {
        "context": context,
        "missing_questions": missing_questions,
        "missing_question_meta": missing_question_meta,
        "entities": entities
    }
