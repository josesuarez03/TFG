import os
from pathlib import Path
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.getenv('DJANGO_SECRET_KEY')  
DEBUG = os.getenv('DEBUG') == 'True'
ALLOWED_HOSTS = os.getenv('ALLOWED_HOSTS', '*').split(',')

INSTALLED_APPS = [
    'django.contrib.contenttypes',
    'django.contrib.auth',
    'django.contrib.sessions',

    # DRF y autenticación
    'rest_framework',
    'rest_framework_simplejwt',
    'dj_rest_auth',
    'oauth2_provider',  
    'social_django', 

    # Seguridad y CORS
    'corsheaders',

    # App de usuarios personalizada
    'users',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'corsheaders.middleware.CorsMiddleware',  # Habilita CORS
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django_services.common.middleware.flask_integration.FlaskDjangoIntegration',  # Middleware para la integración con Flask
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

FLASK_INTEGRATION = {
    'ENABLED': True,
    'FLASK_ROUTES': [
        '/chat/',  # Rutas que serán manejadas por Flask
    ],
    'FLASK_APP_PATH': os.path.join(BASE_DIR, '..', 'flask-services', 'src'),
    'FLASK_BASE_URL': os.getenv('FLASK_BASE_URL'),
}


CORS_ALLOW_ALL_ORIGINS = True  # Puedes restringirlo en producción

ROOT_URLCONF = 'django_services.urls'
WSGI_APPLICATION = 'django_services.wsgi.application'

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.getenv('POSTGRES_DB'),
        'USER': os.getenv('POSTGRES_USER'),
        'PASSWORD': os.getenv('POSTGRES_PASSWORD'),
        'HOST': os.getenv('POSTGRES_HOST'),
        'PORT': os.getenv('POSTGRES_PORT'),
    }
}

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
        'oauth2_provider.contrib.rest_framework.OAuth2Authentication',
    ),
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(days=1),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'SIGNING_KEY': SECRET_KEY,
    'AUTH_HEADER_TYPES': ('Bearer',),
}

OAUTH2_PROVIDER = {
    "ACCESS_TOKEN_EXPIRE_SECONDS": 3600,
    "REFRESH_TOKEN_EXPIRE_SECONDS": 86400,
    "SCOPES": {
        "read": "Leer datos",
        "write": "Modificar datos",
    },
}

# Configuración específica para Google OAuth
AUTHENTICATION_BACKENDS = (
    'social_core.backends.google.GoogleOAuth2',
    'django.contrib.auth.backends.ModelBackend',
)

SOCIAL_AUTH_GOOGLE_OAUTH2_KEY = os.getenv('GOOGLE_CLIENT_ID')
SOCIAL_AUTH_GOOGLE_OAUTH2_SECRET = os.getenv('GOOGLE_CLIENT_SECRET')
SOCIAL_AUTH_GOOGLE_OAUTH2_SCOPE = ['email', 'profile']
SOCIAL_AUTH_GOOGLE_OAUTH2_AUTH_EXTRA_ARGUMENTS = {
    'access_type': 'offline',
    'prompt': 'select_account'
}

REST_USE_JWT = True
ACCOUNT_AUTHENTICATION_METHOD = "email"
ACCOUNT_EMAIL_REQUIRED = True
ACCOUNT_USERNAME_REQUIRED = False
ACCOUNT_EMAIL_VERIFICATION = "optional"

AUTH_USER_MODEL = 'users.User'
SESSION_COOKIE_AGE = 3600  # 1 hora de sesión
SESSION_ENGINE = 'django.contrib.sessions.backends.db'

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = False
USE_TZ = True

STATIC_URL = '/static/'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'