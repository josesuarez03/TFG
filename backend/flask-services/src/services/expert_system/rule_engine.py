import re
from typing import Any, Dict, List, Optional, Tuple


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


def _default_keywords_for_field(field_name: str) -> List[str]:
    return {
        "duration": ["día", "seman", "mes", "hora", "desde", "hace", "ayer", "anoche", "hoy"],
        "associated_symptoms": ["náusea", "vomit", "luz", "ruido", "visión", "mareo"],
        "neurologic_red_flags": ["rigidez de cuello", "debilidad", "hormigueo", "desmayo"],
        "triggers": ["estrés", "trabajo", "examen", "discusión", "gatilla", "desencaden"],
        "sleep_impact": ["duermo", "insomnio", "sueño"],
        "functional_impact": ["no puedo", "afecta", "rendimiento", "trabajar", "estudiar", "familia", "social", "funcion"],
        "physical_symptoms": ["palpit", "tembl", "sudor", "opresión", "respirar"],
        "consumption_pattern": ["tomo", "beb", "alcohol", "cerveza", "licor", "copas"],
        "last_intake": ["última", "ultima", "anoche", "hoy", "ayer", "hace"],
        "withdrawal_symptoms": ["tembl", "sudor", "náuse", "vomit", "ansiedad", "insomnio", "alucin"],
    }.get(field_name, [])


def _extract_with_rule(
    *,
    field_name: str,
    rule: Dict[str, Any],
    user_message: str,
    user_message_lower: str,
) -> Any:
    extractor_type = str(rule.get("type", "")).strip().lower()

    if extractor_type == "pain_scale":
        pain = infer_pain_level(user_message)
        return pain if pain > 0 else None

    if extractor_type == "categorical_keywords":
        categories = rule.get("categories", {})
        if not isinstance(categories, dict):
            return None
        for category, keywords in categories.items():
            if any(str(k).lower() in user_message_lower for k in (keywords or [])):
                return str(category)
        return None

    if extractor_type == "regex":
        patterns = rule.get("patterns", [])
        for raw_pattern in patterns:
            try:
                match = re.search(str(raw_pattern), user_message, re.IGNORECASE)
            except re.error:
                continue
            if not match:
                continue
            group_index = int(rule.get("group", 0))
            value = match.group(group_index)
            value_type = str(rule.get("value_type", "text")).lower()
            if value_type == "int":
                try:
                    return int(value)
                except (TypeError, ValueError):
                    return None
            return value.strip() if isinstance(value, str) else value
        return None

    keywords = [str(k).lower() for k in rule.get("keywords", []) if str(k).strip()]
    if extractor_type in {"keyword_text", "text_if_keyword"}:
        if any(keyword in user_message_lower for keyword in keywords):
            return user_message.strip()
        return None

    if extractor_type == "always_text":
        return user_message.strip()

    default_keywords = _default_keywords_for_field(field_name)
    if default_keywords and any(keyword in user_message_lower for keyword in default_keywords):
        return user_message.strip()
    if field_name == "onset":
        if any(k in user_message_lower for k in ["de repente", "súbito", "suddenly", "repentino"]):
            return "sudden"
        if any(k in user_message_lower for k in ["gradual", "poco a poco"]):
            return "gradual"
    if field_name in {"pain_intensity", "pain_scale"}:
        pain = infer_pain_level(user_message)
        return pain if pain > 0 else None
    return None


def extract_case_fields(
    *,
    case_def: Dict[str, Any],
    user_message: str,
    previous_fields: Optional[Dict[str, Any]] = None,
    expected_field: Optional[str] = None,
) -> Dict[str, Any]:
    text = _normalize_text(user_message)
    fields = dict(previous_fields or {})
    required_fields = [str(field) for field in case_def.get("required_fields", [])]
    extractors = case_def.get("field_extractors", {})
    if not isinstance(extractors, dict):
        extractors = {}

    for field_name in required_fields:
        if fields.get(field_name) not in (None, "", [], {}):
            continue
        rule = extractors.get(field_name, {}) if isinstance(extractors.get(field_name, {}), dict) else {}
        value = _extract_with_rule(
            field_name=field_name,
            rule=rule,
            user_message=user_message,
            user_message_lower=text,
        )
        if value not in (None, "", [], {}):
            fields[field_name] = value

    if expected_field and expected_field in required_fields and fields.get(expected_field) in (None, "", [], {}):
        rule = extractors.get(expected_field, {}) if isinstance(extractors.get(expected_field, {}), dict) else {}
        if str(rule.get("type", "")).strip().lower() == "pain_scale" or expected_field in {"pain_intensity", "pain_scale"}:
            pain_value = infer_pain_level(user_message)
            if pain_value > 0:
                fields[expected_field] = pain_value
        else:
            fields[expected_field] = user_message.strip()

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
