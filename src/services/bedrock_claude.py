import boto3
from botocore.exceptions import ClientError
from config import Config
import json

def call_claude(prompt, max_tokens=500, temperature=0.1):
    client = boto3.client(service_name='bedrock-runtime', region_name=Config.AWS_REGION)

    model_id = "us.anthropic.claude-3-5-haiku-20241022-v1:0"

    body = {
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": max_tokens,
        "temperature": temperature
    }

    try:
        response = client.invoke_model(
            modelId=model_id,
            body=json.dumps(body),
            contentType="application/json",
        )

        # Process response
        result = json.loads(response['body'].read())
        return result["content"][0]["text"]
    
    except (ClientError, Exception) as e:
        print(f"ERROR: Can't invoke '{model_id}'. Reason: {e}")
        raise