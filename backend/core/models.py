from django.db import models
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager

class UsuarioManager(BaseUserManager):
    def create_user(self, correo, contrasenia=None, **extra_fields):
        extra_fields.setdefault('rol', 'usuario')
        extra_fields.setdefault('is_superuser', False)
        extra_fields.setdefault('is_staff', False)
        if not correo:
            raise ValueError('El usuario debe tener un correo')
        correo = self.normalize_email(correo)
        user = self.model(correo=correo, **extra_fields)
        user.set_password(contrasenia)
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
    id_hotel = models.BigIntegerField(primary_key=True)
    nombre = models.CharField(max_length=255)
    ubicacion = models.CharField(max_length=255)
    departamento = models.CharField(max_length=100)
    calificacion = models.FloatField()
    estado = models.BooleanField()
    fecha_creacion = models.DateField()
    url = models.CharField(max_length=255, default="")
    url_imagen_hotel = models.TextField(blank=True)

class LugarTuristico(models.Model):
    id_lugar = models.BigIntegerField(primary_key=True)
    nombre = models.CharField(max_length=255)
    ubicacion = models.CharField(max_length=255)
    departamento = models.CharField(max_length=100)
    tipo = models.CharField(max_length=50)
    fecha_creacion = models.DateField()
    horario = models.CharField(max_length=255, blank=True, default="")
    descripcion = models.TextField(blank=True, default="")
    url_image_lugar_turistico = models.TextField(blank=True, default="")
    estado = models.BooleanField(default=True)

class Pago(models.Model):
    id_pago = models.BigAutoField(primary_key=True)
    tipo_pago = models.CharField(max_length=50)
    monto = models.FloatField()
    fecha = models.DateField()
    fecha_creacion = models.DateField()

    class Estado(models.TextChoices):
        PENDIENTE = 'pendiente', 'Pendiente'
        PROCESANDO = 'procesando', 'Procesando'
        COMPLETADO = 'completado', 'Completado'
        FALLIDO = 'fallido', 'Fallido'
        REEMBOLSADO = 'reembolsado', 'Reembolsado'
        CANCELADO = 'cancelado', 'Cancelado'
    estado = models.CharField(max_length=15, choices=Estado.choices, default=Estado.PENDIENTE)

class Habitacion(models.Model):
    num = models.CharField(primary_key=True, max_length=20)
    caracteristicas = models.TextField()
    precio = models.FloatField()
    codigo_hotel = models.ForeignKey(Hotel, on_delete=models.CASCADE)
    disponible = models.BooleanField()
    fecha_creacion = models.DateField()
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
    fecha_creacion = models.DateField()
    id_usuario = models.ForeignKey(Usuario, on_delete=models.CASCADE)
    id_pago = models.ForeignKey(Pago, on_delete=models.CASCADE, null=True)
    estado = models.BooleanField(default=True)
    id_paquete = models.ForeignKey(Paquete, on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["num_habitacion", "fecha_reserva", "fecha_caducidad"]),
        ]

class Sugerencias(models.Model):
    id_sugerencia = models.BigIntegerField(primary_key=True)
    preferencias = models.TextField()
    id_usuario = models.ForeignKey(Usuario, on_delete=models.CASCADE)
    fecha_creacion = models.DateField()