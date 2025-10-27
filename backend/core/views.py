from rest_framework import viewsets, status, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from django.http import HttpResponse
from .models import (
    Usuario, Hotel, LugarTuristico, Pago, Habitacion, Reserva, Paquete, Sugerencias, Notification
)
from .serializers import (
    UsuarioSerializer, HotelSerializer, LugarTuristicoSerializer, PagoSerializer,
    HabitacionSerializer, ReservaSerializer, PaqueteSerializer, SugerenciasSerializer,
    LoginSerializer, RegistroSerializer, SuperUsuarioRegistroSerializer, NotificationSerializer
)
from .permissions import IsSuperAdmin, IsUsuario
from .llm_client import send_message
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from datetime import date, timedelta
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.decorators import action
from django.contrib.auth.hashers import check_password
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

        # Solo reservas activas bloquean
        reservas = (Reserva.objects
                    .filter(
            num_habitacion=habitacion,
            estado=True,
            fecha_reserva__lte=ventana_hasta,
            fecha_caducidad__gte=ventana_desde
        )
                    .order_by('fecha_reserva'))

        intervalos = [{"inicio": r.fecha_reserva.isoformat(), "fin": r.fecha_caducidad.isoformat()} for r in reservas]

        cursor = ventana_desde
        for r in reservas:
            if r.fecha_reserva <= cursor <= r.fecha_caducidad:
                cursor = r.fecha_caducidad + timedelta(days=1)

        return Response({
            'habitacion': habitacion.num,
            'codigo_hotel': habitacion.codigo_hotel_id,
            'intervalos_reservados': intervalos,
            'next_available_from': cursor.isoformat(),
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
            serializer.save()
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
        if usuario and usuario.check_password(contrasenia):
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
                    "estado": usuario.estado,
                    "avatar_url": getattr(usuario, "avatar_url", "") or ""
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
            correo__iexact=correo, rol="superadmin", estado=True
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
                "fecha_creacion": usuario.fecha_creacion,
                "avatar_url": getattr(usuario, "avatar_url", "") or ""
            }, status=status.HTTP_200_OK)
        return Response({"error": "Credenciales inválidas o usuario no autorizado"}, status=status.HTTP_401_UNAUTHORIZED)


class UsuarioViewSet(viewsets.ModelViewSet):
    queryset = Usuario.objects.all()
    serializer_class = UsuarioSerializer
    authentication_classes = [JWTAuthentication]

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
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = SuperUsuarioRegistroSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response({"msg": "Superusuario registrado correctamente"}, status=201)
        return Response(serializer.errors, status=400)


