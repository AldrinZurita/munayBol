from django.urls import path, include
from rest_framework import routers
from .views import (
    UsuarioViewSet, HotelViewSet, LugarTuristicoViewSet,
    PagoViewSet, HabitacionViewSet, ReservaViewSet, PaqueteViewSet, SugerenciasViewSet, SuperadminLoginView, home, LLMGenerateView
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
    path('superadmin/login/', SuperadminLoginView.as_view(), name='superadmin-login'),
    path('llm/generate/', LLMGenerateView.as_view(), name='llm-generate'),
    path('', include(router.urls)),
]
