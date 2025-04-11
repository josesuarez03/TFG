from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView, TokenVerifyView

from .views import (
    RegisterUserView, GoogleOAuthLoginView, CompleteProfileView,
    UserProfileView, UserViewSet, PasswordResetRequestView, 
    PasswordResetVerifyView, ChangePasswordView, AccountDeleteView
)

router = DefaultRouter()
router.register(r'admin/users', UserViewSet)

urlpatterns = [
    # Autenticación básica
    path('login/', TokenObtainPairView.as_view(), name='token_obtain_pair'),  # Login estándar
    path('register/', RegisterUserView.as_view(), name='register'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('token/verify/', TokenVerifyView.as_view(), name='token_verify'),  # Verificación de tokens
    
    # Google OAuth
    path('google/login/', GoogleOAuthLoginView.as_view(), name='google_oauth_login'),
    
    # Perfil de usuario
    path('profile/complete/', CompleteProfileView.as_view(), name='complete_profile'),
    path('profile/', UserProfileView.as_view(), name='user_profile'),
    
    # Gestión de contraseñas
    path('password/reset/request/', PasswordResetRequestView.as_view(), name='password_reset_request'),
    path('password/reset/verify/', PasswordResetVerifyView.as_view(), name='password_reset_verify'),
    path('password/change/', ChangePasswordView.as_view(), name='change_password'),
    
    # Eliminación de cuenta
    path('account/delete/', AccountDeleteView.as_view(), name='account_delete'),
    
    # ViewSet de administración de usuarios
    path('', include(router.urls)),
]