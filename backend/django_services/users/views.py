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
    UserRegistrationSerializer, UserProfileSerializer, UserBasicInfoSerializer,
    OAuthUserInfoSerializer, RequiredProfileSerializer
)

User = get_user_model()

class RegisterUserView(generics.CreateAPIView):

    queryset = User.objects.all()
    serializer_class = UserRegistrationSerializer
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = self.serializer_class(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            refresh = RefreshToken.for_user(user)
            
            return Response({
                'user': UserBasicInfoSerializer(user).data,
                'refresh': str(refresh),
                'access': str(refresh.access_token),
                'profile_complete': False,
                'message': 'Usuario registrado correctamente. Complete su perfil.'
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
class OAuthLoginView(APIView):
    """Vista para autenticación con proveedores OAuth"""
    permission_classes = [AllowAny]
    serializer_class = OAuthUserInfoSerializer

    @transaction.atomic
    def post(self, request):
        serializer = self.serializer_class(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            
        provider = serializer.validated_data['provider']
        token = serializer.validated_data['token']
        
        try:
            # Cargar la estrategia y backend para el proveedor OAuth
            strategy = load_strategy(request)
            backend = load_backend(strategy, provider, redirect_uri=None)
            
            # Autenticar con el token
            user = backend.do_auth(token)
            
            if not user:
                return Response(
                    {"error": "Error de autenticación con el proveedor."},
                    status=status.HTTP_400_BAD_REQUEST
                )
                
            # Verificar si es un usuario nuevo o existente
            is_new_user = user.date_joined == user.last_login
            
            # Generar tokens JWT
            refresh = RefreshToken.for_user(user)
            
            # Si es un usuario nuevo, marcar que debe completar su perfil
            response_data = {
                'user': UserBasicInfoSerializer(user).data,
                'refresh': str(refresh),
                'access': str(refresh.access_token),
                'is_new_user': is_new_user,
                'profile_complete': user.is_profile_completed
            }
            
            return Response(response_data, status=status.HTTP_200_OK)
            
        except (MissingBackend, AuthTokenError, AuthForbidden) as e:
            return Response(
                {"error": f"Error en autenticación OAuth: {str(e)}"},
                status=status.HTTP_400_BAD_REQUEST
            )

class CompleteProfileView(generics.UpdateAPIView):
    """Vista para completar información adicional después del registro/login con OAuth"""
    serializer_class = RequiredProfileSerializer
    permission_classes = [IsAuthenticated]
    
    def get_object(self):
        return self.request.user
    
    def update(self, request, *args, **kwargs):
        user = self.get_object()
        serializer = self.get_serializer(user, data=request.data, partial=True)
        
        if serializer.is_valid():
            serializer.save()
            
            # Actualizar first_name y last_name si se proporcionan
            if 'first_name' in request.data:
                user.first_name = request.data['first_name']
            if 'last_name' in request.data:
                user.last_name = request.data['last_name']
                
            # Verificar si el perfil está completo
            user.check_profile_completion()
            
            return Response({
                'user': UserProfileSerializer(user).data,
                'profile_complete': user.is_profile_completed,
                'message': 'Perfil actualizado correctamente.'
            })
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class UserProfileView(generics.RetrieveUpdateAPIView):
    """Vista para ver y actualizar perfil de usuario"""
    serializer_class = UserProfileSerializer
    permission_classes = [IsAuthenticated]
    
    def get_object(self):
        return self.request.user

class UserViewSet(viewsets.ModelViewSet):
    """ViewSet para administrar usuarios (solo admin)"""
    queryset = User.objects.all()
    serializer_class = UserProfileSerializer
    permission_classes = [IsAdminUser]
    
    def get_serializer_class(self):
        if self.action == 'list':
            return UserBasicInfoSerializer
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
            serializer = UserBasicInfoSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
            
        serializer = UserBasicInfoSerializer(users, many=True)
        return Response(serializer.data)