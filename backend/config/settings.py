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
    'channels',
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

# CSRF trusted origins (HTTP para desarrollo local, HTTPS para producción)
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

# Channels layer (in-memory for development; switch to Redis in production)
CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels.layers.InMemoryChannelLayer',
    }
}

# --------- BASE DE DATOS: Docker LOCAL vs NEON ---------
USE_NEON = os.environ.get('USE_NEON', 'False') == 'True'

if USE_NEON:
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

# --- OAuth IDs ---
GOOGLE_CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID')

# GitHub OAuth (state firmado)
GITHUB_CLIENT_ID = os.environ.get('GITHUB_CLIENT_ID')
GITHUB_CLIENT_SECRET = os.environ.get('GITHUB_CLIENT_SECRET')
GITHUB_REDIRECT_URI = os.environ.get('GITHUB_REDIRECT_URI', 'https://localhost:4200/login' if not DEBUG else 'http://localhost:4200/login')
GITHUB_STATE_SALT = os.environ.get('GITHUB_STATE_SALT', 'github-oauth-state')
GITHUB_STATE_TTL_SECONDS = int(os.environ.get('GITHUB_STATE_TTL_SECONDS', '600'))  # 10 min

# Static files (CSS, JavaScript, Images)
STATIC_URL = 'static/'
STATIC_ROOT = os.path.join(BASE_DIR, 'static')

# Default primary key field type
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

AUTH_USER_MODEL = 'core.Usuario'

# ============ HTTPS SECURITY SETTINGS ============
# These settings enhance security and prepare the application for HTTPS deployment
# In development with DEBUG=True, some are relaxed; in production they are enforced

# Security Middleware Settings
# SECURE_SSL_REDIRECT: Redirect all HTTP requests to HTTPS
# Only enable in production with proper HTTPS setup (reverse proxy, load balancer, etc.)
SECURE_SSL_REDIRECT = not DEBUG  # False in development, True in production

# SECURE_PROXY_SSL_HEADER: Trust X-Forwarded-Proto header from proxy/load balancer
# This is important when behind a reverse proxy that terminates SSL
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

# Session cookie security
SESSION_COOKIE_SECURE = not DEBUG  # Send session cookie only over HTTPS in production
SESSION_COOKIE_HTTPONLY = True  # Prevent JavaScript access to session cookie
SESSION_COOKIE_SAMESITE = 'Lax'  # CSRF protection

# CSRF cookie security
CSRF_COOKIE_SECURE = not DEBUG  # Send CSRF cookie only over HTTPS in production
CSRF_COOKIE_HTTPONLY = True  # Prevent JavaScript access to CSRF cookie
CSRF_COOKIE_SAMESITE = 'Lax'  # Additional CSRF protection

# HSTS (HTTP Strict Transport Security)
# Tells browsers to only access the site over HTTPS
# Only enable in production when HTTPS is fully configured
if not DEBUG:
    SECURE_HSTS_SECONDS = 31536000  # 1 year
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True

# Prevent content type sniffing
SECURE_CONTENT_TYPE_NOSNIFF = True

# Enable browser XSS protection
SECURE_BROWSER_XSS_FILTER = True

# Clickjacking protection
X_FRAME_OPTIONS = 'DENY'