
from rest_framework import viewsets, status, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from django.http import HttpResponse
from .models import Usuario, Hotel, LugarTuristico, Pago, Habitacion, Reserva, Paquete, Sugerencias
from .serializers import (
    UsuarioSerializer, HotelSerializer, LugarTuristicoSerializer, PagoSerializer,
    HabitacionSerializer, ReservaSerializer, PaqueteSerializer, SugerenciasSerializer, LoginSerializer
)
from .permissions import IsSuperAdmin


# Función auxiliar para determinar si la petición viene de un superadmin
def is_superadmin_request(request):
    """
    Retorna True si los headers indican que el usuario es superadmin.
    """
    return request.headers.get("X-Is-Superadmin", "false").lower() == "true" and bool(request.headers.get("X-User-CI"))

# Vista de bienvenida
def home(request):
    from django.http import HttpResponse
    return HttpResponse("Bienvenido a la API MunayBol")

# Login de superadmin
class SuperadminLoginView(APIView):
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

        if usuario and usuario.contrasenia == contrasenia:
            return Response({
                "ci": usuario.ci,
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


# Usuario

class UsuarioViewSet(viewsets.ModelViewSet):
    queryset = Usuario.objects.all()
    serializer_class = UsuarioSerializer


# Hotel
class HotelViewSet(viewsets.ModelViewSet):
    queryset = Hotel.objects.all()
    serializer_class = HotelSerializer

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsSuperAdmin()]
        return [permissions.IsAuthenticatedOrReadOnly()]

    def get_queryset(self):
        if is_superadmin_request(self.request):
            return Hotel.objects.all()
        return Hotel.objects.filter(estado=True)

    def destroy(self, request, *args, **kwargs):
        hotel = self.get_object()
        hotel.estado = False
        hotel.save()
        return Response({"message": "Hotel desactivado correctamente"}, status=status.HTTP_200_OK)


# Lugar Turístico
class LugarTuristicoViewSet(viewsets.ModelViewSet):
    queryset = LugarTuristico.objects.all()
    serializer_class = LugarTuristicoSerializer


# Pago
class PagoViewSet(viewsets.ModelViewSet):
    queryset = Pago.objects.all()
    serializer_class = PagoSerializer


# Habitacion
class HabitacionViewSet(viewsets.ModelViewSet):
    queryset = Habitacion.objects.all()
    serializer_class = HabitacionSerializer

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            if is_superadmin_request(self.request):
                return []
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("No tienes permiso para realizar esta acción")
        return [permissions.IsAuthenticatedOrReadOnly()]

    def get_queryset(self):
        queryset = Habitacion.objects.all()
        codigo_hotel = self.request.query_params.get('codigo_hotel')

        if not is_superadmin_request(self.request):
            queryset = queryset.filter(disponible=True)

        if codigo_hotel is not None:
            queryset = queryset.filter(codigo_hotel_id=codigo_hotel)

        return queryset

    def destroy(self, request, *args, **kwargs):
        habitacion = self.get_object()
        habitacion.disponible = False
        habitacion.save()
        return Response({"message": "Habitación desactivada correctamente"}, status=status.HTTP_200_OK)


# Reserva
class ReservaViewSet(viewsets.ModelViewSet):
    queryset = Reserva.objects.none()
    serializer_class = ReservaSerializer

    def get_queryset(self):
        ci_usuario = self.request.headers.get("X-User-CI")
        if not ci_usuario:
            return Reserva.objects.none()

        if is_superadmin_request(self.request):
            return Reserva.objects.all()
        else:
            return Reserva.objects.filter(ci_usuario=ci_usuario)


# Paquete
class PaqueteViewSet(viewsets.ModelViewSet):
    queryset = Paquete.objects.all()
    serializer_class = PaqueteSerializer

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            if is_superadmin_request(self.request):
                return []
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("No tienes permiso para realizar esta acción")
        return [permissions.AllowAny()]

    def get_queryset(self):
        # Todos los usuarios ven todos los paquetes
        return Paquete.objects.all()


# Sugerencias
class SugerenciasViewSet(viewsets.ModelViewSet):
    queryset = Sugerencias.objects.all()
    serializer_class = SugerenciasSerializer
