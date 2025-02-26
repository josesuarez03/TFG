from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    RegisterUserView, OAuthLoginView, CompleteProfileView,
    UserProfileView, UserViewSet
)

router = DefaultRouter()
router.register(r'admin/users', UserViewSet)

urlpatterns = [
    # Autenticación básica
    path('register/', RegisterUserView.as_view(), name='register'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    
    # OAuth
    path('oauth/login/', OAuthLoginView.as_view(), name='oauth_login'),
    
    # Perfil de usuario
    path('profile/complete/', CompleteProfileView.as_view(), name='complete_profile'),
    path('profile/', UserProfileView.as_view(), name='user_profile'),
    
    # ViewSet de administración de usuarios
    path('', include(router.urls)),
]