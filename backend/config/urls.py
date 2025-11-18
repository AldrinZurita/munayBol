from django.contrib import admin
from django.http import JsonResponse
from django.urls import path, include

def healthz(_request):
    return JsonResponse({"status": "ok"}, status=200)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('healthz/', healthz),
    path('api/', include('core.urls')),
]