from cryptography.fernet import Fernet
import base64
import os

class Encryption:

    def __init__(self, key=None):
        
        if key:
            self.key = key
        else:
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