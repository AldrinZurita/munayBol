from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .models import Usuario
from .llm_client import get_llm_response

def home(request):
    from django.http import HttpResponse
    return HttpResponse("Bienvenido a la API MunayBol")

@method_decorator(csrf_exempt, name='dispatch')
class SuperadminLoginView(APIView):
    def post(self, request):
        # Ignora los datos recibidos
        try:
            # Busca el primer usuario con rol 'superadmin'
            usuario = Usuario.objects.filter(rol='superadmin').first()
            if usuario:
                return Response({
                    'ci': usuario.ci,
                    'nombre': usuario.nombre,
                    'correo': usuario.correo,
                    'rol': usuario.rol,
                    'pais': usuario.pais,
                    'pasaporte': usuario.pasaporte,
                    'estado': usuario.estado,
                    'fecha_creacion': usuario.fecha_creacion
                }, status=status.HTTP_200_OK)
            else:
                # Si no hay ningún superadmin, devuelve un usuario ficticio
                return Response({
                    'ci': '00000',
                    'nombre': 'Superadmin Default',
                    'correo': 'superadmin@default.com',
                    'rol': 'superadmin',
                    'pais': 'Bolivia',
                    'pasaporte': '0000',
                    'estado': True,
                    'fecha_creacion': '2025-01-01'
                }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

from rest_framework import viewsets, permissions
from .models import Usuario, Hotel, LugarTuristico, Pago, Habitacion, Reserva, Paquete, Sugerencias
from .serializers import (
    UsuarioSerializer, HotelSerializer, LugarTuristicoSerializer, PagoSerializer,
    HabitacionSerializer, ReservaSerializer, PaqueteSerializer, SugerenciasSerializer
)
from .permissions import IsSuperAdmin

class UsuarioViewSet(viewsets.ModelViewSet):
    queryset = Usuario.objects.all()
    serializer_class = UsuarioSerializer

class HotelViewSet(viewsets.ModelViewSet):
    queryset = Hotel.objects.all()
    serializer_class = HotelSerializer

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsSuperAdmin()]
        return [permissions.IsAuthenticatedOrReadOnly()]

class LugarTuristicoViewSet(viewsets.ModelViewSet):
    queryset = LugarTuristico.objects.all()
    serializer_class = LugarTuristicoSerializer

class PagoViewSet(viewsets.ModelViewSet):
    queryset = Pago.objects.all()
    serializer_class = PagoSerializer

class HabitacionViewSet(viewsets.ModelViewSet):
    queryset = Habitacion.objects.all()
    serializer_class = HabitacionSerializer

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsSuperAdmin()]
        return [permissions.IsAuthenticatedOrReadOnly()]

    def get_queryset(self):
        queryset = super().get_queryset()
        codigo_hotel = self.request.query_params.get('codigo_hotel')
        if codigo_hotel is not None:
            queryset = queryset.filter(codigo_hotel_id=codigo_hotel)
        return queryset

class ReservaViewSet(viewsets.ModelViewSet):
    queryset = Reserva.objects.all()
    serializer_class = ReservaSerializer

class PaqueteViewSet(viewsets.ModelViewSet):
    queryset = Paquete.objects.all()
    serializer_class = PaqueteSerializer

class SugerenciasViewSet(viewsets.ModelViewSet):
    queryset = Sugerencias.objects.all()
    serializer_class = SugerenciasSerializer

class LLMGenerateView(APIView):
    def post(self, request):
        prompt = request.data.get('prompt', '')
        result = get_llm_response(prompt)
        return Response({'result': result})