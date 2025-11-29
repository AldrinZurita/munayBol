import os
from datetime import timedelta
from pathlib import Path
import dj_database_url  # <--- NUEVO: Necesario para leer la DB en Render

BASE_DIR = Path(__file__).resolve().parent.parent

# --- CONFIGURACIÓN DE ENTORNO (DETECTAR RENDER) ---
# Si existe la variable RENDER, estamos en producción
RENDER = os.environ.get('RENDER')
# DEBUG es True por defecto, pero False si estamos en Render
DEBUG = 'RENDER' not in os.environ

# SECRET_KEY: En producción la toma del entorno, en local usa la insegura por defecto
SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', '$^%pi-f!4s2z*o!+-um9)n6fe^xh!hf96ql41ml#g-$g%qqgg1')

# --- ALLOWED HOSTS ---
ALLOWED_HOSTS = []
RENDER_EXTERNAL_HOSTNAME = os.environ.get('RENDER_EXTERNAL_HOSTNAME')
if RENDER_EXTERNAL_HOSTNAME:
    ALLOWED_HOSTS.append(RENDER_EXTERNAL_HOSTNAME)
# Siempre permitimos localhost para desarrollo y conexiones internas
ALLOWED_HOSTS.extend(['127.0.0.1', 'localhost', 'backend', '0.0.0.0'])


INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'drf_yasg',
    'rest_framework',
    'rest_framework_simplejwt',
    'channels',     # Channels para WebSockets
    'core',
    'corsheaders',
]

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.AllowAny',
    ],
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=12),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'AUTH_HEADER_TYPES': ('Bearer',),
}

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    "whitenoise.middleware.WhiteNoiseMiddleware", # <--- NUEVO: Vital para estilos en Render
    'django.contrib.sessions.middleware.SessionMiddleware',
    'corsheaders.middleware.CorsMiddleware',      # Cors debe ir antes de Common
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

# --- CORS & CSRF ---
CORS_ALLOW_ALL_ORIGINS = True # Mantenemos esto para evitar dolores de cabeza en tu entrega

# Definimos los orígenes confiables para CSRF
CSRF_TRUSTED_ORIGINS = [
    "http://localhost:4200",
    "http://127.0.0.1:4200",
    "http://frontend:4200",
    "http://backend:8000",
    "https://localhost:4200",
    "https://127.0.0.1:4200",
]
# Si estamos en render, confiamos en el host externo
if RENDER_EXTERNAL_HOSTNAME:
    CSRF_TRUSTED_ORIGINS.append(f"https://{RENDER_EXTERNAL_HOSTNAME}")


ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'
ASGI_APPLICATION = 'config.asgi.application'

# Channel layers (InMemory para desarrollo y prod simple)
CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels.layers.InMemoryChannelLayer',
    }
}

# --- BASE DE DATOS ---
# Lógica: 1. Intenta usar DATABASE_URL (Render). 2. Si no, usa configuración manual NEON. 3. Local.

DEFAULT_CONN_MAX_AGE = int(os.environ.get('DB_CONN_MAX_AGE', '120'))

if os.environ.get('DATABASE_URL'):
    # CASO 1: RENDER (Automático)
    DATABASES = {
        'default': dj_database_url.config(
            default=os.environ.get('DATABASE_URL'),
            conn_max_age=DEFAULT_CONN_MAX_AGE,
            conn_health_checks=True,
            ssl_require=True
        )
    }
elif os.environ.get('USE_NEON', 'False') == 'True':
    # CASO 2: NEON MANUAL (Tu config original)
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': os.environ.get('NEON_DB', 'neondb'),
            'USER': os.environ.get('NEON_USER', 'neondb_owner'),
            'PASSWORD': os.environ.get('NEON_PASSWORD', ''),
            'HOST': os.environ.get('NEON_HOST', ''),
            'PORT': os.environ.get('NEON_PORT', '5432'),
            'CONN_MAX_AGE': DEFAULT_CONN_MAX_AGE,
            'OPTIONS': {'sslmode': 'require'}
        }
    }
else:
    # CASO 3: DOCKER LOCAL
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': os.environ.get('POSTGRES_DB', 'turismo'),
            'USER': os.environ.get('POSTGRES_USER', 'turismo'),
            'PASSWORD': os.environ.get('POSTGRES_PASSWORD', 'turismo'),
            'HOST': os.environ.get('POSTGRES_HOST', 'db'),
            'PORT': os.environ.get('POSTGRES_PORT', '5432'),
        }
    }

# --- OAUTH ---
GOOGLE_CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID')
GITHUB_CLIENT_ID = os.environ.get('GITHUB_CLIENT_ID')
GITHUB_CLIENT_SECRET = os.environ.get('GITHUB_CLIENT_SECRET')
GITHUB_REDIRECT_URI = os.environ.get('GITHUB_REDIRECT_URI', 'https://localhost:4200/login' if DEBUG else 'http://localhost:4200/login')
GITHUB_STATE_SALT = os.environ.get('GITHUB_STATE_SALT', 'github-oauth-state')
GITHUB_STATE_TTL_SECONDS = int(os.environ.get('GITHUB_STATE_TTL_SECONDS', '600'))

# --- ARCHIVOS ESTÁTICOS (MODIFICADO PARA WHITENOISE) ---
STATIC_URL = 'static/'
# Carpeta donde se recolectarán los estáticos en producción
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')

if not DEBUG:
    # Compresión y cacheo eficiente para producción
    STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
AUTH_USER_MODEL = 'core.Usuario'

# --- SEGURIDAD SSL ---
if not DEBUG:
    # Configuraciones estrictas solo para producción (Render maneja SSL automáticamente)
    SECURE_SSL_REDIRECT = True
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = 31536000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    SECURE_BROWSER_XSS_FILTER = True
    X_FRAME_OPTIONS = 'DENY'
else:
    # Desarrollo local: relajamos la seguridad para evitar errores con http://
    SECURE_SSL_REDIRECT = False
    SESSION_COOKIE_SECURE = False
    CSRF_COOKIE_SECURE = False