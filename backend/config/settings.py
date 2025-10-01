import os
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
    'rest_framework',
    'core',
    'corsheaders',
]

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.AllowAny',
    ],
}

# Middleware: corsheaders debe ir primero
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

# CORS: permite todas las conexiones (solo para desarrollo)
CORS_ALLOW_ALL_ORIGINS = True

# CSRF trusted origins, importante para frontend en docker/local
CSRF_TRUSTED_ORIGINS = [
    "http://localhost:4200",
    "http://127.0.0.1:4200",
    "http://frontend:4200",
    "http://backend:8000",
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

# --------- BASE DE DATOS: Docker LOCAL vs NEON ---------
USE_NEON = os.environ.get('USE_NEON', 'False') == 'True'

if USE_NEON:
    # Configuración para NeonDB
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': os.environ.get('NEON_DB', 'neondb'),
            'USER': os.environ.get('NEON_USER', 'neondb_owner'),
            'PASSWORD': os.environ.get('NEON_PASSWORD', 'npg_crb8OuHVzx5Y'),
            'HOST': os.environ.get('NEON_HOST', 'ep-long-dust-a8ys3fe8-pooler.eastus2.azure.neon.tech'),
            'PORT': os.environ.get('NEON_PORT', '5432'),
            'OPTIONS': {
                'sslmode': 'require',
                'channel_binding': 'require',
            }
        }
    }
else:
    # Configuración para Postgres en Docker (servicio db:)
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

# -------------------------------------------------------

# Static files (CSS, JavaScript, Images)
STATIC_URL = 'static/'
STATIC_ROOT = os.path.join(BASE_DIR, 'static')

# Default primary key field type
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'