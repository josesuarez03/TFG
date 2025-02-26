import uuid
from django.db import models
from django.contrib.auth.models import AbstractUser
from django.utils.translation import gettext_lazy as _
from ..common.security.utils import sanitize_input

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
    foto = models.ImageField(upload_to='users/', blank=True, null=True)
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
    
    def check_profile_completion(self):
        """Verifica si el perfil del usuario está completo según su tipo"""
        base_fields = [self.first_name, self.last_name, self.fecha_nacimiento, self.telefono, self.direccion]
        
        if self.tipo == 'patient' and getattr(self, 'patient', None):
            if all(base_fields):
                self.is_profile_completed = True
                if self.patient.allergies and self.patient.ocupacion:
                    self.is_profile_completed = True
            else:
                self.is_profile_completed = False
                
        elif self.tipo == 'doctor' and getattr(self, 'doctor', None):
            if all(base_fields) and self.doctor.especialidad and self.doctor.numero_licencia:
                self.is_profile_completed = True
            else:
                self.is_profile_completed = False
                
        elif self.tipo in 'admin':
            # Para personal administrativo, solo información básica
            if all(base_fields):
                self.is_profile_completed = True
            else:
                self.is_profile_completed = False
                
        self.save(update_fields=['is_profile_completed'])
        return self.is_profile_completed
    
    def save(self, *args, **kwargs):
        # Sanitizar los campos sensibles antes de guardar
        self.first_name = sanitize_input(self.first_name)
        self.last_name = sanitize_input(self.last_name)
        self.telefono = sanitize_input(self.telefono)
        self.direccion = sanitize_input(self.direccion)
        self.oauth_provider = sanitize_input(self.oauth_provider)
        self.oauth_uid = sanitize_input(self.oauth_uid)
        super().save(*args, **kwargs)

    
class Patient(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='patient')

    triaje_level = models.CharField(max_length=20, blank=True, null=True)
    ocupacion = models.CharField(max_length=100, blank=True, null=True)
    pain_scale = models.IntegerField(blank=True, null=True)
    medical_context = models.TextField(blank=True, null=True)
    allergies = models.TextField(blank=True, null=True)
    medications = models.TextField(blank=True, null=True)
    medical_history = models.TextField(blank=True, null=True)
    
    class Meta:
        verbose_name = _('paciente')
        verbose_name_plural = _('pacientes')
        
    def __str__(self):
        return f"{self.user.email} ({self.user.get_tipo_display()})"
    
    def save(self, *args, **kwargs):
        # Asegurar que el tipo de usuario es paciente
        if self.usuario.tipo != 'paciente':
            self.usuario.tipo = 'paciente'
            self.usuario.save(update_fields=['tipo'])

        self.triaje_level = sanitize_input(self.triaje_level)
        self.ocupacion = sanitize_input(self.ocupacion)
        self.medical_context = sanitize_input(self.medical_context)
        self.allergies = sanitize_input(self.allergies)
        self.medications = sanitize_input(self.medications)
        self.medical_history = sanitize_input(self.medical_history)

        super().save(*args, **kwargs)

    def update_from_chatbot_analysis(self, analysis_data):

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
        if self.usuario.tipo != 'doctor':
            self.usuario.tipo = 'doctor'
            self.usuario.save(update_fields=['tipo'])

        self.especialidad = sanitize_input(self.especialidad)
        self.numero_licencia = sanitize_input(self.numero_licencia)
        super().save(*args, **kwargs)