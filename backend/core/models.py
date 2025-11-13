from django.db import models
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager
import uuid
from django.utils import timezone


class UsuarioManager(BaseUserManager):
    def create_user(self, correo, contrasenia=None, **extra_fields):
        extra_fields.setdefault('rol', 'usuario')
        extra_fields.setdefault('is_superuser', False)
        extra_fields.setdefault('is_staff', False)
        if not correo:
            raise ValueError('El usuario debe tener un correo')
        correo = self.normalize_email(correo)
        user = self.model(correo=correo, **extra_fields)
        user.set_password(contrasenia)  # Solo el manager hashea
        user.save(using=self._db)
        return user

    def create_superuser(self, correo, contrasenia=None, **extra_fields):
        extra_fields.setdefault('rol', 'superadmin')
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_staff', True)
        return self.create_user(correo, contrasenia, **extra_fields)


class Usuario(AbstractBaseUser, PermissionsMixin):
    id = models.BigAutoField(primary_key=True)
    nombre = models.CharField(max_length=255)
    correo = models.EmailField(max_length=255, unique=True)
    contrasenia = models.CharField(max_length=255)
    rol = models.CharField(max_length=50, choices=[('superadmin', 'Superadmin'), ('usuario', 'Usuario')])
    pais = models.CharField(max_length=50)
    pasaporte = models.CharField(max_length=50)
    estado = models.BooleanField(default=True)
    fecha_creacion = models.DateField(auto_now_add=True)
    is_staff = models.BooleanField(default=False)
    avatar_url = models.URLField(blank=True, default="")

    USERNAME_FIELD = 'correo'
    REQUIRED_FIELDS = ['nombre', 'pais', 'pasaporte']

    objects = UsuarioManager()

    def __str__(self):
        return f"{self.nombre} ({self.rol})"

    @property
    def is_active(self):
        return self.estado

    def set_password(self, raw_password):
        from django.contrib.auth.hashers import make_password
        self.contrasenia = make_password(raw_password)

    def check_password(self, raw_password):
        from django.contrib.auth.hashers import check_password
        return check_password(raw_password, self.contrasenia)


class Hotel(models.Model):
    id_hotel = models.BigAutoField(primary_key=True)
    nombre = models.CharField(max_length=255)
    ubicacion = models.CharField(max_length=255)
    departamento = models.CharField(max_length=100)
    calificacion = models.FloatField()
    estado = models.BooleanField(default=True)
    fecha_creacion = models.DateField(auto_now_add=True)
    url = models.CharField(max_length=255, default="")
    url_imagen_hotel = models.TextField(blank=True)


class LugarTuristico(models.Model):
    id_lugar = models.BigAutoField(primary_key=True)
    nombre = models.CharField(max_length=255)
    ubicacion = models.CharField(max_length=255)
    departamento = models.CharField(max_length=100)
    tipo = models.CharField(max_length=50)
    fecha_creacion = models.DateField(auto_now_add=True)
    horario = models.CharField(max_length=255, blank=True, default="")
    descripcion = models.TextField(blank=True, default="")
    url_image_lugar_turistico = models.TextField(blank=True, default="")
    estado = models.BooleanField(default=True)


class Pago(models.Model):
    id_pago = models.BigAutoField(primary_key=True)
    tipo_pago = models.CharField(max_length=50)
    monto = models.FloatField()
    fecha = models.DateField()
    fecha_creacion = models.DateField(auto_now_add=True)

    class Estado(models.TextChoices):
        PENDIENTE = 'pendiente', 'Pendiente'
        PROCESANDO = 'procesando', 'Procesando'
        COMPLETADO = 'completado', 'Completado'
        FALLIDO = 'fallido', 'Fallido'
        REEMBOLSADO = 'reembolsado', 'Reembolsado'
        CANCELADO = 'cancelado', 'Cancelado'

    estado = models.CharField(max_length=15, choices=Estado.choices, default=Estado.PENDIENTE)


class Habitacion(models.Model):
    num = models.BigAutoField(primary_key=True)
    caracteristicas = models.TextField()
    precio = models.FloatField()
    codigo_hotel = models.ForeignKey(Hotel, on_delete=models.CASCADE)
    disponible = models.BooleanField(default=True)
    fecha_creacion = models.DateField(auto_now_add=True)
    cant_huespedes = models.IntegerField()


class Paquete(models.Model):
    id_paquete = models.BigAutoField(primary_key=True)
    nombre = models.CharField(max_length=255, default="sin nombre")
    tipo = models.CharField(max_length=100, blank=True, default="")
    precio = models.FloatField()
    id_hotel = models.ForeignKey(Hotel, on_delete=models.CASCADE, null=True, blank=True)
    id_lugar = models.ForeignKey(LugarTuristico, on_delete=models.CASCADE)
    estado = models.BooleanField(default=True)
    fecha_creacion = models.DateField(auto_now_add=True)

    def __str__(self):
        return f"{self.nombre} ({self.tipo})"


