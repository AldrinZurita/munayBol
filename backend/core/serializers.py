from rest_framework import serializers
from .models import Usuario, Hotel, LugarTuristico, Pago, Habitacion, Reserva, Paquete, Sugerencias, Notification

class UsuarioSerializer(serializers.ModelSerializer):
    class Meta:
        model = Usuario
        fields = '__all__'
        read_only_fields = ['rol', 'estado', 'fecha_creacion']
        extra_kwargs = {
            'contrasenia': {'write_only': True}
        }

class SuperUsuarioRegistroSerializer(serializers.ModelSerializer):
    class Meta:
        model = Usuario
        fields = ['id', 'nombre', 'correo', 'contrasenia', 'pais', 'pasaporte']
        extra_kwargs = {
            'contrasenia': {'write_only': True}
        }
    def create(self, validated_data):
        validated_data['rol'] = 'superadmin'
        # No hash aquí, el manager lo hace
        return Usuario.objects.create_superuser(**validated_data)

class RegistroSerializer(serializers.ModelSerializer):
    class Meta:
        model = Usuario
        fields = ['id', 'nombre', 'correo', 'contrasenia', 'pais', 'pasaporte']
        extra_kwargs = {
            'contrasenia': {'write_only': True}
        }
    def create(self, validated_data):
        validated_data['rol'] = 'usuario'
        # No hash aquí, el manager lo hace
        return Usuario.objects.create_user(**validated_data)

class HotelSerializer(serializers.ModelSerializer):
    class Meta:
        model = Hotel
        fields = '__all__'

class LugarTuristicoSerializer(serializers.ModelSerializer):
    class Meta:
        model = LugarTuristico
        fields = '__all__'

class PagoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Pago
        fields = '__all__'
        read_only_fields = ('id_pago',)

    def create(self, validated_data):
        from datetime import date
        if 'fecha' not in validated_data:
            validated_data['fecha'] = date.today()
        if 'fecha_creacion' not in validated_data:
            validated_data['fecha_creacion'] = date.today()
        if 'estado' not in validated_data:
            validated_data['estado'] = 'pendiente'
        return super().create(validated_data)

class HabitacionSerializer(serializers.ModelSerializer):
    codigo_hotel = serializers.PrimaryKeyRelatedField(read_only=True)
    hotel = HotelSerializer(source='codigo_hotel', read_only=True)
    class Meta:
        model = Habitacion
        fields = ['num', 'caracteristicas', 'precio', 'codigo_hotel', 'hotel', 'disponible', 'fecha_creacion', 'cant_huespedes']

class ReservaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Reserva
        fields = '__all__'
        read_only_fields = ('id_reserva', 'fecha_creacion', 'estado', 'id_usuario')

    def validate(self, attrs):
        habitacion = attrs.get('num_habitacion')
        codigo_hotel = attrs.get('codigo_hotel')
        if habitacion and not codigo_hotel:
            attrs['codigo_hotel'] = habitacion.codigo_hotel
        if habitacion and codigo_hotel and habitacion.codigo_hotel_id != codigo_hotel.id_hotel:
            raise serializers.ValidationError('La habitación no pertenece al hotel especificado.')
        fecha_reserva = attrs.get('fecha_reserva')
        fecha_caducidad = attrs.get('fecha_caducidad')
        if fecha_reserva and fecha_caducidad and fecha_caducidad < fecha_reserva:
            raise serializers.ValidationError('La fecha_caducidad no puede ser anterior a fecha_reserva.')
        if habitacion and fecha_reserva and fecha_caducidad:
            overlapping = Reserva.objects.filter(
                num_habitacion=habitacion,
                fecha_reserva__lte=fecha_caducidad,
                fecha_caducidad__gte=fecha_reserva
            )
            if self.instance:
                overlapping = overlapping.exclude(pk=self.instance.pk)
            if overlapping.exists():
                raise serializers.ValidationError('La habitación ya está reservada en el rango de fechas solicitado.')
        return attrs

    def create(self, validated_data):
        from datetime import date
        if 'fecha_creacion' not in validated_data:
            validated_data['fecha_creacion'] = date.today()
        return super().create(validated_data)

class PaqueteSerializer(serializers.ModelSerializer):
    hotel = HotelSerializer(source='id_hotel', read_only=True)
    lugar = LugarTuristicoSerializer(source='id_lugar', read_only=True)

    class Meta:
        model = Paquete
        fields = '__all__'
        read_only_fields = ('id_paquete', 'fecha_creacion')

class SugerenciasSerializer(serializers.ModelSerializer):
    class Meta:
        model = Sugerencias
        fields = '__all__'

class LoginSerializer(serializers.Serializer):
    correo = serializers.EmailField()
    contrasenia = serializers.CharField()

class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ['id', 'title', 'message', 'read', 'created_at', 'link']