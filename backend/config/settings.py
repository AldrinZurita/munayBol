import os
from datetime import timedelta
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', '$^%pi-f!4s2z*o!+-um9)n6fe^xh!hf96ql41ml#g-$g%qqgg1')
DEBUG = os.environ.get('DJANGO_DEBUG', 'True') == 'True'
ALLOWED_HOSTS = os.environ.get('DJANGO_ALLOWED_HOSTS', 'localhost 127.0.0.1 backend 0.0.0.0').split()

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
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

CORS_ALLOW_ALL_ORIGINS = True
CSRF_TRUSTED_ORIGINS = [
    "http://localhost:4200",
    "http://127.0.0.1:4200",
    "http://frontend:4200",
    "http://backend:8000",
    "https://localhost:4200",
    "https://127.0.0.1:4200",
]

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

# Channel layers (InMemory para desarrollo)
CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels.layers.InMemoryChannelLayer',
    }
}
# Para producción, considera Redis:
# CHANNEL_LAYERS = {
#     'default': {
#         'BACKEND': 'channels_redis.core.RedisChannelLayer',
#         'CONFIG': {
#             'hosts': [os.environ.get('REDIS_URL', 'redis://localhost:6379')],
#         },
#     },
# }

# Parámetros para conexiones estables a DB (Neon)
DEFAULT_CONN_MAX_AGE = int(os.environ.get('DB_CONN_MAX_AGE', '120'))
DEFAULT_DB_KEEPALIVES = int(os.environ.get('DB_KEEPALIVES', '1'))
DEFAULT_DB_KEEPALIVES_IDLE = int(os.environ.get('DB_KEEPALIVES_IDLE', '30'))
DEFAULT_DB_KEEPALIVES_INTERVAL = int(os.environ.get('DB_KEEPALIVES_INTERVAL', '10'))
DEFAULT_DB_KEEPALIVES_COUNT = int(os.environ.get('DB_KEEPALIVES_COUNT', '5'))

USE_NEON = os.environ.get('USE_NEON', 'False') == 'True'

if USE_NEON:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': os.environ.get('NEON_DB', 'neondb'),
            'USER': os.environ.get('NEON_USER', 'neondb_owner'),
            'PASSWORD': os.environ.get('NEON_PASSWORD', ''),
            'HOST': os.environ.get('NEON_HOST', ''),
            'PORT': os.environ.get('NEON_PORT', '5432'),
            'CONN_MAX_AGE': DEFAULT_CONN_MAX_AGE,
            'CONN_HEALTH_CHECKS': True,
            'OPTIONS': {
                'sslmode': 'require',
                'keepalives': DEFAULT_DB_KEEPALIVES,
                'keepalives_idle': DEFAULT_DB_KEEPALIVES_IDLE,
                'keepalives_interval': DEFAULT_DB_KEEPALIVES_INTERVAL,
                'keepalives_count': DEFAULT_DB_KEEPALIVES_COUNT,
            }
        }
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': os.environ.get('POSTGRES_DB', 'turismo'),
            'USER': os.environ.get('POSTGRES_USER', 'turismo'),
            'PASSWORD': os.environ.get('POSTGRES_PASSWORD', 'turismo'),
            'HOST': os.environ.get('POSTGRES_HOST', 'db'),
            'PORT': os.environ.get('POSTGRES_PORT', '5432'),
            'CONN_MAX_AGE': DEFAULT_CONN_MAX_AGE,
            'CONN_HEALTH_CHECKS': True,
            'OPTIONS': {
                'keepalives': DEFAULT_DB_KEEPALIVES,
                'keepalives_idle': DEFAULT_DB_KEEPALIVES_IDLE,
                'keepalives_interval': DEFAULT_DB_KEEPALIVES_INTERVAL,
                'keepalives_count': DEFAULT_DB_KEEPALIVES_COUNT,
            }
        }
    }

GOOGLE_CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID')
GITHUB_CLIENT_ID = os.environ.get('GITHUB_CLIENT_ID')
GITHUB_CLIENT_SECRET = os.environ.get('GITHUB_CLIENT_SECRET')
GITHUB_REDIRECT_URI = os.environ.get('GITHUB_REDIRECT_URI', 'https://localhost:4200/login' if not DEBUG else 'http://localhost:4200/login')
GITHUB_STATE_SALT = os.environ.get('GITHUB_STATE_SALT', 'github-oauth-state')
GITHUB_STATE_TTL_SECONDS = int(os.environ.get('GITHUB_STATE_TTL_SECONDS', '600'))  # 10 min

STATIC_URL = 'static/'
STATIC_ROOT = os.path.join(BASE_DIR, 'static')

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
AUTH_USER_MODEL = 'core.Usuario'

SECURE_SSL_REDIRECT = not DEBUG
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
SESSION_COOKIE_SECURE = not DEBUG
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = 'Lax'
CSRF_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_HTTPONLY = True
CSRF_COOKIE_SAMESITE = 'Lax'
if not DEBUG:
    SECURE_HSTS_SECONDS = 31536000  # 1 año
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_BROWSER_XSS_FILTER = True
X_FRAME_OPTIONS = 'DENY'