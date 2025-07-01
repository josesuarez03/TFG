import requests
import uuid

SERVER_URL = 'http://localhost:5000/chat/message'

def start_chat():
    # Generate a unique user ID
    user_id = str(uuid.uuid4())
    
    # Initialize context
    context = {
        "initialized": False,
        "name": "",
        "age": "",
        "symptoms": ""
    }
    
    print("Chatbot Medico - Escribe salir para terminar")
    
    while True:
        mensaje = input("Usuario: ")
        
        if mensaje.lower() == "salir":
            print("Cerrando el chat. ¡Hasta luego!")
            break
        
        # Prepare request payload
        payload = {
            "message": mensaje,
            "user_id": user_id,
            "context": context
        }
        
        try:
            # Send message to server
            respuesta = requests.post(SERVER_URL, json=payload).json()
            
            # Handle different response scenarios
            if 'next_step' in respuesta:
                # Update context based on the current step
                if respuesta['next_step'] == 'ask_name':
                    context['name'] = mensaje
                elif respuesta['next_step'] == 'ask_age':
                    context['age'] = mensaje
                elif respuesta['next_step'] == 'ask_symptoms':
                    context['symptoms'] = mensaje
                
                # Mark context as progressing
                context['initialized'] = False
            else:
                # Mark context as fully initialized
                context['initialized'] = True
            
            # Print bot's response
            print("Bot:", respuesta.get('response', respuesta.get('ai_response', 'Sin respuesta')))
            
        except requests.exceptions.RequestException as e:
            print(f"Error de conexión: {e}")
            break

if __name__ == '__main__':
    start_chat()