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
    