# Mejora en app.py para mejor gestión de WebSockets

from flask import Flask, request
from flask_cors import CORS
from config.config import Config
from routes import init_app, socketio
import logging

logger = logging.getLogger(__name__)

def create_app(config_class=Config):
    """Crear y configurar la aplicación Flask con mejor soporte para WebSockets"""
    app = Flask(__name__)
    app.config.from_object(config_class)
    
    # Configurar CORS con opciones más específicas
    CORS(app, resources={
        r"/chat/*": {"origins": "*"},
        r"/api/ws/*": {"origins": "*"}
    }, supports_credentials=True)
    
    # Registrar middleware para autenticar peticiones desde Django
    @app.before_request
    def validate_django_integration():
        if config_class.DJANGO_INTEGRATION:
            # Si viene de Django, verificar la autenticación
            django_token = request.headers.get('X-Django-Integration-Token')
            if not django_token and app.config.get('DJANGO_VALIDATION_REQUIRED', False):
                logger.warning("Petición recibida sin token de integración Django")
    
    # Inicializar rutas y WebSockets con manejo de errores
    try:
        init_app(app)
        logger.info("Aplicación Flask inicializada correctamente")
    except Exception as e:
        logger.error(f"Error al inicializar las rutas de Flask: {str(e)}")
    
    # Añadir soporte para manejar errores de WebSocket
    @socketio.on_error()
    def handle_socket_error(e):
        logger.error(f"Error en WebSocket: {str(e)}")
    
    return app

if __name__ == '__main__':
    app = create_app()
    # Optimizar configuración de Socket.IO
    socketio.run(
        app, 
        host='0.0.0.0', 
        port=5000, 
        debug=Config.DEBUG,
        use_reloader=Config.DEBUG,
        ping_timeout=60,  # Aumentar timeout para conexiones lentas
        ping_interval=25,  # Intervalo de ping para mantener conexiones activas
        cors_allowed_origins="*"  # Permitir WebSockets desde cualquier origen
    )