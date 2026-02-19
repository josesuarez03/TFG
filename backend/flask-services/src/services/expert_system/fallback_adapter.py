from typing import Any, Dict

from services.chatbot.chatbot import Chatbot


class FallbackModelAdapter:
    """Interface mínima para fallback a IA en futuras iteraciones."""

    def respond(
        self,
        *,
        user_message: str,
        user_data: Dict[str, Any],
        initial_prompt: str,
        user_id: str,
        conversation_id: str | None,
        existing_context: Dict[str, Any],
        postgres_context: Dict[str, Any],
    ) -> Dict[str, Any]:
        chatbot = Chatbot(
            user_message,
            user_data,
            initial_prompt=initial_prompt,
            user_id=user_id,
            conversation_id=conversation_id,
            existing_context=existing_context,
            postgres_context=postgres_context,
        )
        return chatbot.initialize_conversation()
