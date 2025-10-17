from rest_framework import viewsets, status, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from django.http import HttpResponse
from .models import Usuario, Hotel, LugarTuristico, Pago, Habitacion, Reserva, Paquete, Sugerencias, Notification
from .serializers import (
    UsuarioSerializer, HotelSerializer, LugarTuristicoSerializer, PagoSerializer,
    HabitacionSerializer, ReservaSerializer, PaqueteSerializer, SugerenciasSerializer,
    LoginSerializer, RegistroSerializer, SuperUsuarioRegistroSerializer, NotificationSerializer
)
from .permissions import IsSuperAdmin, IsUsuario
from .llm_client import get_llm_response, send_message
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from datetime import date, timedelta
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth.hashers import check_password
from rest_framework.decorators import action
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

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
        if usuario and usuario.check_password(contrasenia):  # <---- CAMBIA AQUÍ
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

class SuperUsuarioRegistroView(APIView):
    permission_classes = [AllowAny]  # Cambia esto si quieres proteger el endpoint

    def post(self, request):
        serializer = SuperUsuarioRegistroSerializer(data=request.data)
        if serializer.is_valid():
            usuario = serializer.save()
            return Response({"msg": "Superusuario registrado correctamente"}, status=201)
        return Response(serializer.errors, status=400)

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
        # Permisos:
        # - create: usuario autenticado (pago propio)
        # - update/partial_update/destroy: solo superadmin
        # - list/retrieve: por ahora público (como estaba); ajustar si se requiere
        if self.action == 'create':
            return [IsAuthenticated()]
        if self.action in ['update', 'partial_update', 'destroy']:
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
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        # Asignar el usuario autenticado mediante save(), dado que id_usuario es read_only en el serializer
        instance = serializer.save(id_usuario=user)
        output = self.get_serializer(instance)

        # Crear notificación para el usuario
        from .models import Notification
        from asgiref.sync import async_to_sync
        from channels.layers import get_channel_layer
        notif = Notification.objects.create(
            usuario=user,
            title="Reserva exitosa",
            message=f"Tu reserva #{instance.id_reserva} fue creada correctamente.",
            link=f"/reservas/{instance.id_reserva}"
        )
        # Emitir evento WS
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f"user_{user.id}",
            {"type": "notify", "payload": {"event": "new_reserva", "title": notif.title, "message": notif.message}}
        )

        return Response({
            "message": "Reserva creada correctamente",
            "reserva": output.data
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

    def create(self, request, *args, **kwargs):
        # Solo superadmin crea; permisos ya lo controlan
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        paquete = serializer.save()

        # Notificar a todos los usuarios activos
        usuarios = Usuario.objects.filter(estado=True, rol='usuario')
        notifs = []
        try:
            lugar_nombre = getattr(paquete.id_lugar, 'nombre', '')
        except Exception:
            lugar_nombre = ''
        title = f"Nuevo paquete: {paquete.nombre}" if paquete.nombre else "Nuevo paquete disponible"
        msg_base = f"{paquete.nombre}"
        if lugar_nombre:
            msg_base += f" — {lugar_nombre}"
        try:
            precio_txt = f" desde {paquete.precio:.2f} BOB" if paquete.precio is not None else ""
        except Exception:
            precio_txt = ""
        message = (msg_base + precio_txt).strip()
        for u in usuarios:
            notifs.append(Notification(usuario=u, title=title, message=message, link='/paquetes'))
        if notifs:
            Notification.objects.bulk_create(notifs, ignore_conflicts=True)
            # Emitir evento WS por usuario
            channel_layer = get_channel_layer()
            for u in usuarios:
                async_to_sync(channel_layer.group_send)(
                    f"user_{u.id}",
                    {"type": "notify", "payload": {"event": "new_package", "title": title, "message": message}}
                )

        output = self.get_serializer(paquete)
        return Response({
            "message": "Paquete creado correctamente",
            "paquete": output.data,
            "notified_users": usuarios.count()
        }, status=status.HTTP_201_CREATED)

class SugerenciasViewSet(viewsets.ModelViewSet):
    queryset = Sugerencias.objects.all()
    serializer_class = SugerenciasSerializer

    def get_permissions(self):
        # Solo usuarios autenticados pueden crear; lectura es pública
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAuthenticated()]
        return [AllowAny()]

class NotificationViewSet(viewsets.ModelViewSet):
    @action(detail=True, methods=['delete'])
    def delete_notification(self, request, pk=None):
        user = request.user
        try:
            notif = self.get_queryset().get(pk=pk)
        except Notification.DoesNotExist:
            return Response({"error": "Notificación no encontrada"}, status=404)
        notif.delete()
        return Response({"status": "deleted"})
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if not getattr(user, 'is_authenticated', False):
            return Notification.objects.none()
        return Notification.objects.filter(usuario=user).order_by('-created_at')

    @action(detail=False, methods=['get'])
    def unread_count(self, request):
        cnt = self.get_queryset().filter(read=False).count()
        return Response({"unread": cnt})

    @action(detail=False, methods=['post'])
    def mark_all_as_read(self, request):
        qs = self.get_queryset().filter(read=False)
        updated = qs.update(read=True)
        # Emitir evento de actualización de contador
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f"user_{request.user.id}",
            {"type": "notify", "payload": {"event": "mark_all_read"}}
        )
        return Response({"updated": updated})

    @action(detail=True, methods=['post'])
    def mark_as_read(self, request, pk=None):
        try:
            notif = self.get_queryset().get(pk=pk)
        except Notification.DoesNotExist:
            return Response({"error": "Notificación no encontrada"}, status=404)
        if not notif.read:
            notif.read = True
            notif.save(update_fields=['read'])
        # Emitir evento de actualización de contador
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f"user_{request.user.id}",
            {"type": "notify", "payload": {"event": "mark_read", "id": notif.id}}
        )
        return Response({"status": "ok"})

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