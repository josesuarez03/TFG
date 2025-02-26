from django.contrib import admin
from django.contrib.auth import get_user_model
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.utils.translation import gettext_lazy as _
from .models import Patient, Doctor

User = get_user_model()

@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ('email', 'username', 'first_name', 'last_name', 'tipo', 
                    'is_profile_completed', 'date_joined', 'is_active')
    list_filter = ('is_active', 'is_staff', 'tipo', 'is_profile_completed', 'oauth_provider')
    search_fields = ('email', 'username', 'first_name', 'last_name')
    ordering = ('-date_joined',)
    
    fieldsets = (
        (None, {'fields': ('email', 'username', 'password')}),
        (_('Información personal'), {'fields': ('first_name', 'last_name', 'fecha_nacimiento', 'genero')}),
        (_('Información de contacto'), {'fields': ('telefono', 'direccion')}),
        (_('Tipo de usuario'), {'fields': ('tipo', 'is_profile_completed')}),
        (_('OAuth'), {'fields': ('oauth_provider', 'oauth_uid'), 
                     'classes': ('collapse',)}),
        (_('Permisos'), {'fields': ('is_active', 'is_staff', 'is_superuser',
                                   'groups', 'user_permissions')}),
        (_('Fechas importantes'), {'fields': ('last_login', 'date_joined', 'last_updated')}),
    )
    
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'username', 'password1', 'password2'),
        }),
    )
    
    readonly_fields = ('date_joined', 'last_login', 'last_updated')

@admin.register(Patient)
class PatientAdmin(admin.ModelAdmin):
    list_display = ('user', 'triaje_level', 'ocupacion', 'pain_scale')
    search_fields = ('user__email', 'user__first_name', 'user__last_name')
    list_filter = ('triaje_level',)
    raw_id_fields = ('user',)

@admin.register(Doctor)
class DoctorAdmin(admin.ModelAdmin):
    list_display = ('user', 'especialidad', 'numero_licencia')
    search_fields = ('user__email', 'user__first_name', 'user__last_name', 'especialidad')
    list_filter = ('especialidad',)
    raw_id_fields = ('user',)