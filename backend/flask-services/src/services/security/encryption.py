from cryptography.fernet import Fernet
import base64
import os
import jwt
from config.config import Config

class Encryption:

    def __init__(self, jwt_token=None):

        if jwt_token:
            try:
                # Decodificar el token JWT para obtener datos únicos
                payload = jwt.decode(jwt_token, Config.JWT_SECRET, algorithms=[Config.JWT_ALGORITHM])
                # Usar una parte del payload decodificado como clave
                key_data = str(payload).encode('utf-8')
                self.key = base64.urlsafe_b64encode(key_data[:32])  # Asegurarse de que la clave tenga 32 bytes
            except jwt.InvalidTokenError:
                raise ValueError("El token JWT proporcionado no es válido.")
        else:
            # Generar una clave aleatoria si no se proporciona un token JWT
            self.key = Fernet.generate_key()

        self.cipher = Fernet(self.key)

    def encrypt_string(self, text):

        if isinstance(text, str):
            text = text.encode('utf-8')
        encrypted_text = self.cipher.encrypt(text)
        return base64.urlsafe_b64encode(encrypted_text).decode('utf-8')
    
    def decrypt_string(self, encrypted_text):

        if isinstance(encrypted_text, str):
            encrypted_text = encrypted_text.encode('utf-8')
        decrypted = self.cipher.decrypt(base64.urlsafe_b64decode(encrypted_text))
        return decrypted.decode('utf-8')
    
    def encrypt_endpoint(self, endpoint):

        parts = endpoint.split('/')

        if len(parts) > 1 and parts[-1]:
            parts[-1] = self.encrypt_string(parts[-1])
            return '/'.join(parts)
        else:
            return endpoint

    def decrypt_endpoint(self, encrypted_endpoint):

        parts = encrypted_endpoint.split('/')

        if len(parts) > 1 and parts[-1]:
            try:
                parts[-1] = self.decrypt_string(parts[-1])
                return '/'.join(parts)
            except Exception:
                # Si hay un error al descifrar, devolvemos el endpoint original
                return encrypted_endpoint
        return encrypted_endpoint