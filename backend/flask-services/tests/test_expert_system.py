import os
import sys
import unittest


CURRENT_DIR = os.path.dirname(__file__)
SRC_DIR = os.path.abspath(os.path.join(CURRENT_DIR, "..", "src"))
if SRC_DIR not in sys.path:
    sys.path.insert(0, SRC_DIR)

from services.expert_system.orchestrator import ExpertOrchestrator  # noqa: E402


class ExpertSystemTests(unittest.TestCase):
    def setUp(self):
        self.orchestrator = ExpertOrchestrator()

    def test_headache_case_question_flow(self):
        result = self.orchestrator.evaluate(user_message="Tengo dolor de cabeza y migraña desde ayer.")
        self.assertEqual(result.action, "ask")
        self.assertEqual(result.case_id, "headache_case")
        self.assertGreater(result.confidence, 0.0)

    def test_emergency_escalation_psychological(self):
        result = self.orchestrator.evaluate(user_message="No quiero vivir y me quiero hacer daño.")
        self.assertEqual(result.action, "escalate")
        self.assertTrue(result.emergency_triggered)
        self.assertIn("911", result.response)

    def test_low_confidence_fallback(self):
        result = self.orchestrator.evaluate(user_message="Necesito ayuda con un tema no médico.")
        self.assertEqual(result.action, "fallback_ai")
        self.assertIn(result.fallback_reason, {"no_case_match", "low_confidence", "case_conflict"})


if __name__ == "__main__":
    unittest.main()
