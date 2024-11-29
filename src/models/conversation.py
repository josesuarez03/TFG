import json
import os
from datetime import datetime
import uuid

class ConversationalDatasetManager:
    def __init__(self, filename='medical_conversations_dataset.json'):

        self.data_dir = 'data'
        os.makedirs(self.data_dir, exist_ok=True)

        self.file_path = os.path.join(self.data_dir, filename)
        
        self.dataset = self._load_or_create_dataset()

    def _load_or_create_dataset(self):

        if os.path.exists(self.file_path):
            with open(self.file_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        else:
            return {
                "dataset_version": "1.0",
                "created_at": datetime.utcnow().isoformat(),
                "total_conversations": 0,
                "conversations": []
            }

    def add_conversation(self, user_id, medical_context, conversation):

        conversation_entry = {
            "conversation_id": str(uuid.uuid4()),
            "user_id": user_id,
            "timestamp": datetime.utcnow().isoformat(),
            "medical_context": medical_context,
            "messages": conversation
        }

        self.dataset["conversations"].append(conversation_entry)
        self.dataset["total_conversations"] += 1
        self._save_dataset()

    def _save_dataset(self):

        with open(self.file_path, 'w', encoding='utf-8') as f:
            json.dump(self.dataset, f, ensure_ascii=False, indent=2)

    def get_conversations(self, filter_criteria=None):

        if not filter_criteria:
            return self.dataset["conversations"]
        
        filtered_conversations = []
        for conversation in self.dataset["conversations"]:
            match = all(
                conversation.get(key) == value 
                for key, value in filter_criteria.items()
            )
            if match:
                filtered_conversations.append(conversation)
        
        return filtered_conversations

    def generate_training_dataset(self, sample_size=None):

        conversations = self.dataset["conversations"]
        
        training_data = []
        for conversation in conversations:
            for i in range(len(conversation["messages"]) - 1):
                training_data.append({
                    "input": conversation["messages"][i]["content"],
                    "output": conversation["messages"][i+1]["content"],
                    "medical_context": conversation.get("medical_context", {})
                })
        
        return training_data[:sample_size] if sample_size else training_data

