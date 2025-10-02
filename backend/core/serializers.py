from rest_framework import serializers
from .models import Usuario, Hotel, LugarTuristico, Pago, Habitacion, Reserva, Paquete, Sugerencias

class UsuarioSerializer(serializers.ModelSerializer):
    class Meta:
        model = Usuario
        fields = '__all__'

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
        return super().create(validated_data)

class HabitacionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Habitacion
        fields = '__all__'

class ReservaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Reserva
        fields = '__all__'
        read_only_fields = ('id_reserva', 'fecha_creacion')

    def validate(self, attrs):
        # Si llega num_habitacion, podemos derivar codigo_hotel si no viene.
        habitacion = attrs.get('num_habitacion')
        codigo_hotel = attrs.get('codigo_hotel')
        if habitacion and not codigo_hotel:
            attrs['codigo_hotel'] = habitacion.codigo_hotel
        # Validar coherencia si ambos vienen
        if habitacion and codigo_hotel and habitacion.codigo_hotel_id != codigo_hotel.id_hotel:
            raise serializers.ValidationError('La habitación no pertenece al hotel especificado.')
        # Rango básico de fechas
        fecha_reserva = attrs.get('fecha_reserva')
        fecha_caducidad = attrs.get('fecha_caducidad')
        if fecha_reserva and fecha_caducidad and fecha_caducidad < fecha_reserva:
            raise serializers.ValidationError('La fecha_caducidad no puede ser anterior a fecha_reserva.')

        # Validar solapamiento: existe intersección si (start1 <= end2) y (start2 <= end1)
        if habitacion and fecha_reserva and fecha_caducidad:
            overlapping = Reserva.objects.filter(
                num_habitacion=habitacion,
                fecha_reserva__lte=fecha_caducidad,
                fecha_caducidad__gte=fecha_reserva
            )
            # En create siempre es nueva, en update excluir la propia instancia
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
    class Meta:
        model = Paquete
        fields = '__all__'

class SugerenciasSerializer(serializers.ModelSerializer):
    class Meta:
        model = Sugerencias
        fields = '__all__' 

class LoginSerializer(serializers.Serializer):
    correo = serializers.EmailField()
    contrasenia = serializers.CharField()
    