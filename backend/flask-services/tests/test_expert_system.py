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

    def test_conversation_state_progresses_between_turns(self):
        first = self.orchestrator.evaluate(user_message="Tengo dolor de cabeza desde ayer.")
        self.assertEqual(first.action, "ask")
        self.assertEqual(first.case_id, "headache_case")
        first_node = first.state.active_node_id

        second = self.orchestrator.evaluate(
            user_message="Fue de repente.",
            prior_expert_state={
                "active_case_id": first.state.active_case_id,
                "active_node_id": first.state.active_node_id,
                "collected_fields": first.state.collected_fields,
                "pain_scale": first.pain_scale,
            },
        )
        self.assertEqual(second.case_id, "headache_case")
        self.assertEqual(second.action, "ask")
        self.assertNotEqual(first_node, second.state.active_node_id)


if __name__ == "__main__":
    unittest.main()
