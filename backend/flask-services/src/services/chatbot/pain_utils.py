import re
from typing import Optional


PAIN_KEYWORD_SCORES = {
    "insoportable": 9,
    "muy fuerte": 8,
    "intenso": 8,
    "fuerte": 6,
    "moderado": 5,
    "leve": 2,
    "suave": 2,
    "ligero": 2,
    "molesto": 3,
}


def extract_pain_scale(text: str) -> Optional[int]:
    """Extract explicit/implicit pain scale from natural language text."""
    normalized = (text or "").strip().lower()
    if not normalized:
        return None

    contextual = re.search(r"(?:dolor|intensidad|escala|nivel)[^\d]{0,12}(10|[0-9])", normalized)
    if contextual:
        return int(contextual.group(1))

    direct = re.fullmatch(r"(?:un|una)?\s*(10|[0-9])", normalized)
    if direct:
        return int(direct.group(1))

    # Accept short free-form replies like "es un 4" or "como 6" when the message is brief.
    short_reply = re.fullmatch(
        r"(?:es|sera|seria|como|aprox(?:imadamente)?|mas o menos)?\s*(?:un|una)?\s*(10|[0-9])",
        normalized,
    )
    if short_reply:
        return int(short_reply.group(1))

    for keyword, score in PAIN_KEYWORD_SCORES.items():
        if keyword in normalized:
            return score

    return None
