
from rest_framework import viewsets, status, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.http import HttpResponse
from .models import Usuario, Hotel, LugarTuristico, Pago, Habitacion, Reserva, Paquete, Sugerencias
from .serializers import (
    UsuarioSerializer, HotelSerializer, LugarTuristicoSerializer, PagoSerializer,
    HabitacionSerializer, ReservaSerializer, PaqueteSerializer, SugerenciasSerializer, LoginSerializer
)
from .permissions import IsSuperAdmin
from .llm_client import get_llm_response
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from datetime import date, timedelta


class HabitacionDisponibilidadView(APIView):
    """Devuelve intervalos reservados y la próxima fecha disponible para una habitación.

    Parámetros query opcionales:
      desde: YYYY-MM-DD (por defecto hoy)
      hasta: YYYY-MM-DD (por defecto hoy + 90 días)
    """
    def get(self, request, num):
        try:
            habitacion = Habitacion.objects.get(pk=num)
        except Habitacion.DoesNotExist:
            return Response({"error": "Habitación no encontrada"}, status=404)

        # Ventana de consulta
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

        # Obtener reservas que intersectan la ventana
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

        # Calcular próxima fecha disponible partiendo de ventana_desde
        cursor = ventana_desde
        for r in reservas:
            # Si el cursor cae dentro de un intervalo, saltar al día siguiente al fin
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

    def get_permissions(self):
        """
        Solo el superadmin puede crear, actualizar o desactivar lugares turísticos.
        Los demás usuarios solo pueden ver los lugares activos.
        """
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            if is_superadmin_request(self.request):
                return []
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("No tienes permiso para realizar esta acción")
        return [permissions.AllowAny()]

    def get_queryset(self):
        """
        Si la petición proviene de un superadmin, se devuelven todos los lugares.
        En caso contrario, solo los lugares activos (estado=True).
        """
        if is_superadmin_request(self.request):
            return LugarTuristico.objects.all()
        return LugarTuristico.objects.filter(estado=True)

    def destroy(self, request, *args, **kwargs):
        """
        No elimina el registro físicamente, solo marca el lugar como inactivo.
        """
        lugar = self.get_object()
        lugar.estado = False
        lugar.save()
        return Response({"message": "Lugar turístico desactivado correctamente"}, status=status.HTTP_200_OK)



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
    queryset = Reserva.objects.all()
    serializer_class = ReservaSerializer

    def get_queryset(self):
        """
        - Si la petición proviene de un superadmin, devuelve todas las reservas.
        - Si no, solo devuelve las reservas activas (estado=True) del usuario autenticado.
        """
        ci_usuario = self.request.headers.get("X-User-CI")
        if not ci_usuario:
            return Reserva.objects.none()

        if is_superadmin_request(self.request):
            return Reserva.objects.all()
        return Reserva.objects.filter(ci_usuario=ci_usuario, estado=True)

    def create(self, request, *args, **kwargs):
        """
        Crea una nueva reserva asignando automáticamente el usuario desde los headers.
        """
        ci_usuario = request.headers.get("X-User-CI")
        if not ci_usuario:
            return Response({"error": "Debe incluir el header X-User-CI"}, status=400)

        data = request.data.copy()
        data["ci_usuario"] = ci_usuario

        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)

        return Response({
            "message": "Reserva creada correctamente",
            "reserva": serializer.data
        }, status=status.HTTP_201_CREATED)

    def partial_update(self, request, *args, **kwargs):
        """
        Permite actualizaciones parciales:
        - Solo el superadmin puede modificar cualquier campo.
        - El usuario común solo puede cambiar campos no críticos (como fechas).
        """
        reserva = self.get_object()

        # Validar permisos
        if not is_superadmin_request(request):
            if str(reserva.ci_usuario.ci) != request.headers.get("X-User-CI"):
                return Response({"error": "No tiene permiso para modificar esta reserva"}, status=403)

            # Campos no permitidos para usuarios comunes
            campos_restringidos = [
                "ci_usuario", "codigo_hotel", "num_habitacion",
                "id_pago", "id_paquete", "fecha_creacion", "estado"
            ]
            for campo in campos_restringidos:
                if campo in request.data:
                    return Response(
                        {"error": f"No se permite modificar el campo '{campo}'"},
                        status=400
                    )

        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        """
        Realiza un soft delete: cambia estado=False en lugar de eliminar el registro.
        """
        reserva = self.get_object()

        # Solo superadmin o el dueño pueden desactivar la reserva
        if not is_superadmin_request(request):
            if str(reserva.ci_usuario.ci) != request.headers.get("X-User-CI"):
                return Response({"error": "No tiene permiso para eliminar esta reserva"}, status=403)

        reserva.estado = False
        reserva.save()
        return Response({"message": "Reserva desactivada correctamente"}, status=status.HTTP_200_OK)

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
        if is_superadmin_request(self.request):
            return Paquete.objects.all()
        return Paquete.objects.filter(estado=True)  # solo activos para usuarios

    def destroy(self, request, *args, **kwargs):
        paquete = self.get_object()
        paquete.estado = False
        paquete.save()
        return Response({"message": "Paquete desactivado correctamente"}, status=status.HTTP_200_OK)



# Sugerencias
class SugerenciasViewSet(viewsets.ModelViewSet):
    queryset = Sugerencias.objects.all()
    serializer_class = SugerenciasSerializer

# Modelo LLM
@method_decorator(csrf_exempt, name='dispatch')
class LLMGenerateView(APIView):
    def post(self, request):
        prompt = request.data.get('prompt', '')
        result = get_llm_response(prompt)
        return Response({'result': result})

