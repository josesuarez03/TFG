import os
import sys
import unittest
from unittest.mock import patch


CURRENT_DIR = os.path.dirname(__file__)
SRC_DIR = os.path.abspath(os.path.join(CURRENT_DIR, "..", "src"))
if SRC_DIR not in sys.path:
    sys.path.insert(0, SRC_DIR)

from services.process_data import etl_runner  # noqa: E402


class ETLRunnerRetryTests(unittest.TestCase):
    def _task(self):
        return {
            "user_id": "user-1",
            "conversation_id": "conv-1",
            "jwt_token": "token-1",
            "run_id": "run-1",
            "reasons": ["triage_recommendation"],
            "django_api_url": None,
        }

    @patch("services.process_data.etl_runner.time.sleep", return_value=None)
    @patch("services.process_data.etl_runner._update_etl_state")
    def test_retry_success_on_third_attempt(self, mock_update_state, _mock_sleep):
        attempt_results = [
            {"success": False, "error": "timeout", "medical_data": {"a": 1}, "django_response": {"error": "timeout"}},
            {"success": False, "error": "503", "medical_data": {"a": 1}, "django_response": {"error": "503"}},
            {"success": True, "error": "", "medical_data": {"a": 1}, "django_response": {"ok": True}},
        ]
        with patch("services.process_data.etl_runner.execute_etl_once", side_effect=attempt_results) as mock_execute:
            result = etl_runner._execute_task_with_retries(self._task(), backoff_seconds=(0, 2, 5))

        self.assertTrue(result["success"])
        self.assertEqual(mock_execute.call_count, 3)
        status_updates = [call.args[2].get("last_status") for call in mock_update_state.call_args_list]
        self.assertIn("success", status_updates)
        self.assertEqual(status_updates[-1], "success")
        self.assertEqual(mock_update_state.call_args_list[-1].args[2].get("attempts"), 3)

    @patch("services.process_data.etl_runner.time.sleep", return_value=None)
    @patch("services.process_data.etl_runner._update_etl_state")
    def test_failed_after_all_retries(self, mock_update_state, _mock_sleep):
        attempt_results = [
            {"success": False, "error": "timeout", "medical_data": {"a": 1}, "django_response": {"error": "timeout"}},
            {"success": False, "error": "503", "medical_data": {"a": 1}, "django_response": {"error": "503"}},
            {"success": False, "error": "network", "medical_data": {"a": 1}, "django_response": {"error": "network"}},
        ]
        with patch("services.process_data.etl_runner.execute_etl_once", side_effect=attempt_results) as mock_execute:
            result = etl_runner._execute_task_with_retries(self._task(), backoff_seconds=(0, 2, 5))

        self.assertFalse(result["success"])
        self.assertEqual(mock_execute.call_count, 3)
        status_updates = [call.args[2].get("last_status") for call in mock_update_state.call_args_list]
        self.assertEqual(status_updates[-1], "failed")
        self.assertEqual(mock_update_state.call_args_list[-1].args[2].get("attempts"), 3)
        self.assertIn("network", mock_update_state.call_args_list[-1].args[2].get("last_error", ""))


if __name__ == "__main__":
    unittest.main()
