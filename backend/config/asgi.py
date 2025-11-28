import os
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

django_asgi_app = get_asgi_application()

# Importa el routing de la app 'core' que contiene websocket_urlpatterns
try:
    from core.routing import websocket_urlpatterns
except Exception:
    websocket_urlpatterns = []

# Si necesitas autenticación vía AuthMiddlewareStack (cookies/sesiones),
# puedes envolver el URLRouter. Para JWT vía querystring, no es necesario.
# from channels.auth import AuthMiddlewareStack
# application = ProtocolTypeRouter({
#     "http": django_asgi_app,
#     "websocket": AuthMiddlewareStack(URLRouter(websocket_urlpatterns)),
# })

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": URLRouter(websocket_urlpatterns),
})