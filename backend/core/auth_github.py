import requests
from django.conf import settings
from django.utils import timezone
from django.core import signing
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework import status
from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import make_password
from rest_framework_simplejwt.tokens import RefreshToken

User = get_user_model()

def build_github_authorize_url(state: str) -> str:
    client_id = settings.GITHUB_CLIENT_ID
    redirect_uri = settings.GITHUB_REDIRECT_URI
    scope = "user:email"
    base = "https://github.com/login/oauth/authorize"
    return f"{base}?client_id={client_id}&redirect_uri={redirect_uri}&scope={scope}&state={state}&allow_signup=true"

class GitHubLoginURLAPIView(APIView):
    """
    GET /api/auth/github/login-url/
    Genera un state firmado y devuelve la URL para autorizar con GitHub.
    """
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        if not settings.GITHUB_CLIENT_ID or not settings.GITHUB_REDIRECT_URI:
            return Response({"error": "GitHub OAuth not configured"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        payload = {
            "ts": int(timezone.now().timestamp()),
            "nonce": signing.get_cookie_signer(salt="nonce").signature(str(timezone.now().timestamp())),
        }
        signed_state = signing.TimestampSigner(salt=settings.GITHUB_STATE_SALT).sign_object(payload)
        authorize_url = build_github_authorize_url(signed_state)
        return Response({"authorize_url": authorize_url, "state": signed_state})

class GitHubExchangeCodeAPIView(APIView):
    """
    POST /api/auth/github/exchange/
    Body: { "code": "...", "state": "..." }
    Valida el state, intercambia code -> access_token, obtiene email y retorna JWT+usuario.
    """
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        code = request.data.get("code")
        state = request.data.get("state")
        if not code or not state:
            return Response({"error": "code and state are required"}, status=status.HTTP_400_BAD_REQUEST)

        client_id = settings.GITHUB_CLIENT_ID
        client_secret = settings.GITHUB_CLIENT_SECRET
        redirect_uri = settings.GITHUB_REDIRECT_URI
        if not client_id or not client_secret or not redirect_uri:
            return Response({"error": "GitHub OAuth not configured"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # 1) Validar state firmado con TTL
        try:
            signing.TimestampSigner(salt=settings.GITHUB_STATE_SALT).unsign_object(
                state, max_age=settings.GITHUB_STATE_TTL_SECONDS
            )
        except signing.BadSignature:
            return Response({"error": "Invalid state signature"}, status=status.HTTP_400_BAD_REQUEST)
        except signing.SignatureExpired:
            return Response({"error": "State expired"}, status=status.HTTP_400_BAD_REQUEST)

        # 2) Intercambiar code -> access_token
        token_url = "https://github.com/login/oauth/access_token"
        headers = {"Accept": "application/json"}
        data = {
            "client_id": client_id,
            "client_secret": client_secret,
            "code": code,
            "redirect_uri": redirect_uri,
        }
        token_resp = requests.post(token_url, headers=headers, data=data, timeout=15)
        if token_resp.status_code >= 400:
            return Response({"error": "GitHub token exchange failed"}, status=status.HTTP_400_BAD_REQUEST)
        token_json = token_resp.json()
        access_token = token_json.get("access_token")
        if not access_token:
            return Response({"error": "No access_token from GitHub", "details": token_json}, status=status.HTTP_400_BAD_REQUEST)

        # 3) Obtener datos del usuario
        api_headers = {
            "Authorization": f"Bearer {access_token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }
        user_resp = requests.get("https://api.github.com/user", headers=api_headers, timeout=15)
        if user_resp.status_code >= 400:
            return Response({"error": "Failed to fetch GitHub user"}, status=status.HTTP_400_BAD_REQUEST)
        gh_user = user_resp.json()
        email = gh_user.get("email")
        name = gh_user.get("name") or gh_user.get("login") or ""

        if not email:
            emails_resp = requests.get("https://api.github.com/user/emails", headers=api_headers, timeout=15)
            if emails_resp.status_code < 400:
                emails_list = emails_resp.json()
                primary_verified = next((e["email"] for e in emails_list if e.get("primary") and e.get("verified")), None)
                email = primary_verified or (emails_list[0]["email"] if emails_list else None)

        if not email:
            return Response({"error": "GitHub account has no accessible email"}, status=status.HTTP_400_BAD_REQUEST)

        # 4) Crear/obtener Usuario (tu modelo exige nombre, pais, pasaporte, contrasenia)
        user, created = User.objects.get_or_create(
            correo=email,
            defaults={
                "nombre": name or (email.split("@")[0]),
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

        # 5) Emitir JWT
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
            {"refresh": str(refresh), "access": str(refresh.access_token), "usuario": usuario_payload},
            status=status.HTTP_200_OK
        )