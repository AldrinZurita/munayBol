import urllib.parse
import logging
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from channels.db import database_sync_to_async
from django.conf import settings
from rest_framework_simplejwt.backends import TokenBackend
from django.contrib.auth import get_user_model

User = get_user_model()

class NotificationConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        # Expect token in querystring: ws://host/ws/notifications/?token=...
        raw_qs = self.scope.get('query_string', b'').decode()
        params = urllib.parse.parse_qs(raw_qs)
        token = (params.get('token') or [None])[0]
        self.user = None
        self.group_name = None
        if token:
            user_id = await self._get_user_id_from_token(token)
            if user_id:
                self.user = await self._get_user(user_id)
        if self.user is None:
            logging.getLogger(__name__).warning("WS reject: invalid or missing token")
            await self.close()
            return
        self.group_name = f"user_{self.user.id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if self.group_name:
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def notify(self, event):
        # Send a simple event to client
        await self.send_json({
            "type": "notification",
            "payload": event.get("payload", {})
        })

    @database_sync_to_async
    def _get_user(self, user_id):
        try:
            return User.objects.get(id=user_id, estado=True)
        except User.DoesNotExist:
            return None

    @database_sync_to_async
    def _get_user_id_from_token(self, token):
        try:
            signing_key = getattr(settings, 'SIMPLE_JWT', {}).get('SIGNING_KEY', settings.SECRET_KEY)
            backend = TokenBackend(algorithm='HS256', signing_key=signing_key)
            data = backend.decode(token, verify=True)
            return data.get('user_id')
        except Exception:
            return None