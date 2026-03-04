import json
import logging
from datetime import datetime
from typing import Any, Dict, List

from config.config import Config
from data.connect import context_redis_client

logger = logging.getLogger(__name__)


class ContextManagerRedis:
    def __init__(self, max_context: int = 20, ttl_seconds: int | None = None):
        self.max_context = max_context
        self.ttl_seconds = ttl_seconds or Config.CHAT_CONTEXT_TTL_SECONDS

    def _key(self, user_id: str, conversation_id: str) -> str:
        return f"chat:ctx:{user_id}:{conversation_id}"

    def add_turn(self, user_id: str, conversation_id: str, data: Dict[str, Any]) -> None:
        key = self._key(user_id, conversation_id)
        payload = {"timestamp": datetime.utcnow().isoformat(), **(data or {})}
        context_redis_client.rpush(key, json.dumps(payload))
        context_redis_client.ltrim(key, -self.max_context, -1)
        context_redis_client.expire(key, self.ttl_seconds)
        logger.debug("Context turn appended key=%s", key)

    def get_turns(self, user_id: str, conversation_id: str, limit: int | None = None) -> List[Dict[str, Any]]:
        key = self._key(user_id, conversation_id)
        limit = limit or self.max_context
        raw = context_redis_client.lrange(key, -limit, -1)
        turns = []
        for item in raw:
            try:
                turns.append(json.loads(item))
            except Exception:
                continue
        return turns

    def clear(self, user_id: str, conversation_id: str) -> None:
        context_redis_client.delete(self._key(user_id, conversation_id))
