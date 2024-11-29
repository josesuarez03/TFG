import boto3
from config import Config
from services.bedrock_claude import call_claude
import logging

def detect_entities(text):

    try:
        client = boto3.client(service_name='comprehendmedical', region_name=Config.AWS_REGION)

        result = client.detect_entities(Text=text)

        entities = []

        for entity in result.get('Entities', []):
            entity_data = {
               'Text': entity.get('Text', ''),
               'Category': entity.get('Category', ''),
               'Type': entity.get('Type', ''),
               'Score': entity.get('Score', 0.0)
            }

            # Safely handle SNOMED CT concepts
            if 'SNOMEDCTConcepts' in entity:
                entity_data["snomed"] = [
                    {"code": concept.get('Code', ''), 
                     "description": concept.get('Description', '')}
                    for concept in entity['SNOMEDCTConcepts']
                ]

            entities.append(entity_data)

        return entities

    except Exception as e:
        logging.error(f"Error detecting medical entities: {e}")
        return []

def analyze_text(text):

    return detect_entities(text)

def generate_responses(text, language='es'):

    prompts = {
        'es': f"""
        Eres un asistente médico profesional. Analiza el siguiente texto y 
        proporciona un diagnóstico presuntivo basado en la información médica:
        
        Texto: "{text}"
        
        Por favor, proporciona:
        1. Un posible diagnóstico
        2. Recomendaciones iniciales
        3. Razones que respaldan tu análisis
        """,
        'en': f"""
        You are a professional medical assistant. Analyze the following text 
        and provide a presumptive diagnosis:
        
        Text: "{text}"
        
        Please provide:
        1. A possible diagnosis
        2. Initial recommendations
        3. Reasoning behind your analysis
        """
    }

    prompt = prompts.get(language, prompts['es'])
    
    try:
        response = call_claude(prompt)
        return response
    except Exception as e:
        logging.error(f"Error generating medical response: {e}")
        return "No se pudo generar una respuesta médica."