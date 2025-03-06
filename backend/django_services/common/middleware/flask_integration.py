import re
import sys
import os
import logging
from urllib.parse import urlparse
from werkzeug.wsgi import get_host
from django.conf import settings
from werkzeug.middleware.dispatcher import DispatcherMiddleware
from werkzeug.exceptions import NotFound
from django.utils.deprecation import MiddlewareMixin
from django.http import HttpResponse, HttpResponseServerError

logger = logging.getLogger(__name__)

class FlaskDjangoIntegration(MiddlewareMixin):

    async_mode = None
    
    def __init__(self, get_response):
        self.get_response = get_response
        self.flask_app = None
        self.flask_routes = []
        self.setup_flask_integration()

    def setup_flask_integration(self):
        
        if not getattr(settings, 'FLASK_INTEGRATION', {}).get('ENABLED', False):
            logger.info("Integración Flask-Django no está habilitada en settings")
            return
        
        flask_config = settings.FLASK_INTEGRATION
        self.flask_routes = flask_config.get('FLASK_ROUTES', [])
        
        # Verificar si hay rutas configuradas
        if not self.flask_routes:
            logger.warning("Integración Flask habilitada pero no hay rutas configuradas")
            return
        
        # Obtener la ruta a la aplicación Flask
        flask_app_path = flask_config.get('FLASK_APP_PATH')
        if not flask_app_path:
            logger.error("FLASK_APP_PATH no está configurado en settings.FLASK_INTEGRATION")
            return
        
        # Asegurarse que la ruta de la app Flask esté en sys.path
        if flask_app_path not in sys.path:
            sys.path.append(flask_app_path)
        
        try:
            # Intentar importar la app Flask
            from app import create_app
            self.flask_app = create_app()
            logger.info(f"Aplicación Flask importada correctamente desde {flask_app_path}")
        except ImportError as e:
            logger.error(f"Error al importar aplicación Flask: {str(e)}")
            self.flask_app = None
        except Exception as e:
            logger.error(f"Error inesperado al inicializar aplicación Flask: {str(e)}")
            self.flask_app = None
    
    def should_handle_with_flask(self, path):
        """Determina si una ruta debe ser manejada por Flask"""
        if not self.flask_app or not self.flask_routes:
            return False
        
        # Verificar si la ruta comienza con alguno de los prefijos configurados
        for route_prefix in self.flask_routes:
            if path.startswith(route_prefix):
                return True
        
        return False
    
    def process_view(self, request, view_func, view_args, view_kwargs):

        path = request.path
        
        if not self.should_handle_with_flask(path):
            # Dejar que Django maneje la petición
            return None
        
        # Esta ruta debe ser manejada por Flask
        logger.debug(f"Redirigiendo petición a Flask: {path}")
        
        # Verificar que la aplicación Flask esté disponible
        if not self.flask_app:
            logger.error(f"Se intentó redirigir {path} a Flask, pero la aplicación Flask no está disponible")
            return HttpResponseServerError("Servicio Flask no disponible")
        
        try:
            # Crear un entorno WSGI para Flask
            environ = self.get_wsgi_environ(request)
            
            # Obtener la respuesta de la aplicación Flask
            def start_response(status, headers):
                status_code = int(status.split(' ')[0])
                response.status_code = status_code
                for header, value in headers:
                    response[header] = value
            
            from django.http import HttpResponse
            response = HttpResponse()
            
            # Ejecutar la aplicación Flask con este entorno
            output = self.flask_app(environ, start_response)
            
            # Convertir la respuesta de Flask a una respuesta Django
            response.content = b''.join(output)
            
            return response
        except Exception as e:
            logger.exception(f"Error al procesar la petición con Flask: {str(e)}")
            return HttpResponseServerError("Error al procesar la petición con Flask")
    
    def get_wsgi_environ(self, request):

        # Usar getattr para acceder a la caché o crearla si no existe
        if not hasattr(self, '_environ_static_cache'):
            # Valores que no cambian entre peticiones
            self._environ_static_cache = {
                'wsgi.version': (1, 0),
                'wsgi.multithread': True,
                'wsgi.multiprocess': True,
                'wsgi.run_once': False,
                'SERVER_SOFTWARE': 'Django',
            }
        
        # Crear entorno copiando primero la caché para reducir asignaciones
        environ = self._environ_static_cache.copy()
        
        # Añadir los valores dinámicos específicos de la petición
        environ.update({
            'wsgi.input': request,
            'wsgi.errors': sys.stderr,
            'wsgi.url_scheme': request.scheme,
            'REQUEST_METHOD': request.method,
            'PATH_INFO': request.path,
            'QUERY_STRING': request.META.get('QUERY_STRING', ''),
            'CONTENT_TYPE': request.META.get('CONTENT_TYPE', ''),
            'CONTENT_LENGTH': request.META.get('CONTENT_LENGTH', ''),
            'REMOTE_ADDR': request.META.get('REMOTE_ADDR', ''),
            'REMOTE_HOST': request.META.get('REMOTE_HOST', ''),
            'SERVER_NAME': request.META.get('SERVER_NAME', ''),
            'SERVER_PORT': request.META.get('SERVER_PORT', ''),
            'SERVER_PROTOCOL': request.META.get('SERVER_PROTOCOL', ''),
        })
        
        # Copiar solo las cabeceras HTTP necesarias
        for key, value in request.META.items():
            if key.startswith('HTTP_'):
                environ[key] = value
        
        return environ