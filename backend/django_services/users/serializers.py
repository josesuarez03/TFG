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
        fields = ('id', 'email', 'username', 'password', 'password2', 'first_name', 'last_name', 'tipo')
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
        fields = ('id', 'triaje_level', 'ocupacion', 'pain_scale', 'medical_context', 
                  'allergies', 'medications', 'medical_history', 'last_chatbot_analysis')
        read_only_fields = ('id', 'last_chatbot_analysis')

class DoctorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Doctor
        fields = ('id', 'especialidad', 'numero_licencia')
        read_only_fields = ('id',)

class UserProfileSerializer(serializers.ModelSerializer):
    patient = PatientSerializer(required=False)
    doctor = DoctorSerializer(required=False)
    
    class Meta:
        model = User
        fields = ('id', 'email', 'username', 'first_name', 'last_name', 'tipo',
                  'fecha_nacimiento', 'genero', 'telefono', 'direccion', 
                  'is_profile_completed', 'patient', 'doctor', 'date_joined', 
                  'last_login', 'is_active')
        read_only_fields = ('id', 'email', 'username', 'is_profile_completed', 
                            'date_joined', 'last_login')

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
        fields = ('id', 'email', 'username', 'first_name', 'last_name', 
                 'is_profile_completed', 'is_active', 'date_joined', 'last_login', 'tipo')
        read_only_fields = ('id', 'email', 'username', 'is_profile_completed', 
                           'date_joined', 'last_login')

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
    
    # Campos para pacientes - Estos son los únicos requeridos inicialmente
    allergies = serializers.CharField(required=False)
    ocupacion = serializers.CharField(required=False)
    
    # Campos para médicos
    especialidad = serializers.CharField(required=False)
    numero_licencia = serializers.CharField(required=False)
    
    def validate(self, attrs):
        tipo = attrs.get('tipo')
        
        # Validar campos según el tipo de usuario
        if tipo == 'patient':
            # Pacientes requieren al menos ocupación y alergias inicialmente
            if not attrs.get('allergies'):
                raise serializers.ValidationError({"allergies": "Este campo es requerido para pacientes"})
            if not attrs.get('ocupacion'):
                raise serializers.ValidationError({"ocupacion": "Este campo es requerido para pacientes"})
        
        elif tipo == 'doctor':
            # Médicos requieren especialidad y número de licencia
            if not attrs.get('especialidad'):
                raise serializers.ValidationError({"especialidad": "Este campo es requerido para médicos"})
            if not attrs.get('numero_licencia'):
                raise serializers.ValidationError({"numero_licencia": "Este campo es requerido para médicos"})
        
        return attrs

class ChatbotAnalysisSerializer(serializers.Serializer):
    """Serializador para validar datos del análisis del chatbot"""
    triaje_level = serializers.CharField(required=False, allow_null=True)
    pain_scale = serializers.IntegerField(required=False, allow_null=True)
    medical_context = serializers.CharField(required=False, allow_null=True)
    allergies = serializers.CharField(required=False, allow_null=True)
    medications = serializers.CharField(required=False, allow_null=True)
    medical_history = serializers.CharField(required=False, allow_null=True)
    ocupacion = serializers.CharField(required=False, allow_null=True)

class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)
    def validate_email(self, value):
        if not User.objects.filter(email=value).exists():
            raise serializers.ValidationError("No existe un usuario con este correo electrónico.")
        return value

class PasswordResetVerifySerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)
    code = serializers.CharField(required=True, min_length=6, max_length=6)
    new_password = serializers.CharField(required=True)
    confirm_password = serializers.CharField(required=True)
    
    def validate(self, data):
        if data['new_password'] != data['confirm_password']:
            raise serializers.ValidationError({"confirm_password": "Las contraseñas no coinciden"})
        return data
    
class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True)
    confirm_password = serializers.CharField(required=True)
    
    def validate(self, data):
        if data['new_password'] != data['confirm_password']:
            raise serializers.ValidationError({"confirm_password": "Las contraseñas no coinciden"})
        return data

class AccountDeleteSerializer(serializers.Serializer):
    password = serializers.CharField(required=False)