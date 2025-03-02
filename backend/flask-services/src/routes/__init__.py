from flask import Blueprint
from flask_socketio import SocketIO

# Inicializar SocketIO
socketio = SocketIO(cors_allowed_origins="*")

bp = Blueprint('chat', __name__, url_prefix='/chat')

from . import chat_routes, sockets_events

def init_app(app):
    """Inicializar todas las rutas y WebSockets con la aplicación Flask"""
    # Registrar blueprint
    app.register_blueprint(bp)
    
    # Inicializar SocketIO
    socketio.init_app(app)