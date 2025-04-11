from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView, TokenVerifyView

from .views import (
    RegisterUserView, GoogleOAuthLoginView, CompleteProfileView,
    UserProfileView, UserViewSet
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
    
    # ViewSet de administración de usuarios
    path('', include(router.urls)),
]