class Reserva(models.Model):
    id_reserva = models.BigAutoField(primary_key=True)
    fecha_reserva = models.DateField()
    fecha_caducidad = models.DateField()
    num_habitacion = models.ForeignKey(Habitacion, on_delete=models.CASCADE)
    codigo_hotel = models.ForeignKey(Hotel, on_delete=models.CASCADE)
    fecha_creacion = models.DateField(auto_now_add=True)
    id_usuario = models.ForeignKey(Usuario, on_delete=models.CASCADE)
    id_pago = models.ForeignKey(Pago, on_delete=models.CASCADE, null=True)
    estado = models.BooleanField(default=True)
    id_paquete = models.ForeignKey(Paquete, on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["num_habitacion", "fecha_reserva", "fecha_caducidad"]),
        ]


class Sugerencias(models.Model):
    id_sugerencia = models.BigAutoField(primary_key=True)
    preferencias = models.TextField()
    id_usuario = models.ForeignKey(Usuario, on_delete=models.CASCADE)
    fecha_creacion = models.DateField(auto_now_add=True)


class ChatSession(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    usuario = models.ForeignKey(Usuario, on_delete=models.SET_NULL, null=True, blank=True, db_constraint=False)
    title = models.CharField(max_length=120, blank=True, default="")
    archived = models.BooleanField(default=False)
    messages_count = models.PositiveIntegerField(default=0)
    last_message_at = models.DateTimeField(null=True, blank=True)

    history = models.JSONField(default=list)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def ensure_metadata(self):
        changed = False
        if not self.messages_count:
            self.messages_count = len(self.history or [])
            changed = True
        if not self.last_message_at:
            try:
                last_ts = None
                for h in (self.history or []):
                    ts = h.get("ts")
                    if ts:
                        try:
                            from django.utils.dateparse import parse_datetime
                            dt = parse_datetime(ts) or timezone.now()
                        except Exception:
                            dt = timezone.now()
                        if (last_ts is None) or (dt > last_ts):
                            last_ts = dt
                self.last_message_at = last_ts or self.updated_at
                changed = True
            except Exception:
                self.last_message_at = self.updated_at
                changed = True
        if not self.title:
            # Usa el primer prompt del usuario como título
            for h in (self.history or []):
                if h.get("role") == "user":
                    txt = (h.get("content") or "").strip()
                    if txt:
                        self.title = (txt[:60] + ("…" if len(txt) > 60 else ""))
                        changed = True
                        break
        if changed:
            self.save(update_fields=["messages_count", "last_message_at", "title", "updated_at"])


class Notification(models.Model):
    id = models.AutoField(primary_key=True)
    usuario = models.ForeignKey(Usuario, on_delete=models.CASCADE, related_name='notifications')
    title = models.CharField(max_length=100)
    message = models.TextField()
    read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    link = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Notificación para {self.usuario.nombre}: {self.title}"


class Review(models.Model):
    MIN_RATING = 1
    MAX_RATING = 5
    RATING_CHOICES = [(i, i) for i in range(MIN_RATING, MAX_RATING + 1)]
    
    id_review = models.BigAutoField(primary_key=True)
    usuario = models.ForeignKey(Usuario, on_delete=models.CASCADE, related_name='reviews')

    hotel = models.ForeignKey(Hotel, on_delete=models.CASCADE, null=True, blank=True, related_name='reviews')
    lugar_turistico = models.ForeignKey(LugarTuristico, on_delete=models.CASCADE, null=True, blank=True, related_name='reviews')
    paquete = models.ForeignKey(Paquete, on_delete=models.CASCADE, null=True, blank=True, related_name='reviews')
    
    calificacion = models.IntegerField(choices=RATING_CHOICES)
    comentario = models.TextField()
    fecha_creacion = models.DateTimeField(auto_now_add=True)
    estado = models.BooleanField(default=True)  # Active/inactive

    class Meta:
        ordering = ['-fecha_creacion']
        indexes = [
            models.Index(fields=['hotel', 'estado']),
            models.Index(fields=['lugar_turistico', 'estado']),
            models.Index(fields=['paquete', 'estado']),
        ]

    def __str__(self):
        target = self.hotel or self.lugar_turistico or self.paquete
        return f"Review de {self.usuario.nombre} - {target} ({self.calificacion}★)"

    def clean(self):
        from django.core.exceptions import ValidationError
        self._validate_single_target()

    def _validate_single_target(self):
        """Ensure exactly one target (hotel, lugar_turistico, or paquete) is set"""
        from django.core.exceptions import ValidationError
        targets = sum([
            self.hotel is not None,
            self.lugar_turistico is not None,
            self.paquete is not None
        ])
        if targets != 1:
            raise ValidationError(
                'Review must be associated with exactly one target (hotel, lugar_turistico, or paquete)'
            )