@method_decorator(csrf_exempt, name='dispatch')
class MeView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UsuarioSerializer(request.user)
        return Response(serializer.data)

    def patch(self, request):
        user = request.user
        allowed = {'nombre', 'pais', 'pasaporte', 'avatar_url'}
        data = {k: v for k, v in request.data.items() if k in allowed}
        serializer = UsuarioSerializer(user, data=data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


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
    authentication_classes = [JWTAuthentication]

    def get_permissions(self):
        # Autenticación requerida; el chequeo de dueño/superadmin se hace por acción
        return [IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        if not getattr(user, "is_authenticated", False):
            return Reserva.objects.none()

        if getattr(user, "rol", None) == "superadmin":
            qs = Reserva.objects.all()
            id_usuario = self.request.query_params.get('id_usuario')
            estado = self.request.query_params.get('estado')
            if id_usuario:
                try:
                    qs = qs.filter(id_usuario_id=int(id_usuario))
                except ValueError:
                    pass
                if estado in ('true', 'false'):
                    qs = qs.filter(estado=(estado == 'true'))
                else:
                    qs = qs.filter(estado=True)
            elif estado in ('true', 'false'):
                qs = qs.filter(estado=(estado == 'true'))
            return qs

        qs = Reserva.objects.filter(id_usuario=user)
        estado = self.request.query_params.get('estado')
        if estado in ('true', 'false'):
            qs = qs.filter(estado=(estado == 'true'))
        else:
            qs = qs.filter(estado=True)
        return qs

    def create(self, request, *args, **kwargs):
        user = request.user
        if not user.is_authenticated:
            return Response({"error": "No autenticado"}, status=401)
        data = request.data.copy()
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        instance = serializer.save(id_usuario=user)
        output = self.get_serializer(instance)

        try:
            notif = Notification.objects.create(
                usuario=user,
                title="Reserva exitosa",
                message=f"Tu reserva #{instance.id_reserva} fue creada correctamente.",
                link=f"/reservas/{instance.id_reserva}"
            )
            channel_layer = get_channel_layer()
            async_to_sync(channel_layer.group_send)(
                f"user_{user.id}",
                {"type": "notify", "payload": {"event": "new_reserva", "title": notif.title, "message": notif.message}}
            )
        except Exception:
            pass

        return Response({"message": "Reserva creada correctamente", "reserva": output.data},
                        status=status.HTTP_201_CREATED)

    def partial_update(self, request, *args, **kwargs):
        """Dueño puede modificar SOLO fechas; superadmin sin restricción."""
        reserva = self.get_object()
        user = self.request.user

        if getattr(user, "rol", None) != "superadmin":
            if reserva.id_usuario_id != user.id:
                return Response({"error": "No tiene permiso para modificar esta reserva"}, status=403)
            allowed_user_fields = {"fecha_reserva", "fecha_caducidad"}
            if set(request.data.keys()) - allowed_user_fields:
                return Response({"error": "Solo se permite modificar: fecha_reserva, fecha_caducidad"}, status=400)

        return super().partial_update(request, *args, **kwargs)

    @action(detail=True, methods=['post'], url_path='cancelar')
    def cancelar(self, request, pk=None):
        """Cancelar (soft delete) una reserva. Dueño o superadmin."""
        reserva = self.get_object()
        user = request.user

        if getattr(user, "rol", None) != "superadmin" and reserva.id_usuario_id != user.id:
            return Response({"error": "No tiene permiso para cancelar esta reserva"}, status=403)

        if not reserva.estado:
            return Response({"message": "La reserva ya está cancelada."}, status=200)

        reserva.estado = False
        reserva.save(update_fields=['estado'])

        try:
            notif = Notification.objects.create(
                usuario=reserva.id_usuario,
                title="Reserva cancelada",
                message=f"Tu reserva #{reserva.id_reserva} fue cancelada.",
                link=f"/reservas/{reserva.id_reserva}"
            )
            channel_layer = get_channel_layer()
            async_to_sync(channel_layer.group_send)(
                f"user_{reserva.id_usuario_id}",
                {"type": "notify", "payload": {"event": "cancel_reserva", "title": notif.title, "message": notif.message}}
            )
        except Exception:
            pass

        return Response({"message": "Reserva cancelada correctamente", "id_reserva": reserva.id_reserva}, status=200)

    @action(detail=True, methods=['post'], url_path='reactivar')
    def reactivar(self, request, pk=None):
        """Reactivar una reserva cancelada (estado=True) si no hay solapamientos activos. Dueño o superadmin."""
        reserva = self.get_object()
        user = request.user

        if getattr(user, "rol", None) != "superadmin" and reserva.id_usuario_id != user.id:
            return Response({"error": "No tiene permiso para reactivar esta reserva"}, status=403)

        if reserva.estado:
            return Response({"message": "La reserva ya está activa."}, status=200)

        # Validar que al reactivar no solape con otras activas en la misma habitación
        overlap = Reserva.objects.filter(
            num_habitacion=reserva.num_habitacion,
            estado=True,
            fecha_reserva__lte=reserva.fecha_caducidad,
            fecha_caducidad__gte=reserva.fecha_reserva
        ).exclude(pk=reserva.pk).exists()

        if overlap:
            return Response({"error": "No se puede reactivar: solapa con otra reserva activa en ese rango."}, status=400)

        reserva.estado = True
        reserva.save(update_fields=['estado'])

        try:
            notif = Notification.objects.create(
                usuario=reserva.id_usuario,
                title="Reserva reactivada",
                message=f"Tu reserva #{reserva.id_reserva} fue reactivada.",
                link=f"/reservas/{reserva.id_reserva}"
            )
            channel_layer = get_channel_layer()
            async_to_sync(channel_layer.group_send)(
                f"user_{reserva.id_usuario_id}",
                {"type": "notify", "payload": {"event": "reactivar_reserva", "title": notif.title, "message": notif.message}}
            )
        except Exception:
            pass

        return Response({"message": "Reserva reactivada correctamente", "id_reserva": reserva.id_reserva}, status=200)

    def destroy(self, request, *args, **kwargs):
        """Soft-cancel mediante DELETE para compatibilidad."""
        reserva = self.get_object()
        user = self.request.user
        if getattr(user, "rol", None) != "superadmin" and reserva.id_usuario_id != user.id:
            return Response({"error": "No tiene permiso para eliminar esta reserva"}, status=403)

        if not reserva.estado:
            return Response({"message": "La reserva ya estaba cancelada."}, status=200)

        reserva.estado = False
        reserva.save(update_fields=['estado'])
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
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        paquete = serializer.save()
        output = self.get_serializer(paquete)
        return Response({"message": "Paquete creado correctamente", "paquete": output.data},
                        status=status.HTTP_201_CREATED)


class SugerenciasViewSet(viewsets.ModelViewSet):
    queryset = Sugerencias.objects.all()
    serializer_class = SugerenciasSerializer

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAuthenticated()]
        return [AllowAny()]


class NotificationViewSet(viewsets.ModelViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if not getattr(user, 'is_authenticated', False):
            return Notification.objects.none()
        return Notification.objects.filter(usuario=user).order_by('-created_at')

    @action(detail=True, methods=['delete'])
    def delete_notification(self, request, pk=None):
        try:
            notif = self.get_queryset().get(pk=pk)
        except Notification.DoesNotExist:
            return Response({"error": "Notificación no encontrada"}, status=404)
        notif.delete()
        return Response({"status": "deleted"})

    @action(detail=False, methods=['get'])
    def unread_count(self, request):
        cnt = self.get_queryset().filter(read=False).count()
        return Response({"unread": cnt})

    @action(detail=False, methods=['post'])
    def mark_all_as_read(self, request):
        qs = self.get_queryset().filter(read=False)
        updated = qs.update(read=True)
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
        user = request.user if getattr(request.user, 'is_authenticated', False) else None
        result, chat_id = send_message(prompt, chat_id=chat_id, usuario=user)
        return Response({'result': result, 'chat_id': chat_id})