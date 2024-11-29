import boto3
from botocore.exceptions import ClientError
from config import Config
import json

def call_claude(prompt, max_tokens: 500, temperature: 0.1):
    client = boto3.client(service_name='"bedrock-runtime', region_name=Config.AWS_REGION)

    model_id = "us.anthropic.claude-3-5-haiku-20241022-v1:0"

    body = {
        "prompt": prompt,
        "max_tokens_to_sample": max_tokens,
        "temperature": temperature
    }

    try:
        response = client.invoke_model(
        modelId=model_id,
        body=json.dumps(body),
        contentType="application/json",
        )

        # Procesar la respuesta
        result = json.loads(response['body'].read())
        return result["completion"]
    
    except (ClientError, Exception) as e:
        print(f"ERROR: Can't invoke '{model_id}'. Reason: {e}")
        exit(1)
