import logging
from services.chatbot.context_manager import init_context
from services.chatbot.comprehend_medical import detect_entities
from services.chatbot.input_validate import analyze_message
from services.chatbot.triaje_classification import TriageClassification
from services.chatbot.bedrock_claude import call_claude

logging.basicConfig(level=logging.INFO)

class Chatbot:
    def __init__(self, user_input, user_data):
        self.user_input = user_input
        self.user_data = user_data
        self.context = {}
        self.triage = None
        self.entities = None
        self.response = None

    def initialize_conversation(self):
        try:
            # Validar el mensaje del usuario
            analyzed_message = analyze_message(self.user_input)
            if not analyzed_message['is_valid']:
                return {"error": "Mensaje inválido o irreconocible."}
            
            # Detectar entidades médicas
            self.entities = detect_entities(self.user_input)
            
            # Inicializar contexto del usuario
            self.context = init_context(self.user_data, self.entities)
            
            # Clasificar triaje
            self.triage = TriageClassification(self.context)
            
            # Obtener respuesta del modelo Claude
            self.response = call_claude(self.context, self.triage.level)
            
            return {
                "context": self.context,
                "triaje_level": self.triage.level,
                "entities": self.entities,
                "response": self.response
            }
        
        except Exception as e:
            logging.error(f"Error en la inicialización del chatbot: {e}")
            return {"error": "Ocurrió un problema al procesar la solicitud."}