from rest_framework import viewsets, status, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from django.http import HttpResponse
from .models import Usuario, Hotel, LugarTuristico, Pago, Habitacion, Reserva, Paquete, Sugerencias
from .serializers import (
    UsuarioSerializer, HotelSerializer, LugarTuristicoSerializer, PagoSerializer,
    HabitacionSerializer, ReservaSerializer, PaqueteSerializer, SugerenciasSerializer,
    LoginSerializer, RegistroSerializer
)
from .permissions import IsSuperAdmin, IsUsuario
from .llm_client import get_llm_response, send_message
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from datetime import date, timedelta
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth.hashers import check_password

def home(request):
    return HttpResponse("Bienvenido a la API MunayBol")

class HabitacionDisponibilidadView(APIView):
    permission_classes = [AllowAny]
    def get(self, request, num):
        try:
            habitacion = Habitacion.objects.get(pk=num)
        except Habitacion.DoesNotExist:
            return Response({"error": "Habitación no encontrada"}, status=404)
        desde_str = request.query_params.get('desde')
        hasta_str = request.query_params.get('hasta')
        try:
            ventana_desde = date.fromisoformat(desde_str) if desde_str else date.today()
        except ValueError:
            return Response({"error": "Formato inválido en 'desde'"}, status=400)
        try:
            ventana_hasta = date.fromisoformat(hasta_str) if hasta_str else (date.today() + timedelta(days=90))
        except ValueError:
            return Response({"error": "Formato inválido en 'hasta'"}, status=400)
        if ventana_hasta < ventana_desde:
            return Response({"error": "'hasta' no puede ser anterior a 'desde'"}, status=400)
        reservas = (Reserva.objects
                    .filter(num_habitacion=habitacion,
                            fecha_reserva__lte=ventana_hasta,
                            fecha_caducidad__gte=ventana_desde)
                    .order_by('fecha_reserva'))
        intervalos = []
        for r in reservas:
            intervalos.append({
                'inicio': r.fecha_reserva.isoformat(),
                'fin': r.fecha_caducidad.isoformat()
            })
        cursor = ventana_desde
        for r in reservas:
            if r.fecha_reserva <= cursor <= r.fecha_caducidad:
                cursor = r.fecha_caducidad + timedelta(days=1)
        next_available_from = cursor.isoformat()
        return Response({
            'habitacion': habitacion.num,
            'codigo_hotel': habitacion.codigo_hotel_id,
            'intervalos_reservados': intervalos,
            'next_available_from': next_available_from,
            'ventana_consulta': {
                'desde': ventana_desde.isoformat(),
                'hasta': ventana_hasta.isoformat()
            }
        })

class RegistroView(APIView):
    permission_classes = [AllowAny]
    def post(self, request):
        serializer = RegistroSerializer(data=request.data)
        if serializer.is_valid():
            usuario = serializer.save()
            return Response({"msg": "Usuario registrado correctamente"}, status=201)
        return Response(serializer.errors, status=400)

class LoginView(APIView):
    permission_classes = [AllowAny]
    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)
        correo = serializer.validated_data["correo"]
        contrasenia = serializer.validated_data["contrasenia"]
        usuario = Usuario.objects.filter(correo__iexact=correo, estado=True).first()
        if usuario and check_password(contrasenia, usuario.contrasenia):
            refresh = RefreshToken.for_user(usuario)
            return Response({
                "refresh": str(refresh),
                "access": str(refresh.access_token),
                "usuario": {
                    "id": usuario.id,
                    "nombre": usuario.nombre,
                    "correo": usuario.correo,
                    "rol": usuario.rol,
                    "pais": usuario.pais,
                    "pasaporte": usuario.pasaporte,
                    "estado": usuario.estado
                }
            })
        return Response({"error": "Credenciales inválidas"}, status=401)

class SuperadminLoginView(APIView):
    permission_classes = [AllowAny]
    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        correo = serializer.validated_data["correo"]
        contrasenia = serializer.validated_data["contrasenia"]
        usuario = Usuario.objects.filter(
            correo__iexact=correo,
            rol="superadmin",
            estado=True
        ).first()
        if usuario and check_password(contrasenia, usuario.contrasenia):
            return Response({
                "id": usuario.id,
                "nombre": usuario.nombre,
                "correo": usuario.correo,
                "rol": usuario.rol,
                "is_superadmin": True,
                "pais": usuario.pais,
                "pasaporte": usuario.pasaporte,
                "estado": usuario.estado,
                "fecha_creacion": usuario.fecha_creacion
            }, status=status.HTTP_200_OK)
        return Response({"error": "Credenciales inválidas o usuario no autorizado"}, status=status.HTTP_401_UNAUTHORIZED)

class UsuarioViewSet(viewsets.ModelViewSet):
    queryset = Usuario.objects.all()
    serializer_class = UsuarioSerializer

    def get_permissions(self):
        if self.action in ['list', 'retrieve', 'destroy', 'partial_update', 'update', 'create']:
            return [IsSuperAdmin()]
        return [AllowAny()]

    def get_queryset(self):
        user = self.request.user
        if hasattr(user, "is_authenticated") and user.is_authenticated and getattr(user, "rol", None) == "superadmin":
            return Usuario.objects.all()
        if hasattr(user, "is_authenticated") and user.is_authenticated:
            return Usuario.objects.filter(id=user.id)
        return Usuario.objects.none()

