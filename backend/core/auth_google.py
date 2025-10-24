from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.conf import settings
from django.contrib.auth import get_user_model
from google.oauth2 import id_token
from google.auth.transport import requests as grequests
from rest_framework.permissions import AllowAny
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth.hashers import make_password

User = get_user_model()

class GoogleLoginAPIView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        token = request.data.get("token")
        if not token:
            return Response({"error": "Token is required"}, status=status.HTTP_400_BAD_REQUEST)

        client_id = getattr(settings, "GOOGLE_CLIENT_ID", None)
        if not client_id:
            return Response({"error": "GOOGLE_CLIENT_ID not configured"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        try:
            idinfo = id_token.verify_oauth2_token(token, grequests.Request(), client_id)
        except Exception:
            return Response({"error": "Invalid token"}, status=status.HTTP_400_BAD_REQUEST)

        email = idinfo.get("email")
        email_verified = idinfo.get("email_verified", False)
        name = idinfo.get("name") or (email.split("@")[0] if email else "")

        if not email or not email_verified:
            return Response({"error": "Email is missing or not verified"}, status=status.HTTP_400_BAD_REQUEST)

        user, created = User.objects.get_or_create(
            correo=email,
            defaults={
                "nombre": name,
                "pais": "",
                "pasaporte": "",
                "rol": "usuario",
                "contrasenia": make_password(None),
                "is_staff": False,
                "estado": True,
            },
        )
        if created:
            user.set_password(None)
            user.save(update_fields=["contrasenia"])

        refresh = RefreshToken.for_user(user)
        usuario_payload = {
            "id": user.id,
            "nombre": user.nombre,
            "correo": user.correo,
            "rol": user.rol,
            "pais": user.pais,
            "pasaporte": user.pasaporte,
            "estado": user.estado
        }
        return Response(
            {
                "refresh": str(refresh),
                "access": str(refresh.access_token),
                "usuario": usuario_payload,
            },
            status=status.HTTP_200_OK,
        )