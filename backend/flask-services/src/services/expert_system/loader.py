import os
import json
from functools import lru_cache
from typing import Any, Dict

try:
    import yaml  # type: ignore
except Exception:  # pragma: no cover
    yaml = None


def _rules_root() -> str:
    return os.path.join(os.path.dirname(__file__), "rules")


def _load_yaml(path: str) -> Dict[str, Any]:
    if yaml is None:
        return {}
    with open(path, "r", encoding="utf-8") as f:
        payload = yaml.safe_load(f) or {}
    return payload if isinstance(payload, dict) else {}


def _load_json(path: str) -> Dict[str, Any]:
    with open(path, "r", encoding="utf-8") as f:
        payload = json.load(f) or {}
    return payload if isinstance(payload, dict) else {}


@lru_cache(maxsize=1)
def load_knowledge_base() -> Dict[str, Any]:
    rules_root = _rules_root()
    cases_root = os.path.join(rules_root, "cases")
    shared_root = os.path.join(rules_root, "shared")

    cases: Dict[str, Any] = {}
    for filename in os.listdir(cases_root):
        if not filename.endswith((".json", ".yaml", ".yml")):
            continue
        full_path = os.path.join(cases_root, filename)
        if filename.endswith(".json"):
            case_def = _load_json(full_path)
        else:
            case_def = _load_yaml(full_path)
        case_id = case_def.get("case_id")
        if case_id:
            cases[case_id] = case_def

    emergency = _load_json(os.path.join(shared_root, "emergency.json"))
    triage_policy = _load_json(os.path.join(shared_root, "triage_policy.json"))
    if not emergency:
        emergency = _load_yaml(os.path.join(shared_root, "emergency.yaml"))
    if not triage_policy:
        triage_policy = _load_yaml(os.path.join(shared_root, "triage_policy.yaml"))
    return {
        "cases": cases,
        "emergency": emergency,
        "triage_policy": triage_policy,
    }
