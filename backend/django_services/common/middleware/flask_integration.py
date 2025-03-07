import re
import sys
import os
import logging
import importlib.util
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
        
        # Asegurarse que la ruta absoluta de la app Flask esté en sys.path
        flask_app_path_abs = os.path.abspath(flask_app_path)
        
        # Verificar si el directorio existe
        if not os.path.exists(flask_app_path_abs):
            logger.error(f"El directorio de la aplicación Flask no existe: {flask_app_path_abs}")
            return
            
        # Listado de archivos en el directorio para debug
        logger.debug(f"Archivos en {flask_app_path_abs}: {os.listdir(flask_app_path_abs)}")
        
        try:
            # Crear archivo __init__.py temporalmente en la carpeta config si no existe
            config_dir = os.path.join(flask_app_path_abs, "config")
            init_file_path = os.path.join(config_dir, "__init__.py")
            init_file_created = False
            
            if os.path.exists(config_dir) and not os.path.exists(init_file_path):
                try:
                    # Crear un archivo __init__.py vacío para que Python reconozca el directorio como paquete
                    with open(init_file_path, 'w') as f:
                        pass
                    init_file_created = True
                    logger.info(f"Archivo __init__.py creado temporalmente en {config_dir}")
                except Exception as e:
                    logger.warning(f"No se pudo crear archivo __init__.py temporal: {str(e)}")
            
            # Guardar el sys.path original
            original_path = sys.path.copy()
            
            try:
                # Añadir el directorio de Flask al inicio del sys.path para darle prioridad
                if flask_app_path_abs not in sys.path:
                    sys.path.insert(0, flask_app_path_abs)
                
                # Añadir también el directorio padre para importaciones relativas
                flask_parent_path = os.path.dirname(flask_app_path_abs)
                if flask_parent_path not in sys.path:
                    sys.path.insert(0, flask_parent_path)
                
                # Comprobar los módulos en sys.modules y limpiar los que pueden conflictar
                modules_to_remove = []
                for mod_name in list(sys.modules.keys()):
                    if mod_name == 'config' or mod_name.startswith('config.'):
                        modules_to_remove.append(mod_name)
                
                # Eliminar los módulos identificados
                for mod_name in modules_to_remove:
                    if mod_name in sys.modules:
                        del sys.modules[mod_name]
                        logger.debug(f"Eliminado módulo {mod_name} de sys.modules")
                
                # Intentar importar la configuración de Flask directamente con importlib
                config_file_path = os.path.join(config_dir, "config.py")
                if os.path.exists(config_file_path):
                    spec = importlib.util.spec_from_file_location("flask_config_module", config_file_path)
                    if spec:
                        flask_config_module = importlib.util.module_from_spec(spec)
                        spec.loader.exec_module(flask_config_module)
                        if hasattr(flask_config_module, 'Config'):
                            logger.info("Configuración de Flask importada correctamente mediante importlib")
                        else:
                            logger.error("config.py existe pero no tiene una clase Config")
                else:
                    logger.error(f"Archivo config.py no encontrado en {config_dir}")
                
                # Imprimir todos los archivos en el directorio para debug
                logger.debug(f"Contenido de {flask_app_path_abs}: {os.listdir(flask_app_path_abs)}")
                
                # Intentar importar la app Flask con importlib
                app_file_path = os.path.join(flask_app_path_abs, "app.py")
                if os.path.exists(app_file_path):
                    spec = importlib.util.spec_from_file_location("flask_app_module", app_file_path)
                    if spec:
                        flask_app_module = importlib.util.module_from_spec(spec)
                        sys.modules[spec.name] = flask_app_module
                        spec.loader.exec_module(flask_app_module)
                        
                        if hasattr(flask_app_module, 'create_app'):
                            logger.info("Función create_app importada correctamente mediante importlib")
                            self.flask_app = flask_app_module.create_app()
                            logger.info(f"Aplicación Flask inicializada correctamente desde {flask_app_path_abs}")
                        else:
                            logger.error("app.py existe pero no tiene una función create_app")
                else:
                    logger.error(f"Archivo app.py no encontrado en {flask_app_path_abs}")
                
                # Si no se pudo cargar con importlib, intentar método tradicional como último recurso
                if not self.flask_app:
                    try:
                        # Imprimir el sys.path actual para debug
                        logger.debug(f"sys.path actual: {sys.path}")
                        
                        # Intentar importar la app Flask
                        import app
                        if hasattr(app, 'create_app'):
                            logger.info("Función create_app importada correctamente usando import tradicional")
                            self.flask_app = app.create_app()
                            logger.info(f"Aplicación Flask inicializada correctamente desde {flask_app_path_abs}")
                        else:
                            logger.error("Módulo app importado pero no tiene una función create_app")
                    except ImportError as e:
                        logger.error(f"No se pudo importar 'app': {str(e)}")
                        self.flask_app = None
                
            except Exception as e:
                logger.exception(f"Error al inicializar la aplicación Flask: {str(e)}")
                self.flask_app = None
            
            finally:
                # Restaurar sys.path original
                sys.path = original_path
                
                # Eliminar el archivo __init__.py temporal si lo creamos
                if init_file_created and os.path.exists(init_file_path):
                    try:
                        os.remove(init_file_path)
                        logger.info(f"Archivo __init__.py temporal eliminado de {config_dir}")
                    except Exception as e:
                        logger.warning(f"No se pudo eliminar el archivo __init__.py temporal: {str(e)}")
                
        except Exception as e:
            logger.exception(f"Error inesperado en setup_flask_integration: {str(e)}")
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