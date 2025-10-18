"""
ASGI config with Django Channels for munayBol.
"""
import os
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from django.urls import re_path
from django.conf import settings

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

django_asgi_app = get_asgi_application()

try:
	from core.routing import websocket_urlpatterns
except Exception:
	websocket_urlpatterns = []

application = ProtocolTypeRouter({
	"http": django_asgi_app,
	"websocket": URLRouter(websocket_urlpatterns),
})
