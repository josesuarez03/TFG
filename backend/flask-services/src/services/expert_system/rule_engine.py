import re
from typing import Any, Dict, Optional, Tuple


def _normalize_text(text: str) -> str:
    return (text or "").strip().lower()


def _intent_score_for_case(user_message_lower: str, case_def: Dict[str, Any]) -> float:
    keywords = [str(k).lower() for k in case_def.get("intent_keywords", []) if str(k).strip()]
    if not keywords:
        return 0.0
    matches = sum(1 for kw in keywords if kw in user_message_lower)
    return round(matches / len(keywords), 3)


def detect_best_case(user_message: str, cases: Dict[str, Dict[str, Any]], active_case_id: Optional[str] = None) -> Tuple[Optional[str], float, float]:
    user_message_lower = _normalize_text(user_message)
    if active_case_id and active_case_id in cases:
        return active_case_id, _intent_score_for_case(user_message_lower, cases[active_case_id]), 0.0

    scored = []
    for case_id, case_def in cases.items():
        scored.append((case_id, _intent_score_for_case(user_message_lower, case_def)))

    scored.sort(key=lambda item: item[1], reverse=True)
    if not scored:
        return None, 0.0, 0.0

    best_case_id, best_score = scored[0]
    second_score = scored[1][1] if len(scored) > 1 else 0.0
    if best_score <= 0:
        return None, 0.0, second_score
    return best_case_id, best_score, second_score


def infer_pain_level(user_message: str, previous_value: Optional[int] = None) -> int:
    text = _normalize_text(user_message)
    m = re.search(r"(?:dolor|intensidad|escala)[^\d]{0,10}(\d{1,2})", text)
    if m:
        value = int(m.group(1))
        if 0 <= value <= 10:
            return value

    keyword_scores = {
        "insoportable": 9,
        "muy fuerte": 8,
        "intenso": 8,
        "fuerte": 6,
        "moderado": 5,
        "leve": 2,
        "suave": 2,
    }
    for keyword, score in keyword_scores.items():
        if keyword in text:
            return score
    return previous_value if isinstance(previous_value, int) else 0


def extract_case_fields(case_id: str, user_message: str, previous_fields: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    text = _normalize_text(user_message)
    fields = dict(previous_fields or {})

    if case_id == "headache_case":
        if any(k in text for k in ["de repente", "súbito", "suddenly", "repentino"]):
            fields["onset"] = "sudden"
        elif any(k in text for k in ["gradual", "poco a poco"]):
            fields["onset"] = "gradual"
        if any(k in text for k in ["día", "seman", "mes", "hora", "desde ayer", "desde hace"]):
            fields["duration"] = user_message.strip()
        if any(k in text for k in ["náusea", "vomit", "luz", "ruido", "visión", "mareo"]):
            fields["associated_symptoms"] = user_message.strip()
        if any(k in text for k in ["rigidez de cuello", "debilidad", "hormigueo", "desmayo"]):
            fields["neurologic_red_flags"] = user_message.strip()
        pain = infer_pain_level(user_message)
        if pain > 0:
            fields["pain_intensity"] = pain

    if case_id == "anxiety_case":
        if any(k in text for k in ["desde", "día", "seman", "mes", "hace"]):
            fields["duration"] = user_message.strip()
        if any(k in text for k in ["estrés", "trabajo", "examen", "discusión", "gatilla", "desencaden"]):
            fields["triggers"] = user_message.strip()
        if any(k in text for k in ["duermo", "insomnio", "sueño"]):
            fields["sleep_impact"] = user_message.strip()
        if any(k in text for k in ["no puedo", "afecta", "rendimiento", "trabajar", "estudiar"]):
            fields["functional_impact"] = user_message.strip()
        if any(k in text for k in ["palpit", "tembl", "sudor", "opresión", "respirar"]):
            fields["physical_symptoms"] = user_message.strip()

    if case_id == "alcohol_case":
        if any(k in text for k in ["tomo", "beb", "alcohol", "cerveza", "licor", "copas"]):
            fields["consumption_pattern"] = user_message.strip()
        if any(k in text for k in ["última", "ultima", "anoche", "hoy", "ayer", "hace"]):
            fields["last_intake"] = user_message.strip()
        if any(k in text for k in ["tembl", "sudor", "náuse", "vomit", "ansiedad", "insomnio", "alucin"]):
            fields["withdrawal_symptoms"] = user_message.strip()
        if any(k in text for k in ["trabajo", "familia", "problema", "social", "funcion"]):
            fields["functional_impact"] = user_message.strip()

    return fields


def classify_triage_level(case_id: str, pain_level: int, user_message: str, triage_policy: Dict[str, Any]) -> str:
    _ = case_id
    text = _normalize_text(user_message)
    severe_threshold = int(triage_policy.get("pain_thresholds", {}).get("severe", 8))
    moderate_threshold = int(triage_policy.get("pain_thresholds", {}).get("moderate", 5))

    severe_markers = triage_policy.get("severe_markers", [])
    moderate_markers = triage_policy.get("moderate_markers", [])
    if any(marker.lower() in text for marker in severe_markers):
        return "Severo"
    if pain_level >= severe_threshold:
        return "Severo"
    if any(marker.lower() in text for marker in moderate_markers):
        return "Moderado"
    if pain_level >= moderate_threshold:
        return "Moderado"
    return triage_policy.get("default_triage", "Leve")
