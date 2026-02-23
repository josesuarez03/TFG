import os
import sys
import unittest
from types import SimpleNamespace
from unittest.mock import patch


CURRENT_DIR = os.path.dirname(__file__)
SRC_DIR = os.path.abspath(os.path.join(CURRENT_DIR, "..", "src"))
if SRC_DIR not in sys.path:
    sys.path.insert(0, SRC_DIR)

from routes import utils as route_utils  # noqa: E402


def _build_fake_decision() -> SimpleNamespace:
    fake_state = SimpleNamespace(
        active_case_id="headache_case",
        active_node_id=None,
        required_fields_status={"duration": True},
        confidence=0.95,
        last_rule_ids=["advice_moderado"],
        fallback_reason=None,
        emergency_triggered=False,
        collected_fields={"duration": "2 días"},
        triage_level="Moderado",
    )
    return SimpleNamespace(
        action="advise",
        response="Por ahora puedes hidratarte y vigilar síntomas de alarma.",
        case_id="headache_case",
        confidence=0.95,
        rule_ids_applied=["advice_moderado"],
        fallback_reason=None,
        emergency_triggered=False,
        method_trace=["rules", "tree", "scoring"],
        triage_level="Moderado",
        pain_scale=4,
        symptoms=["dolor de cabeza"],
        state=fake_state,
    )


class ChatFlowETLIntegrationTests(unittest.TestCase):
    def test_process_message_returns_etl_block_and_queues(self):
        fake_decision = _build_fake_decision()
        with patch.object(route_utils.expert_orchestrator, "evaluate", return_value=fake_decision), patch.object(
            route_utils.fallback_model_adapter, "respond", return_value=None
        ), patch.object(route_utils.conversational_dataset_manager, "get_conversation", return_value=None), patch.object(
            route_utils.conversational_dataset_manager, "add_conversation", return_value="conv-123"
        ), patch.object(
            route_utils.conversation_context_service, "append_turn", return_value=None
        ), patch(
            "routes.utils.enqueue_etl_run", return_value=None
        ) as mock_enqueue:
            payload, status_code = route_utils.process_message_logic(
                user_id="user-123",
                user_message="Gracias, terminé.",
                user_data={},
                conversation_id=None,
                jwt_token=None,
            )

        self.assertEqual(status_code, 200)
        self.assertIn("etl", payload)
        self.assertTrue(payload["etl"]["triggered"])
        self.assertEqual(payload["etl"]["status"], "queued")
        self.assertTrue(payload["etl"]["run_id"])
        self.assertTrue(any(reason in payload["etl"]["reasons"] for reason in ["triage_recommendation", "explicit_close_phrase"]))
        self.assertEqual(mock_enqueue.call_count, 1)

    def test_process_message_not_blocked_if_enqueue_fails(self):
        fake_decision = _build_fake_decision()
        with patch.object(route_utils.expert_orchestrator, "evaluate", return_value=fake_decision), patch.object(
            route_utils.fallback_model_adapter, "respond", return_value=None
        ), patch.object(route_utils.conversational_dataset_manager, "get_conversation", return_value=None), patch.object(
            route_utils.conversational_dataset_manager, "add_conversation", return_value="conv-123"
        ), patch.object(
            route_utils.conversation_context_service, "append_turn", return_value=None
        ), patch(
            "routes.utils.enqueue_etl_run", side_effect=RuntimeError("queue down")
        ):
            payload, status_code = route_utils.process_message_logic(
                user_id="user-123",
                user_message="Gracias, terminé.",
                user_data={},
                conversation_id=None,
                jwt_token=None,
            )

        self.assertEqual(status_code, 200)
        self.assertIn("etl", payload)
        self.assertFalse(payload["etl"]["triggered"])
        self.assertEqual(payload["etl"]["status"], "not_triggered")


if __name__ == "__main__":
    unittest.main()
