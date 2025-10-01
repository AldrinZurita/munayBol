from django.db import models

class Usuario(models.Model):
    ci = models.BigIntegerField(primary_key=True)
    nombre = models.CharField(max_length=255)
    correo = models.CharField(max_length=255)
    contrasenia = models.CharField(max_length=255)
    rol = models.CharField(max_length=50)
    pais = models.CharField(max_length=50)
    pasaporte = models.CharField(max_length=50)
    estado = models.BooleanField()
    fecha_creacion = models.DateField()

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
    horario = models.CharField(max_length=255)
    descripcion = models.TextField()
    url_image_lugar_turistico = models.TextField()

class Pago(models.Model):
    id_pago = models.BigIntegerField(primary_key=True)
    tipo_pago = models.CharField(max_length=50)
    monto = models.FloatField()
    fecha = models.DateField()
    fecha_creacion = models.DateField()

class Habitacion(models.Model):
    num = models.CharField(primary_key=True, max_length=20)
    caracteristicas = models.TextField()
    precio = models.FloatField()
    codigo_hotel = models.ForeignKey(Hotel, on_delete=models.CASCADE)
    disponible = models.BooleanField()
    fecha_creacion = models.DateField()
    cant_huespedes = models.IntegerField()

class Reserva(models.Model):
    id_reserva = models.BigIntegerField(primary_key=True)
    fecha_reserva = models.DateField()
    fecha_caducidad = models.DateField()
    num_habitacion = models.ForeignKey(Habitacion, on_delete=models.CASCADE)
    codigo_hotel = models.ForeignKey(Hotel, on_delete=models.CASCADE)
    fecha_creacion = models.DateField()
    ci_usuario = models.ForeignKey(Usuario, on_delete=models.CASCADE)
    id_pago = models.ForeignKey(Pago, on_delete=models.CASCADE)

class Paquete(models.Model):
    id_paquete = models.BigIntegerField(primary_key=True)
    precio = models.FloatField()
    id_reserva = models.ForeignKey(Reserva, on_delete=models.CASCADE)
    id_lugar = models.ForeignKey(LugarTuristico, on_delete=models.CASCADE)
    fecha_creacion = models.DateField()

class Sugerencias(models.Model):
    id_sugerencia = models.BigIntegerField(primary_key=True)
    preferencias = models.TextField()
    ci_usuario = models.ForeignKey(Usuario, on_delete=models.CASCADE)
    fecha_creacion = models.DateField()