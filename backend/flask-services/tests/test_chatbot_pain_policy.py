import os
import sys
import unittest


CURRENT_DIR = os.path.dirname(__file__)
SRC_DIR = os.path.abspath(os.path.join(CURRENT_DIR, "..", "src"))
if SRC_DIR not in sys.path:
    sys.path.insert(0, SRC_DIR)

from services.chatbot.chatbot import Chatbot  # noqa: E402


class ChatbotPainPolicyTests(unittest.TestCase):
    def test_no_default_pain_when_no_evidence(self):
        chatbot = Chatbot(
            user_input="No sé qué tengo, solo me siento mal",
            user_data={},
            existing_context={},
        )
        pain_level = chatbot._extract_pain_level_from_context()
        self.assertEqual(pain_level, 0)

    def test_keeps_previous_pain_value_if_available(self):
        chatbot = Chatbot(
            user_input="Sigue igual",
            user_data={},
            existing_context={"pain_scale": 6},
        )
        pain_level = chatbot._extract_pain_level_from_context()
        self.assertEqual(pain_level, 6)


if __name__ == "__main__":
    unittest.main()
