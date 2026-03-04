import os
import sys
import unittest
from types import SimpleNamespace


CURRENT_DIR = os.path.dirname(__file__)
SRC_DIR = os.path.abspath(os.path.join(CURRENT_DIR, "..", "src"))
if SRC_DIR not in sys.path:
    sys.path.insert(0, SRC_DIR)

from routes.utils import _detect_finalization  # noqa: E402


class ETLTriggerTests(unittest.TestCase):
    def test_triggered_by_triage_recommendation(self):
        triggered, reasons = _detect_finalization(
            user_message="Ok, gracias por la recomendación.",
            bot_response="Te recomiendo control en 24 horas.",
            conversation_state={"next_intent": "triage_recommendation"},
            triage_level="Moderado",
            controller_mode="expert_primary",
        )
        self.assertTrue(triggered)
        self.assertIn("triage_recommendation", reasons)

    def test_triggered_by_emergency_level(self):
        triggered, reasons = _detect_finalization(
            user_message="Me siento peor.",
            bot_response="Debes ir a urgencias.",
            conversation_state={"next_intent": "collect_missing_data"},
            triage_level="Severo",
            controller_mode="emergency_combined",
        )
        self.assertTrue(triggered)
        self.assertIn("emergency", reasons)

    def test_triggered_by_explicit_close_phrase(self):
        triggered, reasons = _detect_finalization(
            user_message="Gracias, terminé por hoy.",
            bot_response="Perfecto.",
            conversation_state={"next_intent": "collect_missing_data"},
            triage_level="Leve",
            controller_mode="llm_primary",
        )
        self.assertTrue(triggered)
        self.assertIn("explicit_close_phrase", reasons)

    def test_not_triggered_without_signals(self):
        triggered, reasons = _detect_finalization(
            user_message="Todavía tengo síntomas y quiero seguir.",
            bot_response="Cuéntame más sobre el dolor.",
            conversation_state={"next_intent": "collect_missing_data"},
            triage_level="Leve",
            controller_mode="llm_primary",
        )
        self.assertFalse(triggered)
        self.assertEqual(reasons, [])

    def test_triggered_by_bot_close_phrase(self):
        triggered, reasons = _detect_finalization(
            user_message="Entendido.",
            bot_response="Espero haberte ayudado, no dudes en volver.",
            conversation_state={"next_intent": "collect_missing_data"},
            triage_level="Leve",
            controller_mode="llm_primary",
        )
        self.assertTrue(triggered)
        self.assertIn("bot_close_phrase", reasons)

    def test_triggered_by_expert_advice_message_from_rules(self):
        expert_decision = SimpleNamespace(action="ask", case_id="headache_case")
        triggered, reasons = _detect_finalization(
            user_message="ok",
            bot_response=(
                "Con la información disponible parece un cuadro no urgente. "
                "Mantente hidratado/a, evita pantallas un tiempo y descansa. "
                "Si empeora, vuelve a escribir o consulta presencial."
            ),
            conversation_state={"next_intent": "collect_missing_data"},
            triage_level="Leve",
            controller_mode="llm_primary",
            expert_decision=expert_decision,
        )
        self.assertTrue(triggered)
        self.assertIn("expert_advice_close", reasons)


if __name__ == "__main__":
    unittest.main()