class HotelViewSet(viewsets.ModelViewSet):
    queryset = Hotel.objects.all()
    serializer_class = HotelSerializer

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsSuperAdmin()]
        return [AllowAny()]

    def get_queryset(self):
        user = self.request.user
        if hasattr(user, "is_authenticated") and getattr(user, "rol", None) == "superadmin":
            return Hotel.objects.all()
        return Hotel.objects.filter(estado=True)

    def destroy(self, request, *args, **kwargs):
        hotel = self.get_object()
        hotel.estado = False
        hotel.save()
        return Response({"message": "Hotel desactivado correctamente"}, status=status.HTTP_200_OK)

class LugarTuristicoViewSet(viewsets.ModelViewSet):
    queryset = LugarTuristico.objects.all()
    serializer_class = LugarTuristicoSerializer

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsSuperAdmin()]
        return [AllowAny()]

    def get_queryset(self):
        user = self.request.user
        if hasattr(user, "is_authenticated") and getattr(user, "rol", None) == "superadmin":
            return LugarTuristico.objects.all()
        return LugarTuristico.objects.filter(estado=True)

    def destroy(self, request, *args, **kwargs):
        lugar = self.get_object()
        lugar.estado = False
        lugar.save()
        return Response({"message": "Lugar turístico desactivado correctamente"}, status=status.HTTP_200_OK)

class PagoViewSet(viewsets.ModelViewSet):
    queryset = Pago.objects.all()
    serializer_class = PagoSerializer

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsSuperAdmin()]
        return [AllowAny()]

class HabitacionViewSet(viewsets.ModelViewSet):
    queryset = Habitacion.objects.all()
    serializer_class = HabitacionSerializer

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsSuperAdmin()]
        return [AllowAny()]

    def get_queryset(self):
        queryset = Habitacion.objects.all()
        codigo_hotel = self.request.query_params.get('codigo_hotel')
        user = self.request.user
        if not (hasattr(user, "is_authenticated") and getattr(user, "rol", None) == "superadmin"):
            queryset = queryset.filter(disponible=True)
        if codigo_hotel is not None:
            queryset = queryset.filter(codigo_hotel_id=codigo_hotel)
        return queryset

    def destroy(self, request, *args, **kwargs):
        habitacion = self.get_object()
        habitacion.disponible = False
        habitacion.save()
        return Response({"message": "Habitación desactivada correctamente"}, status=status.HTTP_200_OK)

class ReservaViewSet(viewsets.ModelViewSet):
    queryset = Reserva.objects.all()
    serializer_class = ReservaSerializer

    def get_permissions(self):
        if self.action in ['destroy', 'update', 'partial_update']:
            return [IsSuperAdmin()|IsUsuario()]
        if self.action == 'create':
            return [IsAuthenticated()]
        return [IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            return Reserva.objects.none()
        if getattr(user, "rol", None) == "superadmin":
            return Reserva.objects.all()
        return Reserva.objects.filter(id_usuario=user, estado=True)

    def create(self, request, *args, **kwargs):
        user = request.user
        if not user.is_authenticated:
            return Response({"error": "No autenticado"}, status=401)
        data = request.data.copy()
        data["id_usuario"] = user.id
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return Response({
            "message": "Reserva creada correctamente",
            "reserva": serializer.data
        }, status=status.HTTP_201_CREATED)

    def partial_update(self, request, *args, **kwargs):
        reserva = self.get_object()
        user = request.user
        if getattr(user, "rol", None) != "superadmin":
            if reserva.id_usuario.id != user.id:
                return Response({"error": "No tiene permiso para modificar esta reserva"}, status=403)
            campos_restringidos = [
                "id_usuario", "codigo_hotel", "num_habitacion",
                "id_pago", "id_paquete", "fecha_creacion", "estado"
            ]
            for campo in request.data:
                if campo in campos_restringidos:
                    return Response(
                        {"error": f"No se permite modificar el campo '{campo}'"},
                        status=400
                    )
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        reserva = self.get_object()
        user = request.user
        if getattr(user, "rol", None) != "superadmin":
            if reserva.id_usuario.id != user.id:
                return Response({"error": "No tiene permiso para eliminar esta reserva"}, status=403)
        reserva.estado = False
        reserva.save()
        return Response({"message": "Reserva desactivada correctamente"}, status=status.HTTP_200_OK)

class PaqueteViewSet(viewsets.ModelViewSet):
    queryset = Paquete.objects.all()
    serializer_class = PaqueteSerializer

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsSuperAdmin()]
        return [permissions.AllowAny()]

    def get_queryset(self):
        user = self.request.user
        if hasattr(user, "is_authenticated") and getattr(user, "rol", None) == "superadmin":
            return Paquete.objects.all()
        return Paquete.objects.filter(estado=True)

    def destroy(self, request, *args, **kwargs):
        paquete = self.get_object()
        paquete.estado = False
        paquete.save()
        return Response({"message": "Paquete desactivado correctamente"}, status=status.HTTP_200_OK)

class SugerenciasViewSet(viewsets.ModelViewSet):
    queryset = Sugerencias.objects.all()
    serializer_class = SugerenciasSerializer

    def get_permissions(self):
        # Solo usuarios autenticados pueden crear; lectura es pública
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAuthenticated()]
        return [AllowAny()]

@method_decorator(csrf_exempt, name='dispatch')
class LLMGenerateView(APIView):
    permission_classes = [AllowAny]
    def post(self, request):
        prompt = request.data.get('prompt', '')
        chat_id = request.data.get('chat_id')
        # attach user if authenticated for per-user memory
        user = request.user if getattr(request.user, 'is_authenticated', False) else None
        result, chat_id = send_message(prompt, chat_id=chat_id, usuario=user)
        return Response({'result': result, 'chat_id': chat_id})