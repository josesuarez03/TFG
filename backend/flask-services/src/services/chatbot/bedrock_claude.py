import boto3
from botocore.exceptions import ClientError
from config.config import Config
import json

def call_claude(prompt, triage_level=None, max_tokens=500, temperature=0.1, initial_prompt=None):
    """
    Call Claude API with proper parameter handling
    
    Args:
        prompt: Either a string or dict with context information
        triage_level: Triage classification level (optional)
        max_tokens: Maximum tokens for response
        temperature: Temperature for response generation
        initial_prompt: Initial system prompt to include
    """
    client = boto3.client(
        service_name='bedrock-runtime', 
        region_name=Config.AWS_REGION
    )

    model_id = "us.anthropic.claude-3-5-haiku-20241022-v1:0"

    # Handle different prompt formats
    if isinstance(prompt, dict):
        # If prompt is a context dict, format it appropriately
        formatted_prompt = _format_context_prompt(prompt, initial_prompt)
    else:
        # If prompt is a string, combine with initial prompt if provided
        formatted_prompt = str(prompt)
        if initial_prompt:
            formatted_prompt = f"{initial_prompt}\n\n{formatted_prompt}"

    # Add triage level context if provided
    if triage_level:
        formatted_prompt += f"\n\nNivel de triaje actual: {triage_level}"

    body = json.dumps({
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": max_tokens,
        "temperature": temperature,
        "messages": [
            {
                "role": "user",
                "content": formatted_prompt
            }
        ]
    })

    try:
        response = client.invoke_model(
            modelId=model_id,
            body=body,
            contentType="application/json"
        )

        # Process response
        result = json.loads(response['body'].read())
        return result['content'][0]['text']
    
    except (ClientError, Exception) as e:
        print(f"ERROR: Can't invoke '{model_id}'. Reason: {e}")
        raise

def _format_context_prompt(context_dict, initial_prompt=None):
    """
    Format context dictionary into a structured prompt
    
    Args:
        context_dict: Dictionary containing context information
        initial_prompt: Optional initial system prompt
    """
    prompt_parts = []
    
    # Add initial prompt if available
    if initial_prompt:
        prompt_parts.append(initial_prompt)
    
    # Add existing initial prompt from context if available
    if 'initial_prompt' in context_dict and not initial_prompt:
        prompt_parts.append(context_dict['initial_prompt'])
    
    # Add user input
    if 'user_input' in context_dict:
        prompt_parts.append(f"Usuario: {context_dict['user_input']}")
    
    # Add medical context
    if 'medical_entities' in context_dict:
        entities_text = ", ".join([entity.get('Text', '') for entity in context_dict['medical_entities']])
        if entities_text:
            prompt_parts.append(f"Entidades médicas detectadas: {entities_text}")
    
    # Add symptoms if available
    if 'symptoms' in context_dict:
        symptoms_text = ", ".join(context_dict['symptoms'])
        if symptoms_text:
            prompt_parts.append(f"Síntomas identificados: {symptoms_text}")
    
    # Add pain level if available
    if 'pain_level' in context_dict and context_dict['pain_level'] > 0:
        prompt_parts.append(f"Nivel de dolor: {context_dict['pain_level']}/10")
    
    # Add environment context
    if 'environment' in context_dict:
        prompt_parts.append(f"Contexto: {context_dict['environment']}")
    
    return "\n".join(prompt_parts) if prompt_parts else "Hola, ¿en qué puedo ayudarte?"