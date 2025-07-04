import requests

SERVER_URL = "http://162.248.7.248:11434/api/generate"
MODEL_NAME = "mistral"  # or whatever is running: llama3, codellama, etc.

def get_persona_response(persona_key, message):
    payload = {
        "model": MODEL_NAME,
        "prompt": message,
        "stream": False,
        "options": {
            "temperature": 0.7
        }
    }
    try:
        response = requests.post(SERVER_URL, json=payload)
        response.raise_for_status()
        output = response.json()["response"]
        return output.strip()
    except Exception as e:
        return f"[Error getting response from LLM server]: {e}"

