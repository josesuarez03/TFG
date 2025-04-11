from django.contrib.auth import get_user_model
from django.conf import settings
from django.db import transaction
from django.shortcuts import get_object_or_404

from rest_framework import status, viewsets, generics, mixins
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.permissions import IsAuthenticated, IsAdminUser, AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from rest_framework_simplejwt.tokens import RefreshToken
from social_django.utils import load_strategy, load_backend
from social_core.exceptions import MissingBackend, AuthTokenError, AuthForbidden

from .serializers import (
    UserSerializer, UserProfileSerializer, UserProfileSerializerBasic,
    GoogleOAuthUserInfoSerializer, RequiredOAuthUserSerializer, 
    PatientSerializer, DoctorSerializer, ChatbotAnalysisSerializer
)
from .models import Patient, Doctor

User = get_user_model()

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
    
class GoogleOAuthLoginView(APIView):
    """Vista para autenticación con Google (login o registro)"""
    permission_classes = [AllowAny]
    serializer_class = GoogleOAuthUserInfoSerializer

    @transaction.atomic
    def post(self, request):
        serializer = self.serializer_class(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            
        token = serializer.validated_data['token']
        
        try:
            # Proveedor Google OAuth2
            provider = 'google-oauth2'
            
            # Cargar la estrategia y backend para Google
            strategy = load_strategy(request)
            backend = load_backend(strategy, provider, redirect_uri=None)
            
            # Autenticar con el token
            user = backend.do_auth(token)
            
            if not user:
                return Response(
                    {"error": "Error de autenticación con Google."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Guardar información del proveedor OAuth
            user.oauth_provider = 'google'
            if not user.oauth_uid and hasattr(user, 'social_user'):
                user.oauth_uid = user.social_user.uid
                
            # Si se proporciona el tipo de usuario en la solicitud y es un usuario nuevo
            is_new_user = user.date_joined == user.last_login
            if is_new_user and 'tipo' in request.data:
                user.tipo = request.data.get('tipo', 'patient')
                
            user.save(update_fields=['oauth_provider', 'oauth_uid', 'tipo'])
                
            # Generar tokens JWT
            refresh = RefreshToken.for_user(user)
            
            # Si es un usuario nuevo, marcar que debe completar su perfil
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

class ChatbotPatientUpdateView(APIView):
    """
    Vista para que el chatbot actualice la información médica de un paciente
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request, patient_id=None):
        # Si no se proporciona patient_id, usar el del usuario actual si es paciente
        if not patient_id and request.user.tipo == 'patient':
            try:
                patient = request.user.patient
            except Patient.DoesNotExist:
                return Response(
                    {"error": "El usuario actual no tiene un perfil de paciente"},
                    status=status.HTTP_404_NOT_FOUND
                )
        else:
            # Si se proporciona un ID o el usuario es médico/admin, verificar permisos
            if not patient_id:
                return Response(
                    {"error": "Se requiere un ID de paciente"},
                    status=status.HTTP_400_BAD_REQUEST
                )
                
            # Los médicos y admin pueden actualizar cualquier paciente
            if request.user.tipo not in ['doctor', 'admin']:
                return Response(
                    {"error": "No tiene permisos para actualizar este paciente"},
                    status=status.HTTP_403_FORBIDDEN
                )
                
            try:
                patient = Patient.objects.get(id=patient_id)
            except Patient.DoesNotExist:
                return Response(
                    {"error": "Paciente no encontrado"},
                    status=status.HTTP_404_NOT_FOUND
                )
        
        # Validar los datos proporcionados por el chatbot
        analysis_data = request.data.get('analysis_data', {})
        serializer = ChatbotAnalysisSerializer(data=analysis_data)
        
        if not serializer.is_valid():
            return Response(
                {"error": "Datos de análisis inválidos", "details": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        # Actualizar la información del paciente
        updated = patient.update_from_chatbot_analysis(serializer.validated_data)
        
        if updated:
            return Response({
                "message": "Información del paciente actualizada correctamente",
                "patient": PatientSerializer(patient).data,
                "profile_complete": patient.user.is_profile_completed
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
    
    def get_queryset(self):
        user = self.request.user
        # Los pacientes solo pueden ver su propio perfil
        if user.tipo == 'patient':
            return Patient.objects.filter(user=user)
        # Doctores y administradores pueden ver todos los pacientes
        elif user.tipo in ['doctor', 'admin']:
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

class DoctorViewSet(viewsets.ModelViewSet):
    """ViewSet para administrar doctores (solo admin)"""
    queryset = Doctor.objects.all()
    serializer_class = DoctorSerializer
    
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
            return Doctor.objects.all()
        return Doctor.objects.none()
    
    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        # Incluir información