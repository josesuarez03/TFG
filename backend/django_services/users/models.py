import uuid
from django.db import models
from django.contrib.auth.models import AbstractUser
from django.utils.translation import gettext_lazy as _
from common.security.utils import sanitize_input

class User(AbstractUser):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(_('email address'), unique=True)
    oauth_provider = models.CharField(max_length=50, blank=True, null=True)
    oauth_uid = models.CharField(max_length=255, blank=True, null=True)

    TIPO_USER = (
        ('admin', 'Administrador'),
        ('patient', 'Paciente'),
        ('doctor', 'Doctor'),
    )

    tipo = models.CharField(max_length=10, choices=TIPO_USER, default='patient')
    fecha_nacimiento = models.DateField(blank=True, null=True)
    telefono = models.CharField(max_length=20, blank=True, null=True)
    direccion = models.CharField(max_length=255, blank=True, null=True)
    #foto = models.ImageField(upload_to='users/', blank=True, null=True)
    genero = models.CharField(max_length=10, blank=True, null=True)
 
    # Control de perfil
    is_profile_completed = models.BooleanField(default=False, verbose_name="Perfil completado")
    date_joined = models.DateTimeField(auto_now_add=True)
    last_updated = models.DateTimeField(auto_now=True)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']

    class Meta:
        verbose_name = _('usuario')
        verbose_name_plural = _('usuarios')
        
    def __str__(self):
        return f"{self.email} ({self.get_tipo_display()})"
    
    def check_profile_completion(self, **kwargs):
        """Verifica si el perfil del usuario está completo según su tipo"""
        # Campos base que son requeridos para todos los tipos de usuarios
        base_fields = [self.first_name, self.last_name, self.fecha_nacimiento, self.telefono, self.direccion]
        
        if self.tipo == 'patient':
            # Para pacientes, solo verificamos que los campos base estén completos
            # y que el modelo Patient esté creado (los campos médicos pueden estar vacíos)
            patient = getattr(self, 'patient', None)
            if all(base_fields) and patient is not None:
                # La ocupación y alergias son los únicos campos requeridos inicialmente
                if patient.ocupacion and patient.allergies:
                    self.is_profile_completed = True
                else:
                    self.is_profile_completed = False
            else:
                self.is_profile_completed = False
                
        elif self.tipo == 'doctor':
            # Para doctores, verificamos campos base y profesionales
            doctor = getattr(self, 'doctor', None)
            if all(base_fields) and doctor is not None:
                if doctor.especialidad and doctor.numero_licencia:
                    self.is_profile_completed = True
                else:
                    self.is_profile_completed = False
            else:
                self.is_profile_completed = False
                
        elif self.tipo == 'admin':
            # Para administradores, solo la información básica
            if all(base_fields):
                self.is_profile_completed = True
            else:
                self.is_profile_completed = False
        
        # Guardar solo el campo actualizado para evitar modificar otros campos
        # si este método se llama como parte de otro proceso de guardado
        if 'update_fields' not in kwargs or kwargs['update_fields'] is None:
            self.save(update_fields=['is_profile_completed'])
        elif 'is_profile_completed' not in kwargs['update_fields']:
            kwargs['update_fields'].append('is_profile_completed')
            self.save(**kwargs)
        return self.is_profile_completed
    
    def save(self, *args, **kwargs):
        # Sanitizar los campos sensibles antes de guardar
        if self.first_name:
            self.first_name = sanitize_input(self.first_name)
        if self.last_name:
            self.last_name = sanitize_input(self.last_name)
        if self.telefono:
            self.telefono = sanitize_input(self.telefono)
        if self.direccion:
            self.direccion = sanitize_input(self.direccion)
        if self.oauth_provider:
            self.oauth_provider = sanitize_input(self.oauth_provider)
        if self.oauth_uid:
            self.oauth_uid = sanitize_input(self.oauth_uid)
        super().save(*args, **kwargs)

    
class Patient(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='patient')

    # Campos que pueden ser completados por el chatbot
    triaje_level = models.CharField(max_length=20, blank=True, null=True)
    ocupacion = models.CharField(max_length=100, blank=True, null=True)
    pain_scale = models.IntegerField(blank=True, null=True)
    medical_context = models.TextField(blank=True, null=True)
    allergies = models.TextField(blank=True, null=True)
    medications = models.TextField(blank=True, null=True)
    medical_history = models.TextField(blank=True, null=True)
    
    # Campo para seguimiento del análisis del chatbot
    last_chatbot_analysis = models.DateTimeField(blank=True, null=True)
    
    class Meta:
        verbose_name = _('paciente')
        verbose_name_plural = _('pacientes')
        
    def __str__(self):
        return f"{self.user.email} ({self.user.get_tipo_display()})"
    
    def save(self, *args, **kwargs):
        # Asegurar que el tipo de usuario es paciente
        if self.user.tipo != 'patient':
            self.user.tipo = 'patient'
            self.user.save(update_fields=['tipo'])

        # Sanitizar los campos proporcionados
        if self.triaje_level:
            self.triaje_level = sanitize_input(self.triaje_level)
        if self.ocupacion:
            self.ocupacion = sanitize_input(self.ocupacion)
        if self.medical_context:
            self.medical_context = sanitize_input(self.medical_context)
        if self.allergies:
            self.allergies = sanitize_input(self.allergies)
        if self.medications:
            self.medications = sanitize_input(self.medications)
        if self.medical_history:
            self.medical_history = sanitize_input(self.medical_history)

        super().save(*args, **kwargs)

    def update_from_chatbot_analysis(self, analysis_data):
        """
        Actualiza los campos del paciente con la información analizada por el chatbot
        Parámetro:
            analysis_data (dict): Diccionario con los datos analizados por el chatbot
        Retorna:
            bool: True si se actualizaron campos, False en caso contrario
        """
        import datetime
        
        # Campos que pueden ser actualizados desde el chatbot
        chatbot_fields = [
            'triaje_level', 'pain_scale', 'medical_context',
            'allergies', 'medications', 'medical_history', 'ocupacion'
        ]
        
        # Actualizar solo los campos que vienen en el análisis
        fields_updated = []
        for field in chatbot_fields:
            if field in analysis_data and analysis_data[field] is not None:
                setattr(self, field, analysis_data[field])
                fields_updated.append(field)
        
        # Registrar la fecha del análisis
        self.last_chatbot_analysis = datetime.datetime.now()
        fields_updated.append('last_chatbot_analysis')
        
        # Guardar cambios si hay algún campo actualizado
        if fields_updated:
            self.save(update_fields=fields_updated)
            # Verificar si con estos cambios el perfil ahora está completo
            self.user.check_profile_completion()
            return True
        
        return False
    
class Doctor(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='doctor')

    # Información profesional (si es médico)
    especialidad = models.CharField(max_length=100, blank=True, null=True)
    numero_licencia = models.CharField(max_length=50, blank=True, null=True)
    
    class Meta:
        verbose_name = _('doctor')
        verbose_name_plural = _('doctores')
        
    def __str__(self):
        return f"{self.user.email} ({self.user.get_tipo_display()})"
    
    def save(self, *args, **kwargs):
        # Asegurar que el tipo de usuario es doctor
        if self.user.tipo != 'doctor':
            self.user.tipo = 'doctor'
            self.user.save(update_fields=['tipo'])

        if self.especialidad:
            self.especialidad = sanitize_input(self.especialidad)
        if self.numero_licencia:
            self.numero_licencia = sanitize_input(self.numero_licencia)
        super().save(*args, **kwargs)