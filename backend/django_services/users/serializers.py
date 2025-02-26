from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework.validators import UniqueValidator
from .models import Patient, Doctor

User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(
        required=True,
        validators=[UniqueValidator(queryset=User.objects.all())]
    )
    password = serializers.CharField(write_only=True, required=True, validators=[validate_password])
    password2 = serializers.CharField(write_only=True, required=True)

    class Meta:
        model = User
        fields = ('email', 'username', 'password', 'password2', 'first_name', 'last_name', 'tipo')
        extra_kwargs = {
            'first_name': {'required': True},
            'last_name': {'required': True}
        }

    def validate(self, attrs):
        if attrs['password'] != attrs['password2']:
            raise serializers.ValidationError({"password": "Las contraseñas no coinciden"})
        return attrs

    def create(self, validated_data):
        validated_data.pop('password2')
        user = User.objects.create(
            username=validated_data['username'],
            email=validated_data['email'],
            first_name=validated_data['first_name'],
            last_name=validated_data['last_name'],
            tipo=validated_data.get('tipo', 'patient')
        )
        user.set_password(validated_data['password'])
        user.save()
        return user

class PatientSerializer(serializers.ModelSerializer):
    class Meta:
        model = Patient
        fields = ('triaje_level', 'ocupacion', 'pain_scale', 'medical_context', 
                  'allergies', 'medications', 'medical_history')

class DoctorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Doctor
        fields = ('especialidad', 'numero_licencia')

class UserProfileSerializer(serializers.ModelSerializer):
    patient = PatientSerializer(required=False)
    doctor = DoctorSerializer(required=False)
    
    class Meta:
        model = User
        fields = ('email', 'username', 'first_name', 'last_name', 'tipo',
                  'fecha_nacimiento', 'genero', 'telefono', 'direccion', 
                  'is_profile_completed', 'patient', 'doctor')
        read_only_fields = ('email', 'username', 'is_profile_completed')

    def update(self, instance, validated_data):
        patient_data = validated_data.pop('patient', None)
        doctor_data = validated_data.pop('doctor', None)
        
        # Actualizar campos del usuario
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        
        # Actualizar o crear el perfil de paciente si es necesario
        if instance.tipo == 'patient' and patient_data:
            patient, created = Patient.objects.get_or_create(user=instance)
            for attr, value in patient_data.items():
                setattr(patient, attr, value)
            patient.save()
        
        # Actualizar o crear el perfil de doctor si es necesario
        if instance.tipo == 'doctor' and doctor_data:
            doctor, created = Doctor.objects.get_or_create(user=instance)
            for attr, value in doctor_data.items():
                setattr(doctor, attr, value)
            doctor.save()
        
        instance.save()
        # Verificar si el perfil está completo
        instance.check_profile_completion()
        return instance

class UserProfileSerializerBasic(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('email', 'username', 'first_name', 'last_name', 'is_profile_completed')
        read_only_fields = ('email', 'username', 'is_profile_completed')

    def update(self, instance, validated_data):
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        # Verificar si el perfil está completo
        instance.check_profile_completion()
        return instance

class GoogleOAuthUserInfoSerializer(serializers.Serializer):
    """Serializador para recibir información de Google OAuth"""
    token = serializers.CharField(required=True)

class RequiredOAuthUserSerializer(serializers.Serializer):
    tipo = serializers.ChoiceField(choices=User.TIPO_USER, required=True)
    fecha_nacimiento = serializers.DateField(required=True)
    telefono = serializers.CharField(required=True)
    direccion = serializers.CharField(required=True)
    genero = serializers.CharField(required=False)
    
    # Campos para pacientes
    allergies = serializers.CharField(required=False)
    ocupacion = serializers.CharField(required=False)
    
    # Campos para médicos
    especialidad = serializers.CharField(required=False)
    numero_licencia = serializers.CharField(required=False)
    
    def validate(self, attrs):
        tipo = attrs.get('tipo')
        
        # Validar campos según el tipo de usuario
        if tipo == 'patient':
            if not attrs.get('allergies'):
                raise serializers.ValidationError({"allergies": "Este campo es requerido para pacientes"})
            if not attrs.get('ocupacion'):
                raise serializers.ValidationError({"ocupacion": "Este campo es requerido para pacientes"})
        
        elif tipo == 'doctor':
            if not attrs.get('especialidad'):
                raise serializers.ValidationError({"especialidad": "Este campo es requerido para médicos"})
            if not attrs.get('numero_licencia'):
                raise serializers.ValidationError({"numero_licencia": "Este campo es requerido para médicos"})
        
        return attrs