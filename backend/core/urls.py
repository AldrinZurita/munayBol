from django.urls import path, include
from rest_framework import routers

from .views import (
    UsuarioViewSet, HotelViewSet, LugarTuristicoViewSet,
    PagoViewSet, HabitacionViewSet, ReservaViewSet, PaqueteViewSet, SugerenciasViewSet, NotificationViewSet, home, LLMGenerateView,
    HabitacionDisponibilidadView, RegistroView, LoginView, SuperUsuarioRegistroView
)
from .auth_google import GoogleLoginAPIView
from .auth_github import GitHubLoginURLAPIView, GitHubExchangeCodeAPIView

router = routers.DefaultRouter()
router.register(r'usuarios', UsuarioViewSet)
router.register(r'hoteles', HotelViewSet)
router.register(r'lugares', LugarTuristicoViewSet)
router.register(r'pagos', PagoViewSet)
router.register(r'habitaciones', HabitacionViewSet)
router.register(r'reservas', ReservaViewSet)
router.register(r'paquetes', PaqueteViewSet)
router.register(r'sugerencias', SugerenciasViewSet)
router.register(r'notifications', NotificationViewSet, basename='notifications')

urlpatterns = [
    path('', home, name='home'),
    path('usuarios/registro-superusuario/', SuperUsuarioRegistroView.as_view(), name='superusuario-registro'),
    path('usuarios/registro/', RegistroView.as_view(), name='usuario-registro'),
    path('usuarios/login/', LoginView.as_view(), name='usuario-login'),

    # OAuth
    path('auth/google/', GoogleLoginAPIView.as_view(), name='google-login'),
    path('auth/github/login-url/', GitHubLoginURLAPIView.as_view(), name='github-login-url'),
    path('auth/github/exchange/', GitHubExchangeCodeAPIView.as_view(), name='github-exchange'),

    path('llm/generate/', LLMGenerateView.as_view(), name='llm-generate'),
    path('habitaciones/<str:num>/disponibilidad/', HabitacionDisponibilidadView.as_view(), name='habitacion-disponibilidad'),
    path('', include(router.urls)),
]