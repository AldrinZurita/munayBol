from django.contrib import admin

from .models import Usuario, Hotel, LugarTuristico, Pago, Habitacion, Reserva, Paquete, Sugerencias, ChatSession

admin.site.register(Usuario)
admin.site.register(Hotel)
admin.site.register(LugarTuristico)
admin.site.register(Pago)
admin.site.register(Habitacion)
admin.site.register(Reserva)
admin.site.register(Paquete)
admin.site.register(Sugerencias)
@admin.register(ChatSession)
class ChatSessionAdmin(admin.ModelAdmin):
	list_display = ("id", "usuario", "created_at", "updated_at")
	search_fields = ("id", "usuario__correo")