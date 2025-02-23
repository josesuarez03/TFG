from flask import Blueprint, jsonify, request
from config import Config
from services.comprehend_medical import detect_entities
from datetime import datetime, timedelta
from models.conversation import ConversationalDatasetManager
from services.chatbot import Chatbot

bp = Blueprint('chat', __name__, url_prefix='/chat')
conversational_dataset_manager = ConversationalDatasetManager()

def save_conversation(user_id, medical_context, messages):
    conversational_dataset_manager.add_conversation(user_id, medical_context, messages)

@bp.route('/message', methods=['POST'])
def process_message():
    data = request.get_json()
    user_message = data.get('message', '')
    user_id = data.get('user_id', 'anonymous')
    user_data = data.get('context', {})

    if not user_message.strip():
        return jsonify({"error": "El mensaje no puede estar vacío."}), 400

    # Crear instancia del chatbot con la entrada del usuario y su contexto
    chatbot = Chatbot(user_message, user_data)
    response_data = chatbot.initialize_conversation()

    if "error" in response_data:
        return jsonify(response_data), 400

    messages = [
        {"role": "user", "content": user_message},
        {"role": "assistant", "content": response_data["response"]}
    ]

    save_conversation(user_id, {"analysis": response_data["entities"]}, messages)

    return jsonify({
        "user_message": user_message,
        "ai_response": response_data["response"],
        "analysis": response_data["entities"],
        "context": response_data["context"],
        "triaje_level": response_data["triaje_level"]
    })

@bp.route('/medical', methods=['POST'])
def analyze_medical():
    data = request.get_json()
    text = data.get('text', '')

    if not text.strip():
        return jsonify({"error": "El texto para analizar no puede estar vacío."}), 400

    medical_entities = detect_entities(text)

    return jsonify({
        "text": text,
        "entities": medical_entities
    })