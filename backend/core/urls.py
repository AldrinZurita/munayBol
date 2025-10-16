from django.urls import path, include
from rest_framework import routers

from .views import (
    UsuarioViewSet, HotelViewSet, LugarTuristicoViewSet,
    PagoViewSet, HabitacionViewSet, ReservaViewSet, PaqueteViewSet, SugerenciasViewSet, home, LLMGenerateView,
    HabitacionDisponibilidadView, RegistroView, LoginView, SuperUsuarioRegistroView
)

router = routers.DefaultRouter()
router.register(r'usuarios', UsuarioViewSet)
router.register(r'hoteles', HotelViewSet)
router.register(r'lugares', LugarTuristicoViewSet)
router.register(r'pagos', PagoViewSet)
router.register(r'habitaciones', HabitacionViewSet)
router.register(r'reservas', ReservaViewSet)
router.register(r'paquetes', PaqueteViewSet)
router.register(r'sugerencias', SugerenciasViewSet)

urlpatterns = [
    path('', home, name='home'),
    path('usuarios/registro-superusuario/', SuperUsuarioRegistroView.as_view(), name='superusuario-registro'),
    path('usuarios/registro/', RegistroView.as_view(), name='usuario-registro'),
    path('usuarios/login/', LoginView.as_view(), name='usuario-login'),
    path('llm/generate/', LLMGenerateView.as_view(), name='llm-generate'),
    path('habitaciones/<str:num>/disponibilidad/', HabitacionDisponibilidadView.as_view(), name='habitacion-disponibilidad'),
    path('', include(router.urls)),
]
