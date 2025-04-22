from services.security.encryption import Encryption
from models.conversation import ConversationalDatasetManager
import logging
import json
import requests
from datetime import datetime
from services.chatbot.comprehend_medical import detect_entities
from services.chatbot.bedrock_claude import call_claude
from services.api.send_api import send_to_django_api

logger = logging.getLogger(__name__)

class MedicalDataProcessor:

    def __init__(self, user_id, conversation_id=None, config=None):
        self.user_id = user_id
        self.conversation_id = Encryption.decrypt_string(conversation_id) if conversation_id else None
        self.config = config or {}
        self.dataset_manager = ConversationalDatasetManager()

    def process_medical_data(self, user_id, conversation_id):

        try:
            conversation = self.dataset_manager.get_conversation(user_id, conversation_id)
            if not conversation:
                logger.error(f"Conversación no encontrada: {conversation_id} para usuario {user_id}")
            return {"error": "Conversación no encontrada."}, 404

            messages = conversation.get("messages", [])

            if not messages:
                logger.error(f"No hay mensajes en la conversación: {conversation_id} para usuario {user_id}")
                return {"error": "No hay mensajes en la conversación."}, 400
            
             # Generate a consolidated text for better analysis
            consolidated_text = consolidate_conversation(messages)
            
            # Use LLM to generate a medical context summary
            medical_context = generate_medical_context_summary(messages, consolidated_text)
            
            # Use Comprehend Medical to enhance entity detection
            enhanced_entities = detect_entities(consolidated_text)
            
            # Extract structured data from conversation and entities
            structured_data = extract_structured_data(conversation, messages, enhanced_entities)
            
            # Add the generated medical context
            structured_data['medical_context'] = medical_context
            
            # Add timestamp and source information
            structured_data['processed_at'] = datetime.now().isoformat()
            structured_data['source'] = 'chatbot'
            
            logger.info(f"Datos médicos procesados correctamente para conversación {conversation_id}")
            return structured_data
    
        except Exception as e:
            logger.error(f"Error procesando datos médicos de conversación {conversation_id}: {str(e)}")
            return {"error": f"Error procesando datos médicos: {str(e)}"}
    
    def consolidate_conversation(self, messages):
        consolidated = ""
    
        # Only use patient messages for more relevant medical information
        for message in messages:
            if message.get('role', '').lower() == 'user':
                consolidated += f"{message.get('content', '')} "
        
        return consolidated.strip()
    
    def generate_medical_context_summary(self, messages, consolidated_text):
        prompt = {
            "system_prompt": """Eres un asistente médico especializado en extraer información médica relevante de conversaciones.
            Tu tarea es generar un resumen clínico conciso del contexto médico basado en la conversación proporcionada.
            El resumen debe incluir:
            - Síntomas principales reportados
            - Duración y evolución de los síntomas
            - Factores agravantes o aliviantes
            - Historia médica relevante mencionada
            - Posibles alergias o medicamentos mencionados
            - Preocupaciones principales del paciente
            
            El resumen debe ser objetivo, claro y conciso, limitado a los datos proporcionados en la conversación.
            No hagas diagnósticos ni sugerencias terapéuticas.""",
            "conversation": messages,
            "consolidated_text": consolidated_text
        }
    
        try:
            # Call Claude to generate the summary
            response = call_claude(prompt, "medical_context_summary")
            return response.get('content', '').strip()
        except Exception as e:
            logger.error(f"Error generando resumen de contexto médico: {str(e)}")
            return "No se pudo generar el resumen del contexto médico."
        
    def extract_structured_data(self, conversation, messages, enhanced_entities):
        """
        Extract structured medical data from conversation and enhanced entities
        to be stored in the patient table
        """
        # Initialize data structure based on Patient model fields
        structured_data = {
            'triaje_level': conversation.get('triaje_level'),
            'pain_scale': conversation.get('pain_scale'),
            'medical_context': '',  # Will be filled by generate_medical_context_summary
            'allergies': self.extract_allergies(messages, enhanced_entities),
            'medications': self.extract_medications(enhanced_entities),
            'medical_history': self.extract_medical_history(messages, enhanced_entities),
            'ocupacion': self.extract_occupation(messages)
        }
        
        return structured_data

    def extract_allergies(self, messages, entities):
        """Extract allergies from conversation and entities"""
        allergies = []
        
        # Extract from entities
        for entity in entities:
            if entity.get('Type') == 'MEDICATION' and entity.get('Traits', []):
                for trait in entity.get('Traits', []):
                    if trait.get('Name') == 'NEGATION':
                        continue
                    if trait.get('Name') == 'ALLERGY':
                        allergies.append(entity.get('Text'))
        
        # Look for keywords in messages
        allergy_keywords = ['alergia', 'alérgico', 'alérgica', 'reacción alérgica']
        for message in messages:
            if message.get('role', '').lower() == 'user':
                content = message.get('content', '').lower()
                for keyword in allergy_keywords:
                    if keyword in content:
                        # Add a note that allergies were mentioned but need verification
                        if not allergies:
                            allergies = ["Paciente menciona alergias, verificar detalles."]
        
        return '; '.join(allergies) if allergies else ''

    def extract_medications(self, entities):
        """Extract medications from entities"""
        medications = []
        
        for entity in entities:
            if entity.get('Type') == 'MEDICATION' and not any(trait.get('Name') == 'NEGATION' for trait in entity.get('Traits', [])):
                medication = entity.get('Text')
                if entity.get('Attributes'):
                    for attr in entity.get('Attributes'):
                        if attr.get('Type') == 'DOSAGE':
                            medication += f" ({attr.get('Text')})"
                medications.append(medication)
        
        return '; '.join(medications) if medications else ''

    def extract_medical_history(self, messages, entities):
        """Extract medical history from conversation and entities"""
        conditions = []
        
        # Extract from entities
        for entity in entities:
            if entity.get('Type') in ['MEDICAL_CONDITION', 'DX_NAME'] and not any(trait.get('Name') == 'NEGATION' for trait in entity.get('Traits', [])):
                conditions.append(entity.get('Text'))
        
        # Simple medical history extraction from messages
        history_keywords = ['antecedente', 'historia médica', 'diagnóstico previo', 'padezco de', 'sufro de']
        for message in messages:
            if message.get('role', '').lower() == 'user':
                content = message.get('content', '').lower()
                for keyword in history_keywords:
                    if keyword in content:
                        # If no conditions were found from entities but history keywords exist
                        if not conditions:
                            conditions = ["Paciente menciona antecedentes médicos, verificar detalles."]
        
        return '; '.join(conditions) if conditions else ''

    def extract_occupation(self, messages):
        """Extract occupation information from messages"""
        occupation_keywords = ['trabajo como', 'soy', 'profesión', 'ocupación', 'me dedico a']
        
        for message in messages:
            if message.get('role', '').lower() == 'user':
                content = message.get('content', '').lower()
                for keyword in occupation_keywords:
                    if keyword in content:
                        # Extract basic occupation info - this is simplified and would need improvement
                        idx = content.find(keyword) + len(keyword)
                        end_idx = content.find('.', idx)
                        if end_idx == -1:
                            end_idx = content.find(',', idx)
                        if end_idx == -1:
                            end_idx = len(content)
                        
                        occupation = content[idx:end_idx].strip()
                        if occupation and len(occupation) < 100:  # Sanity check
                            return occupation
        
        return ''

    def send_data_to_django(self, user_id, medical_data):
    
        try:
            # Prepare data for Django API
            django_data = {
                'user_id': user_id,
                'medical_data': medical_data,
                'source': 'chatbot'
            }
            
            # Send data to Django API
            response = send_to_django_api('/api/patients/update_medical_data/', django_data)
            
            return response
        except Exception as e:
            logger.error(f"Error al enviar datos a Django: {str(e)}")
            return {"error": f"Error al enviar datos a Django: {str(e)}"}