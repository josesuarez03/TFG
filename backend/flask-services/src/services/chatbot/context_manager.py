from flask import session
from services.chatbot.comprehend_medical import detect_entities

def init_context(text, user_data=None):
    # Detect entities from the input text
    entities = detect_entities(text)

    # Get existing context from session or create new one
    context = session.get("context", {
        "name": None,
        "age": None,
        "sex": None,
        "location": None,
        "occupation": None,
        "hobbies": None,
        "lifestyle": None
    })

    # Merge with provided user_data if available
    if user_data and isinstance(user_data, dict):
        context.update(user_data)

    # Extract entities detected from text
    if entities:
        for entity in entities:
            if isinstance(entity, dict):
                if entity.get("Category") == "PERSONAL_IDENTIFIABLE_INFORMATION":
                    if entity.get("Type") == "NAME":
                        context["name"] = entity.get("Text")
                elif entity.get("Category") == "PROTECTED_HEALTH_INFORMATION":
                    if entity.get("Type") == "AGE":
                        context["age"] = entity.get("Text")
                    elif entity.get("Type") == "GENDER":
                        context["sex"] = entity.get("Text")
    
    # Generate questions for missing data
    missing_questions = []
    if not context.get("name"):
        missing_questions.append("¿Cuál es tu nombre?")
    if not context.get("sex"):
        missing_questions.append("¿Cuál es tu sexo?")
    if not context.get("age"):
        missing_questions.append("¿Cuál es tu edad?")
    if not context.get("location") and not context.get("occupation"):
        missing_questions.append("¿Dónde te encuentras o cuál es tu ocupación?")
    if not context.get("lifestyle"):
        missing_questions.append("¿Cómo describirías tu estilo de vida?")
    if not context.get("hobbies"):
        missing_questions.append("¿Cuáles son tus hobbies?")
    
    # Save context to session
    session["context"] = context
    
    return {
        "context": context, 
        "missing_questions": missing_questions,
        "entities": entities
    }