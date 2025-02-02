from nltk.tokenize import word_tokenize

# Palabras clave para restricciones
diagnosis_keywords = ["diagnóstico", "enfermedad", "qué tengo", "qué me pasa"]
medication_keywords = ["medicación", "tratamiento", "dosis", "medicamento", "recetar"]

# Función para analizar la entrada
def analyze_message(user_message):
    tokens = word_tokenize(user_message.lower())
    
    # Detectar si el mensaje contiene palabras clave restringidas
    if any(keyword in tokens for keyword in diagnosis_keywords):
        return "diagnosis_restriction"
    elif any(keyword in tokens for keyword in medication_keywords):
        return "medication_restriction"
    else:
        return "general_response"

# Función para generar respuestas
def generate_response(user_message):
    restriction_type = analyze_message(user_message)
    
    if restriction_type == "diagnosis_restriction":
        return ("No puedo proporcionar un diagnóstico médico. "
                "Por favor, consulta con un profesional de la salud para obtener una evaluación adecuada.")
    elif restriction_type == "medication_restriction":
        return ("No estoy autorizado para recetar medicamentos ni indicar tratamientos. "
                "Consulta a un médico o farmacéutico para obtener orientación.")
    else:
        # Respuesta general del chatbot
        return ("Gracias por compartir tus síntomas. Estoy aquí para ofrecer información general, "
                "pero siempre consulta con un profesional de la salud para más detalles.")