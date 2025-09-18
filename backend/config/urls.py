from django.contrib import admin
from django.urls import path, include
from rest_framework import routers
from django.shortcuts import redirect
from core.views import (
    UsuarioViewSet, HotelViewSet, LugarTuristicoViewSet, PagoViewSet,
    HabitacionViewSet, ReservaViewSet, PaqueteViewSet, SugerenciasViewSet,
    AdminLoginView, home
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
    path('', home), 
    path('admin/', admin.site.urls),
    path('api/', include(router.urls)),
    path('api/auth/login/', AdminLoginView.as_view(), name='admin-login'),
]