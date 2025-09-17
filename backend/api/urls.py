from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import UsuarioViewSet, HotelViewSet, LugarTuristicoViewSet, PagoViewSet, HabitacionViewSet, ReservaViewSet, PaqueteViewSet, SugerenciasViewSet

router = DefaultRouter()
router.register(r'usuarios', UsuarioViewSet)
router.register(r'hoteles', HotelViewSet)
router.register(r'lugares', LugarTuristicoViewSet)
router.register(r'pagos', PagoViewSet)
router.register(r'habitaciones', HabitacionViewSet)
router.register(r'reservas', ReservaViewSet)
router.register(r'paquetes', PaqueteViewSet)
router.register(r'sugerencias', SugerenciasViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
