from flask import Blueprint, jsonify, request
from config import Config
from services.comprehend_medical import generate_responses, detect_entities, analyze_text
from datetime import datetime, timedelta
from models.conversation import ConversationalDatasetManager

bp = Blueprint('chat', __name__, url_prefix='/chat')
conversational_dataset_manager = ConversationalDatasetManager()

def save_conversation(user_id, medical_context, messages):
    conversational_dataset_manager.add_conversation(user_id, medical_context, messages)

@bp.route('/message', methods=['POST'])
def process_message():
    data = request.get_json()
    user_message = data['message']
    user_id = data.get('user_id', 'anonymous')
    context = data.get('context', {})
    
    if not context.get('initialized'):
        if not context.get('name'):
            return jsonify({
                "response": "¡Hola! Para comenzar, ¿cómo te llamas?",
                "next_step": "ask_name"
            })
        
        if not context.get('age'):
            return jsonify({
                "response": f"Encantado de conocerte, {context['name']}. ¿Cuántos años tienes?",
                "next_step": "ask_age"
            })
        
        if not context.get('symptoms'):
            return jsonify({
                "response": f"Gracias, {context['name']}. En un rango del 1 al 10, ¿cómo te sientes hoy?",
                "next_step": "ask_symptoms"
            })

    analysis_result = analyze_text(user_message)

    messages = [
        {"role": "user", "content": user_message},
        # You might want to add the AI's response here as well
    ]

    save_conversation(user_id, {"analysis": analysis_result}, messages)

    ai_response = generate_responses(user_message)

    return jsonify({
        "user_message": user_message,
        "ai_response": ai_response,
        "analysis": analysis_result
    })

@bp.route('/medical', methods=['POST'])
def analyze_medical():
    data = request.get_json()
    text = data['text']

    medical_entities = detect_entities(text)

    return jsonify({
        "text": text,
        "entities": medical_entities
    })