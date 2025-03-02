from flask import Flask
from flask_cors import CORS
from config.config import Config
from routes import init_app, socketio

def create_app(config_class=Config):
    """Crear y configurar la aplicación Flask"""
    app = Flask(__name__)
    app.config.from_object(config_class)
    
    # Configurar CORS
    CORS(app)
    
    # Inicializar rutas y WebSockets
    init_app(app)
    
    return app

if __name__ == '__main__':
    app = create_app()
    # Usar socketio.run en lugar de app.run para habilitar WebSockets
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)