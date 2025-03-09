from services.security.encryption import Encryption
from models.conversation import ConversationalDatasetManager
import logging
import json
import requests
from datetime import datetime

logger = logging.getLogger(__name__)

class MedicalDataProcessor:

    def __init__(self, user_id, conversation_id=None, config=None):
        self.user_id = user_id
        self.conversation_id = Encryption.decrypt_string(conversation_id) if conversation_id else None
        self.config = config or {}
        self.dataset_manager = ConversationalDatasetManager()