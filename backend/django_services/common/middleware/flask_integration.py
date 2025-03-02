import re
from urllib.parse import urlparse
from werkzeug.wsgi import get_host
from django.conf import settings
from werkzeug.middleware.dispatcher import DispatcherMiddleware
from werkzeug.exceptions import NotFound

class FlaskDjangoIntegration:

