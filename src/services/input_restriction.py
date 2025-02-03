import re
import unicodedata
from nltk.tokenize import word_tokenize
from nltk.corpus import stopwords

# Configuración de stopwords y lenguaje
try:
    stop_words = set(stopwords.words('spanish'))
except LookupError:
    import nltk
    nltk.download('stopwords')
    stop_words = set(stopwords.words('spanish'))

# Palabras clave para restricciones
diagnosis_keywords = ["diagnóstico", "enfermedad", "qué tengo", "qué me pasa"]
medication_keywords = ["medicación", "tratamiento", "dosis", "medicamento", "recetar"]

# Patrones de expresiones regulares para validación
HARMFUL_PATTERNS = [
    r'<script>',           # Bloquear inyección de scripts
    r'javascript:',        # Prevenir ejecución de código
    r'onerror=',           # Bloquear eventos maliciosos
    r'\b(select|drop|union|insert|delete)\b',  # Prevenir inyección SQL
    r'[^\w\s\u00C0-\u00FF.?!,]'  # Permitir solo caracteres alfanuméricos y signos de puntuación
]

def normalize_text(text):
    """Normaliza texto eliminando acentos y convirtiendo a minúsculas."""
    return ''.join(
        char for char in unicodedata.normalize('NFKD', text)
        if unicodedata.category(char) != 'Mn'
    ).lower()

def validate_input(user_message):
    """Valida la entrada del usuario con múltiples capas de verificación."""
    # Verificar mensaje vacío o solo espacios
    if not user_message or user_message.isspace():
        return False, "El mensaje no puede estar vacío."
    
    # Normalizar y limpiar el texto
    normalized_message = normalize_text(user_message)
    
    # Verificar longitud máxima
    if len(user_message) > 500:
        return False, "El mensaje es demasiado largo. Límite máximo: 500 caracteres."
    
    # Verificar patrones dañinos con regex
    for pattern in HARMFUL_PATTERNS:
        if re.search(pattern, normalized_message, re.IGNORECASE):
            return False, "Entrada no válida: se detectaron caracteres o patrones potencialmente dañinos."
    
    # Análisis de tokens
    tokens = word_tokenize(normalized_message)
    
    # Remover stopwords
    filtered_tokens = [token for token in tokens if token not in stop_words]
    
    # Verificar densidad de palabras significativas
    if len(filtered_tokens) < 2:
        return False, "El mensaje debe contener al menos dos palabras significativas."
    
    # Verificar repetición excesiva de caracteres
    if re.search(r'(.)\1{3,}', user_message):
        return False, "No se permiten repeticiones excesivas de caracteres."
    
    return True, ""

def analyze_message(user_message):
    """Analiza el mensaje después de la validación."""
    is_valid, error_message = validate_input(user_message)
    if not is_valid:
        return "input_error", error_message
    
    normalized_message = normalize_text(user_message)
    tokens = word_tokenize(normalized_message)
    
    if any(keyword in tokens for keyword in diagnosis_keywords):
        return "diagnosis_restriction", ""
    elif any(keyword in tokens for keyword in medication_keywords):
        return "medication_restriction", ""
    else:
        return "general_response", ""

def generate_response(user_message):
    """Genera respuesta basada en el análisis del mensaje."""
    restriction_type, error_message = analyze_message(user_message)
    
    if restriction_type == "input_error":
        return error_message
    elif restriction_type == "diagnosis_restriction":
        return ("No puedo proporcionar un diagnóstico médico. "
                "Por favor, consulta con un profesional de la salud para obtener una evaluación adecuada.")
    elif restriction_type == "medication_restriction":
        return ("No estoy autorizado para recetar medicamentos ni indicar tratamientos. "
                "Consulta a un médico o farmacéutico para obtener orientación.")
    else:
        return ("Gracias por compartir tus síntomas. Estoy aquí para ofrecer información general, "
                "pero siempre consulta con un profesional de la salud para más detalles.")