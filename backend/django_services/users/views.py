from django.contrib.auth import get_user_model, authenticate
from django.conf import settings
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.http import Http404
from django.core.exceptions import PermissionDenied

from rest_framework import status, viewsets, generics, mixins
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.permissions import IsAuthenticated, IsAdminUser, AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.pagination import PageNumberPagination

from rest_framework_simplejwt.tokens import RefreshToken
from social_django.utils import load_strategy, load_backend
from social_core.exceptions import MissingBackend, AuthTokenError, AuthForbidden

from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.utils.crypto import get_random_string
from django.core.cache import cache

from .serializers import (
    UserSerializer, UserProfileSerializer, UserProfileSerializerBasic,
    GoogleOAuthUserInfoSerializer, RequiredOAuthUserSerializer, 
    PatientSerializer, DoctorSerializer, ChatbotAnalysisSerializer,
    PasswordResetRequestSerializer, PasswordResetVerifySerializer,
    ChangePasswordSerializer, AccountDeleteSerializer, PatientHistoryEntrySerializer,
    DoctorPatientRelationSerializer
)
from .models import Patient, Doctor, PatientHistoryEntry, DoctorPatientRelation

User = get_user_model()

class LoginView(APIView):
    permission_classes = [AllowAny]
    
    def post(self, request):
        # Obtener credenciales
        username_or_email = request.data.get('username_or_email')
        password = request.data.get('password')
        
        try:
            user = User.objects.get(email=username_or_email)
            username = user.username
        except User.DoesNotExist:
            # Si no existe un usuario con ese correo, asumir que es un nombre de usuario
            username = username_or_email

        # Autenticar usuario
        user = authenticate(username=username, password=password)
        
        if user is not None:
            if not user.is_active:
                return Response(
                    {"error": "La cuenta está desactivada."},
                    status=status.HTTP_401_UNAUTHORIZED
                )
                
            # Login exitoso, generar tokens JWT
            refresh = RefreshToken.for_user(user)
            
            return Response({
                'user': UserProfileSerializerBasic(user).data,
                'refresh': str(refresh),
                'access': str(refresh.access_token),
                'profile_complete': user.is_profile_completed,
                'message': 'Usuario autenticado correctamente.'
            }, status=status.HTTP_200_OK)
        
        # Credenciales inválidas
        return Response(
            {"error": "Credenciales inválidas."},
            status=status.HTTP_401_UNAUTHORIZED
        )
    
    # Añadir método OPTIONS para manejar solicitudes preflight explícitamente
    def options(self, request, *args, **kwargs):
        response = Response()
        response["Access-Control-Allow-Origin"] = "*"  # O el origen específico del frontend
        response["Access-Control-Allow-Methods"] = "POST, OPTIONS"
        response["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
        return response

class RegisterUserView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = self.serializer_class(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            refresh = RefreshToken.for_user(user)
            
            return Response({
                'user': UserProfileSerializerBasic(user).data,
                'refresh': str(refresh),
                'access': str(refresh.access_token),
                'profile_complete': False,
                'message': 'Usuario registrado correctamente. Complete su perfil.'
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    def options(self, request, *args, **kwargs):
        response = Response()
        response["Access-Control-Allow-Origin"] = "*"  # O el origen específico del frontend
        response["Access-Control-Allow-Methods"] = "POST, OPTIONS"
        response["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
        return response
    
class GoogleOAuthLoginView(APIView):
    """Vista para autenticación con Google (login o registro)"""
    permission_classes = [AllowAny]
    serializer_class = GoogleOAuthUserInfoSerializer

    @transaction.atomic
    def post(self, request):
        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)  # Simplifica la validación

        token = serializer.validated_data['token']
        provider = 'google-oauth2'

        try:
            strategy = load_strategy(request)
            backend = load_backend(strategy, provider, redirect_uri=None)
            user = backend.do_auth(token)

            if not user:
                return Response(
                    {"error": "Error de autenticación con Google."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Actualizar campos del usuario
            user.oauth_provider = 'google'
            user.oauth_uid = getattr(user, 'social_user', {}).get('uid', user.oauth_uid)
            is_new_user = user.date_joined == user.last_login

            if is_new_user and 'tipo' in request.data:
                user.tipo = request.data.get('tipo', 'patient')

            user.save(update_fields=['oauth_provider', 'oauth_uid', 'tipo'])

            refresh = RefreshToken.for_user(user)
            response_data = {
                'user': UserProfileSerializerBasic(user).data,
                'refresh': str(refresh),
                'access': str(refresh.access_token),
                'is_new_user': is_new_user,
                'profile_complete': user.is_profile_completed
            }

            return Response(response_data, status=status.HTTP_200_OK)

        except (MissingBackend, AuthTokenError, AuthForbidden) as e:
            return Response(
                {"error": f"Error en autenticación con Google: {str(e)}"},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    def options(self, request, *args, **kwargs):
        response = Response()
        response["Access-Control-Allow-Origin"] = "*"  # O el origen específico del frontend
        response["Access-Control-Allow-Methods"] = "POST, OPTIONS"
        response["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
        return response

class CompleteProfileView(generics.UpdateAPIView):
    """Vista para completar información adicional después del registro/login con OAuth"""
    serializer_class = RequiredOAuthUserSerializer
    permission_classes = [IsAuthenticated]
    
    def get_object(self):
        return self.request.user
    
    def update(self, request, *args, **kwargs):
        user = self.get_object()
        serializer = self.get_serializer(user, data=request.data, partial=True)
        
        if serializer.is_valid():
            # Actualizar campos básicos del usuario
            for field in ['tipo', 'fecha_nacimiento', 'telefono', 'direccion', 'genero']:
                if field in serializer.validated_data:
                    setattr(user, field, serializer.validated_data[field])
            
            # Actualizar first_name y last_name si se proporcionan
            if 'first_name' in request.data:
                user.first_name = request.data['first_name']
            if 'last_name' in request.data:
                user.last_name = request.data['last_name']
            
            user.save()
            
            # Actualizar o crear el perfil de paciente si es necesario
            if user.tipo == 'patient':
                patient, created = Patient.objects.get_or_create(user=user)
                # Actualizar campos del paciente
                for field in ['allergies', 'ocupacion']:
                    if field in serializer.validated_data:
                        setattr(patient, field, serializer.validated_data[field])
                patient.save()
            
            # Actualizar o crear el perfil de doctor si es necesario
            if user.tipo == 'doctor':
                doctor, created = Doctor.objects.get_or_create(user=user)
                # Actualizar campos del doctor
                for field in ['especialidad', 'numero_licencia']:
                    if field in serializer.validated_data:
                        setattr(doctor, field, serializer.validated_data[field])
                doctor.save()
                
            # Verificar si el perfil está completo
            user.check_profile_completion()
            
            return Response({
                'user': UserProfileSerializer(user).data,
                'profile_complete': user.is_profile_completed,
                'message': 'Perfil actualizado correctamente.'
            })
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class UserProfileView(generics.RetrieveUpdateDestroyAPIView):
    """Vista para ver, actualizar y eliminar el perfil del usuario"""
    serializer_class = UserProfileSerializer
    permission_classes = [IsAuthenticated]
    
    def get_object(self):
        return self.request.user

    def update(self, request, *args, **kwargs):
        user = self.get_object()
        serializer = self.get_serializer(user, data=request.data, partial=True)
        
        if serializer.is_valid():
            # Actualizar campos básicos del usuario
            for field in ['first_name', 'last_name', 'telefono', 'direccion', 'genero']:
                if field in serializer.validated_data:
                    setattr(user, field, serializer.validated_data[field])
            
            user.save()
            
            return Response({
                'user': UserProfileSerializer(user).data,
                'message': 'Perfil actualizado correctamente.'
            }, status=status.HTTP_200_OK)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def destroy(self, request, *args, **kwargs):
        user = self.get_object()
        user.delete()
        return Response({
            'message': 'Cuenta eliminada correctamente.'
        }, status=status.HTTP_204_NO_CONTENT)

class UserViewSet(viewsets.ModelViewSet):
    """ViewSet para administrar usuarios (solo admin)"""
    queryset = User.objects.all()
    serializer_class = UserProfileSerializer
    permission_classes = [IsAdminUser]
    
    def get_serializer_class(self):
        if self.action == 'list':
            return UserProfileSerializerBasic
        return UserProfileSerializer
    
    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def me(self, request):
        """Endpoint para obtener información del usuario actual"""
        serializer = UserProfileSerializer(request.user)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'], permission_classes=[IsAdminUser])
    def incomplete_profiles(self, request):
        """Listar usuarios con perfiles incompletos"""
        users = User.objects.filter(is_profile_completed=False)
        page = self.paginate_queryset(users)
        
        if page is not None:
            serializer = UserProfileSerializerBasic(page, many=True)
            return self.get_paginated_response(serializer.data)
            
        serializer = UserProfileSerializerBasic(users, many=True)
        return Response(serializer.data)
    
class PatientMedicalDataUpdateView(APIView):
    """
    Vista unificada para recibir y procesar datos médicos
    Utiliza autenticación JWT para mantener consistencia con el resto del sistema
    Permite actualizar datos tanto por servicios internos como por Flask
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        # Obtener datos de la solicitud
        user_id = request.data.get('user_id')
        medical_data = request.data.get('medical_data', {})
        source = request.data.get('source', 'chatbot')
        
        # Si no se proporciona un user_id específico, usar el del usuario autenticado
        if not user_id and request.user.tipo == 'patient':
            user_id = str(request.user.id)
        
        if not user_id:
            return Response(
                {"error": "Se requiere un ID de usuario"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Verificar permisos - solo el propio usuario o un médico/admin puede actualizar datos
        if str(request.user.id) != user_id and request.user.tipo not in ['doctor', 'admin', 'system']:
            return Response(
                {"error": "No tiene permisos para actualizar los datos de este paciente"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Buscar usuario y su perfil de paciente
        try:
            user = User.objects.get(id=user_id)
            
            # Verificar si es paciente
            if user.tipo != 'patient':
                return Response(
                    {"error": "El usuario no es un paciente"},
                    status=status.HTTP_400_BAD_REQUEST
                )
                
            # Obtener o crear perfil de paciente
            patient, created = Patient.objects.get_or_create(user=user)
            
        except User.DoesNotExist:
            return Response(
                {"error": "Usuario no encontrado"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Validar los datos médicos recibidos
        serializer = ChatbotAnalysisSerializer(data=medical_data)
        
        if not serializer.is_valid():
            return Response(
                {"error": "Datos médicos inválidos", "details": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Actualizar información del paciente con los datos validados
        updated = patient.update_from_chatbot_analysis(
            serializer.validated_data,
            created_by=request.user
        )
        
        if updated:
            # Obtener la última entrada de historial creada
            latest_history = patient.history_entries.first()
            
            # Verificar si la actualización completó el perfil del usuario
            user.check_profile_completion()
            
            return Response({
                "message": "Información del paciente actualizada correctamente",
                "patient": PatientSerializer(patient).data,
                "profile_complete": user.is_profile_completed,
                "history_entry": PatientHistoryEntrySerializer(latest_history).data if latest_history else None
            }, status=status.HTTP_200_OK)
        else:
            return Response({
                "message": "No se realizaron cambios en la información del paciente"
            }, status=status.HTTP_200_OK)

class PatientViewSet(viewsets.ModelViewSet):
    """ViewSet para administrar pacientes (doctor y admin)"""
    queryset = Patient.objects.all()
    serializer_class = PatientSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = PageNumberPagination  # Añadir paginación
    
    def get_queryset(self):
        user = self.request.user
        # Los pacientes solo pueden ver su propio perfil
        if user.tipo == 'patient':
            return Patient.objects.filter(user=user)
        # Doctores solo pueden ver sus pacientes asignados
        elif user.tipo == 'doctor':
            try:
                doctor = Doctor.objects.get(user=user)
                return Patient.objects.filter(
                    doctor_relations__doctor=doctor,
                    doctor_relations__active=True
                ).distinct()
            except Doctor.DoesNotExist:
                return Patient.objects.none()
        # Administradores pueden ver todos los pacientes
        elif user.tipo == 'admin':
            return Patient.objects.all()
        return Patient.objects.none()
    
    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        # Incluir información del usuario asociado
        user_data = UserProfileSerializerBasic(instance.user).data
        data = serializer.data
        data['user'] = user_data
        return Response(data)
    
    @action(detail=True, methods=['get'])
    def history(self, request, pk=None):
        """Acción para obtener el historial médico de un paciente específico"""
        patient = self.get_object()
        
        # Configurar paginación para el historial
        paginator = PageNumberPagination()
        paginator.page_size = 10  # Puedes ajustar esto según necesites
        
        history_entries = patient.history_entries.all().order_by('-created_at')
        page = paginator.paginate_queryset(history_entries, request)
        
        if page is not None:
            serializer = PatientHistoryEntrySerializer(page, many=True)
            return paginator.get_paginated_response(serializer.data)
            
        serializer = PatientHistoryEntrySerializer(history_entries, many=True)
        return Response(serializer.data)
class PatientHistoryViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet para acceder al historial médico de un paciente"""
    serializer_class = PatientHistoryEntrySerializer
    permission_classes = [IsAuthenticated]
    pagination_class = PageNumberPagination  # Añadir paginación
    
    def get_queryset(self):
        patient_id = self.kwargs.get('patient_id')
        user = self.request.user
        
        # Verificar permisos
        if not patient_id:
            return PatientHistoryEntry.objects.none()
        
        try:
            patient = Patient.objects.get(id=patient_id)
            
            # Pacientes solo pueden ver su propio historial
            if user.tipo == 'patient' and user.id != patient.user.id:
                return PatientHistoryEntry.objects.none()
                
            # Doctores pueden ver el historial de sus pacientes
            if user.tipo == 'doctor':
                # Verificar si existe una relación doctor-paciente activa
                has_relation = DoctorPatientRelation.objects.filter(
                    doctor__user=user, 
                    patient=patient,
                    active=True
                ).exists()
                
                if not has_relation:
                    return PatientHistoryEntry.objects.none()
            
            # Retornar historial ordenado por fecha (más reciente primero)
            return PatientHistoryEntry.objects.filter(patient=patient).order_by('-created_at')
            
        except Patient.DoesNotExist:
            return PatientHistoryEntry.objects.none()

class PatientHistoryCreateView(APIView):
    """Vista para crear manualmente una entrada en el historial del paciente"""
    permission_classes = [IsAuthenticated]
    
    def post(self, request, patient_id):
        try:
            patient = Patient.objects.get(id=patient_id)
            
            # Verificar permisos
            user = request.user
            if user.tipo == 'patient' and user.id != patient.user.id:
                return Response(
                    {"error": "No tienes permisos para modificar este paciente"},
                    status=status.HTTP_403_FORBIDDEN
                )
                
            if user.tipo == 'doctor':
                # Verificar si es médico del paciente
                has_relation = DoctorPatientRelation.objects.filter(
                    doctor__user=user, 
                    patient=patient,
                    active=True
                ).exists()
                
                if not has_relation:
                    return Response(
                        {"error": "No eres médico asignado a este paciente"},
                        status=status.HTTP_403_FORBIDDEN
                    )
            
            # Preparar datos para el historial
            history_data = {
                'patient': patient,
                'source': user.tipo,  # 'patient', 'doctor', 'admin'
                'created_by': user,
                'notes': request.data.get('notes', '')
            }
            
            # Campos médicos que se pueden actualizar
            medical_fields = [
                'triaje_level', 'pain_scale', 'medical_context',
                'allergies', 'medications', 'medical_history', 'ocupacion'
            ]
            
            # Copiar valores actuales al historial
            for field in medical_fields:
                history_data[field] = getattr(patient, field)
            
            # Opcional: actualizar campos si se proporcionan en la solicitud
            update_current = request.data.get('update_current', False)
            fields_to_update = []
            
            if update_current:
                for field in medical_fields:
                    if field in request.data and request.data[field] is not None:
                        # Guardar para actualizar el paciente después
                        setattr(patient, field, request.data[field])
                        fields_to_update.append(field)
            
            # Crear entrada de historial
            history_entry = PatientHistoryEntry.objects.create(**history_data)
            
            # Actualizar datos actuales del paciente si es necesario
            if update_current and fields_to_update:
                # Si es un médico, validar los datos
                if user.tipo == 'doctor':
                    doctor = Doctor.objects.get(user=user)
                    patient.is_data_validated = True
                    patient.data_validated_by = doctor
                    patient.data_validated_at = timezone.now()
                    fields_to_update.extend(['is_data_validated', 'data_validated_by', 'data_validated_at'])
                
                patient.save(update_fields=fields_to_update)
                patient.user.check_profile_completion()
            
            return Response(
                PatientHistoryEntrySerializer(history_entry).data,
                status=status.HTTP_201_CREATED
            )
            
        except Patient.DoesNotExist:
            return Response(
                {"error": "Paciente no encontrado"},
                status=status.HTTP_404_NOT_FOUND
            )
        except Doctor.DoesNotExist:
            return Response(
                {"error": "Perfil de doctor no encontrado"},
                status=status.HTTP_400_BAD_REQUEST
            )

class PatientMeView(generics.RetrieveAPIView):
    """Vista para que un paciente vea su propio perfil médico"""
    serializer_class = PatientSerializer
    permission_classes = [IsAuthenticated]
    
    def get_object(self):
        if self.request.user.tipo != 'patient':
            raise PermissionDenied("Solo los pacientes pueden acceder a esta vista")
        
        try:
            return Patient.objects.get(user=self.request.user)
        except Patient.DoesNotExist:
            raise Http404("No tienes un perfil de paciente configurado")

class PatientMeHistoryView(generics.ListAPIView):
    """Vista para que un paciente vea su propio historial médico"""
    serializer_class = PatientHistoryEntrySerializer
    permission_classes = [IsAuthenticated]
    pagination_class = PageNumberPagination
    
    def get_queryset(self):
        if self.request.user.tipo != 'patient':
            return PatientHistoryEntry.objects.none()
        
        try:
            patient = Patient.objects.get(user=self.request.user)
            return PatientHistoryEntry.objects.filter(patient=patient).order_by('-created_at')
        except Patient.DoesNotExist:
            return PatientHistoryEntry.objects.none()
class DoctorViewSet(viewsets.ModelViewSet):
    """ViewSet para administrar doctores"""
    queryset = Doctor.objects.all()
    serializer_class = DoctorSerializer
    pagination_class = PageNumberPagination  # Añadir paginación
    
    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [IsAuthenticated()]
        return [IsAdminUser()]
    
    def get_queryset(self):
        user = self.request.user
        # Los doctores solo pueden ver su propio perfil
        if user.tipo == 'doctor':
            return Doctor.objects.filter(user=user)
        # Administradores pueden ver todos los doctores
        elif user.tipo == 'admin':
            return Doctor.objects.all()
        # Pacientes pueden ver la lista de doctores pero sin detalles sensibles
        elif user.tipo == 'patient' and self.action == 'list':
            # Para pacientes, mostrar solo doctores activos
            return Doctor.objects.filter(user__is_active=True)
        return Doctor.objects.none()
    
    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        # Incluir información del usuario asociado
        user_data = UserProfileSerializerBasic(instance.user).data
        data = serializer.data
        data['user'] = user_data
        return Response(data)
    
    @action(detail=True, methods=['get'])
    def patients(self, request, pk=None):
        """Acción para obtener los pacientes de un doctor específico"""
        doctor = self.get_object()
        
        # Verificar permisos
        if request.user.tipo not in ['admin', 'doctor'] or \
           (request.user.tipo == 'doctor' and request.user != doctor.user):
            return Response(
                {"error": "No tienes permisos para ver estos pacientes"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Obtener pacientes activos del doctor
        patients = Patient.objects.filter(
            doctor_relations__doctor=doctor,
            doctor_relations__active=True
        ).distinct()
        
        # Configurar paginación
        paginator = PageNumberPagination()
        paginator.page_size = 10  # Puedes ajustar esto según necesites
        page = paginator.paginate_queryset(patients, request)
        
        if page is not None:
            serializer = PatientBasicSerializer(page, many=True)
            return paginator.get_paginated_response(serializer.data)
            
        serializer = PatientBasicSerializer(patients, many=True)
        return Response(serializer.data)
    
class DoctorPatientRelationViewSet(viewsets.ModelViewSet):
    """ViewSet para gestionar relaciones entre doctores y pacientes"""
    serializer_class = DoctorPatientRelationSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        if user.tipo == 'patient':
            try:
                patient = Patient.objects.get(user=user)
                return DoctorPatientRelation.objects.filter(patient=patient)
            except Patient.DoesNotExist:
                return DoctorPatientRelation.objects.none()
        elif user.tipo == 'doctor':
            try:
                doctor = Doctor.objects.get(user=user)
                return DoctorPatientRelation.objects.filter(doctor=doctor)
            except Doctor.DoesNotExist:
                return DoctorPatientRelation.objects.none()
        elif user.tipo == 'admin':
            return DoctorPatientRelation.objects.all()
        return DoctorPatientRelation.objects.none()
    

class PasswordResetRequestView(APIView):
    """Vista para solicitar el restablecimiento de contraseña por código de verificación"""
    permission_classes = [AllowAny]
    serializer_class = PasswordResetRequestSerializer
    
    def post(self, request):
        serializer = self.serializer_class(data=request.data)
        if serializer.is_valid():
            email = serializer.validated_data['email']
            try:
                user = User.objects.get(email=email)
                
                # Generar un código de verificación de 6 dígitos
                verification_code = get_random_string(6, '0123456789')
                
                # Guardar el código en caché con un tiempo de expiración (15 minutos)
                cache_key = f"pwd_reset_{user.id}"
                cache.set(cache_key, verification_code, timeout=900)  # 900 segundos = 15 minutos
                
                # Enviar correo con el código de verificación
                subject = 'Código de verificación para restablecer tu contraseña'
                html_message = render_to_string('password_reset.html', {
                    'user': user,
                    'code': verification_code,
                    'valid_time': '15 minutos'
                })
                plain_message = f"""
                Hola {user.first_name},
                
                Has solicitado restablecer tu contraseña. Utiliza el siguiente código de verificación:
                
                {verification_code}
                
                Este código es válido por 15 minutos.
                
                Si no has solicitado este cambio, ignora este mensaje.
                
                Saludos,
                El equipo de soporte
                """
                
                send_mail(
                    subject,
                    plain_message,
                    settings.EMAIL_HOST_USER,
                    [email],
                    html_message=html_message,
                    fail_silently=False,
                )
                
                return Response(
                    {
                        "message": "Se ha enviado un código de verificación a tu correo electrónico.",
                        "expires_in": "15 minutos"
                    },
                    status=status.HTTP_200_OK
                )
            except User.DoesNotExist:
                # No revelamos si el correo existe o no por seguridad
                return Response(
                    {"message": "Si existe una cuenta con este correo, recibirás un código de verificación."},
                    status=status.HTTP_200_OK
                )
                
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class PasswordResetVerifyView(APIView):
    """Vista para verificar el código y restablecer la contraseña"""
    permission_classes = [AllowAny]
    serializer_class = PasswordResetVerifySerializer
    
    def post(self, request):
        serializer = self.serializer_class(data=request.data)
        if serializer.is_valid():
            email = serializer.validated_data['email']
            code = serializer.validated_data['code']
            new_password = serializer.validated_data['new_password']
            
            try:
                user = User.objects.get(email=email)
                
                # Recuperar el código de verificación de la caché
                cache_key = f"pwd_reset_{user.id}"
                stored_code = cache.get(cache_key)
                
                if not stored_code or stored_code != code:
                    return Response(
                        {"error": "El código de verificación es inválido o ha expirado."},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                # Establecer la nueva contraseña
                user.set_password(new_password)
                user.save()
                
                # Eliminar el código de la caché
                cache.delete(cache_key)
                
                return Response(
                    {"message": "Tu contraseña ha sido restablecida correctamente. Ahora puedes iniciar sesión."},
                    status=status.HTTP_200_OK
                )
                
            except User.DoesNotExist:
                return Response(
                    {"error": "No se encontró ninguna cuenta con este correo electrónico."},
                    status=status.HTTP_400_BAD_REQUEST
                )
                
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class ChangePasswordView(APIView):
    """Vista para cambiar la contraseña estando autenticado"""
    permission_classes = [IsAuthenticated]
    serializer_class = ChangePasswordSerializer
    
    def post(self, request):
        serializer = self.serializer_class(data=request.data)
        if serializer.is_valid():
            user = request.user
            
            # Verificar la contraseña actual
            if not user.check_password(serializer.validated_data['old_password']):
                return Response(
                    {"old_password": ["La contraseña actual es incorrecta."]},
                    status=status.HTTP_400_BAD_REQUEST
                )
                
            # Establecer la nueva contraseña
            user.set_password(serializer.validated_data['new_password'])
            user.save()
            
            return Response(
                {"message": "Tu contraseña ha sido cambiada correctamente."},
                status=status.HTTP_200_OK
            )
            
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class AccountDeleteView(APIView):
    """Vista para eliminación segura de cuenta con contraseña"""
    permission_classes = [IsAuthenticated]
    serializer_class = AccountDeleteSerializer
    
    def post(self, request):
        serializer = self.serializer_class(data=request.data)
        if serializer.is_valid():
            password = serializer.validated_data.get('password')
            
            # Para cuentas OAuth no se requiere contraseña
            if request.user.oauth_provider and request.user.oauth_uid:
                request.user.delete()
                return Response(
                    {"message": "Tu cuenta ha sido eliminada correctamente."},
                    status=status.HTTP_204_NO_CONTENT
                )
                
            # Para cuentas con contraseña, verificar la contraseña
            if not password:
                return Response(
                    {"error": "Debes proporcionar tu contraseña para eliminar la cuenta."},
                    status=status.HTTP_400_BAD_REQUEST
                )
                
            if not request.user.check_password(password):
                return Response(
                    {"error": "La contraseña proporcionada es incorrecta."},
                    status=status.HTTP_400_BAD_REQUEST
                )
                
            # Eliminar la cuenta
            request.user.delete()
            return Response(
                {"message": "Tu cuenta ha sido eliminada correctamente."},
                status=status.HTTP_204_NO_CONTENT
            )
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)