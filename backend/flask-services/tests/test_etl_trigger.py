import os
import sys
import unittest


CURRENT_DIR = os.path.dirname(__file__)
SRC_DIR = os.path.abspath(os.path.join(CURRENT_DIR, "..", "src"))
if SRC_DIR not in sys.path:
    sys.path.insert(0, SRC_DIR)

from routes.utils import _detect_finalization  # noqa: E402


class ETLTriggerTests(unittest.TestCase):
    def test_triggered_by_triage_recommendation(self):
        triggered, reasons = _detect_finalization(
            user_message="Ok, gracias por la recomendación.",
            conversation_state={"next_intent": "triage_recommendation"},
            triage_level="Moderado",
            controller_mode="expert_primary",
        )
        self.assertTrue(triggered)
        self.assertIn("triage_recommendation", reasons)

    def test_triggered_by_emergency_level(self):
        triggered, reasons = _detect_finalization(
            user_message="Me siento peor.",
            conversation_state={"next_intent": "collect_missing_data"},
            triage_level="Severo",
            controller_mode="emergency_combined",
        )
        self.assertTrue(triggered)
        self.assertIn("emergency", reasons)

    def test_triggered_by_explicit_close_phrase(self):
        triggered, reasons = _detect_finalization(
            user_message="Gracias, terminé por hoy.",
            conversation_state={"next_intent": "collect_missing_data"},
            triage_level="Leve",
            controller_mode="llm_primary",
        )
        self.assertTrue(triggered)
        self.assertIn("explicit_close_phrase", reasons)

    def test_not_triggered_without_signals(self):
        triggered, reasons = _detect_finalization(
            user_message="Todavía tengo síntomas y quiero seguir.",
            conversation_state={"next_intent": "collect_missing_data"},
            triage_level="Leve",
            controller_mode="llm_primary",
        )
        self.assertFalse(triggered)
        self.assertEqual(reasons, [])


if __name__ == "__main__":
    unittest.main()
