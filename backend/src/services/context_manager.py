from flask import session
from services.comprehend_medical import detect_entities

def init_context(text):

    entities = detect_entities(text)

    context = session.get("context", {
        "name": None,
        "age": None,
        "sex": None,
        "location": None,
        "occupation": None,
        "hobbies": None,
        "lifestyle": None
    })

    # Extraer entidades detectadas sin llamar directamente a Comprehend Medical
    for entity in entities:
        if entity["Category"] == "PERSONAL_IDENTIFIABLE_INFORMATION":
            if entity["Type"] == "NAME":
                context["name"] = entity["Text"]
        elif entity["Category"] == "PROTECTED_HEALTH_INFORMATION":
            if entity["Type"] == "AGE":
                context["age"] = entity["Text"]
            elif entity["Type"] == "GENDER":
                context["sex"] = entity["Text"]
    
    # Preguntas adicionales según datos faltantes
    missing_questions = []
    if not context["name"]:
        missing_questions.append("¿Cuál es tu nombre?")
    if not context["sex"]:
        missing_questions.append("¿Cuál es tu sexo?")
    if not context["age"]:
        missing_questions.append("¿Cuál es tu edad?")
    if not context["location"] and not context["occupation"]:
        missing_questions.append("¿Dónde te encuentras o cuál es tu ocupación?")
    if not context["lifestyle"]:
        missing_questions.append("¿Cómo describirías tu estilo de vida?")
    if not context["hobbies"]:
        missing_questions.append("¿Cuáles son tus hobbies?")
    
    # Guardar contexto en sesión
    session["context"] = context
    
    return {"context": context, "missing_questions": missing_questions}