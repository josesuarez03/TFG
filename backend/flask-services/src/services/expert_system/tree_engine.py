from typing import Any, Dict, Optional


def compute_required_fields_status(case_def: Dict[str, Any], collected_fields: Dict[str, Any]) -> Dict[str, bool]:
    required = case_def.get("required_fields", [])
    status = {}
    for field in required:
        value = collected_fields.get(field)
        status[field] = value not in (None, "", [], {})
    return status


def select_next_node(case_def: Dict[str, Any], required_fields_status: Dict[str, bool]) -> Optional[Dict[str, Any]]:
    for node in case_def.get("tree", []):
        field = node.get("field")
        if not field:
            continue
        if not required_fields_status.get(field, False):
            return node
    return None


def build_advice(case_def: Dict[str, Any], triage_level: str) -> str:
    advice = case_def.get("advice", {})
    response = advice.get(triage_level) or advice.get("Leve") or ""
    return response.strip()
