import logging
from services.chatbot.context_manager import init_context
from services.chatbot.comprehend_medical import detect_entities
from services.chatbot.input_validate import analyze_message, generate_response
from services.chatbot.triaje_classification import TriageClassification
from services.chatbot.bedrock_claude import call_claude

logging.basicConfig(level=logging.INFO)

class Chatbot:
    def __init__(self, user_input, user_data, initial_prompt=None):
        self.user_input = user_input
        self.user_data = user_data
        self.initial_prompt = initial_prompt
        self.context = {}
        self.triage = None
        self.entities = None
        self.response = None

    def initialize_conversation(self):
        try:
            # Validar el mensaje del usuario
            analysis_result = analyze_message(self.user_input)
            
            # Fix: analyze_message returns a tuple, handle it correctly
            if isinstance(analysis_result, tuple):
                analysis_type, error_message = analysis_result
            else:
                # Handle the case where it might return a dict
                analysis_type = analysis_result.get('type', 'general_response')
                error_message = analysis_result.get('error', '')
            
            # Check if the analysis indicates an invalid message
            if analysis_type == "input_error":
                return {"error": error_message or "Mensaje inválido o irreconocible."}
            
            # Handle greeting messages with a direct response
            if analysis_type == "greeting":
                greeting_response = generate_response(self.user_input)
                return {
                    "context": self.user_data or {},
                    "triaje_level": "info",
                    "entities": [],
                    "response": greeting_response,
                    "symptoms": [],
                    "symptoms_pattern": "",
                    "pain_scale": 0,
                    "missing_questions": [],
                    "analysis_type": analysis_type
                }
            
            # Detectar entidades médicas
            self.entities = detect_entities(self.user_input)
            
            # Fix: init_context expects text, not user_data object
            # Pass the user_input as text for entity extraction
            context_result = init_context(self.user_input)
            
            # Extract context from the result
            if isinstance(context_result, dict):
                self.context = context_result.get('context', {})
                missing_questions = context_result.get('missing_questions', [])
            else:
                self.context = context_result
                missing_questions = []
            
            # Merge with provided user_data
            if self.user_data:
                self.context.update(self.user_data)
            
            # Add user input to context for Claude
            self.context['user_input'] = self.user_input
            
            # Add medical entities to context
            if self.entities:
                self.context['medical_entities'] = self.entities
            
            # Fix: TriageClassification constructor expects specific parameters
            # Extract symptoms and pain level from entities or context
            symptoms = self._extract_symptoms_from_entities(self.entities)
            pain_level = self._extract_pain_level_from_context()
            
            # Add extracted information to context
            self.context['symptoms'] = symptoms
            self.context['pain_level'] = pain_level
            
            # Crear instancia de TriageClassification con los parámetros correctos
            self.triage = TriageClassification(
                symptoms=symptoms,
                pain_level=pain_level,
                environment=self.context.get('environment', 'general')
            )
            
            # Fixed: Call Claude with proper parameters
            self.response = call_claude(
                prompt=self.context,
                triage_level=self.triage.triage_level,
                initial_prompt=self.initial_prompt
            )
            
            # Handle severe cases
            if self.triage.triage_level == 'Severo':
                emergency_response = self.triage.handle_severe_case(self.user_input)
                self.response = emergency_response
            
            # Extract additional triage information
            symptoms_pattern = TriageClassification.analyze_symptom_pattern(symptoms)
            
            return {
                "context": self.context,
                "triaje_level": self.triage.triage_level,
                "entities": self.entities,
                "response": self.response,
                "symptoms": symptoms,
                "symptoms_pattern": symptoms_pattern,
                "pain_scale": pain_level,
                "missing_questions": missing_questions,
                "analysis_type": analysis_type
            }
        
        except Exception as e:
            logging.error(f"Error en la inicialización del chatbot: {e}")
            return {"error": "Ocurrió un problema al procesar la solicitud."}
    
    def _extract_symptoms_from_entities(self, entities):
        """Extract symptoms from medical entities"""
        symptoms = []
        if not entities:
            return symptoms
            
        for entity in entities:
            if isinstance(entity, dict):
                # Check if it's a symptom-related entity
                if entity.get('Category') == 'MEDICAL_CONDITION' or entity.get('Type') == 'DX_NAME':
                    symptoms.append(entity.get('Text', '').lower())
                elif entity.get('Category') == 'SYMPTOM':
                    symptoms.append(entity.get('Text', '').lower())
        
        return symptoms
    
    def _extract_pain_level_from_context(self):
        """Extract pain level from context or estimate from input"""
        # Look for pain indicators in the input
        pain_keywords = {
            'severo': 8, 'intenso': 8, 'insoportable': 9, 'terrible': 8,
            'moderado': 5, 'fuerte': 6, 'considerable': 5,
            'leve': 2, 'ligero': 2, 'poco': 1, 'molesto': 3
        }
        
        user_input_lower = self.user_input.lower()
        for keyword, level in pain_keywords.items():
            if keyword in user_input_lower:
                return level
        
        # Look for numeric pain scale (1-10)
        import re
        pain_match = re.search(r'dolor.*?(\d+)', user_input_lower)
        if pain_match:
            pain_value = int(pain_match.group(1))
            if 1 <= pain_value <= 10:
                return pain_value
        
        # Default to mild pain level
        return 2