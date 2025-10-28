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
    list_display = ("id", "usuario", "title", "archived", "messages_count", "last_message_at", "created_at", "updated_at")
    list_filter = ("archived",)
    search_fields = ("id", "usuario__correo", "title")