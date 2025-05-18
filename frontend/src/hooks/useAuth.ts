import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { login as apiLogin, loginWithGoogle as apiLoginWithGoogle, getUserProfile, logout as apiLogout } from "@/services/api";
import { UserProfile } from "@/types/user";
import { ROUTES } from "@/routes/routePaths";
import { 
  clearAuthCookies, 
  updateAuthCookies, 
  syncAuthState, 
  subscribeToAuthChanges 
} from "@/utils/authSync";

export function useAuth() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  // Check for access token and update state
  const checkStorageAuth = useCallback(() => {
    const token = sessionStorage.getItem('access_token');
    const authenticated = !!token;
    
    if (isAuthenticated !== authenticated) {
      console.log('Authentication state changed based on storage:', authenticated);
      setIsAuthenticated(authenticated);
    }
    
    return authenticated;
  }, [isAuthenticated]);

  const fetchUserProfile = useCallback(async () => {
    try {
      console.log('Intentando obtener perfil de usuario...');
      const token = sessionStorage.getItem('access_token');
      
      if (!token) {
        console.log('No hay token disponible');
        setUser(null);
        setIsAuthenticated(false);
        setLoading(false);
        return null;
      }
      
      // Usar la función getUserProfile importada desde api.ts
      const userProfile = await getUserProfile();
      console.log('Perfil obtenido:', userProfile);
      setUser(userProfile);
      setIsAuthenticated(true);
      
      // Make sure cookies are in sync after profile fetch
      syncAuthState();
      
      return userProfile;
    } catch (err) {
      console.error("Error al obtener perfil de usuario:", err);
      setUser(null);
      setIsAuthenticated(false);
      
      // Verificar si el error es por token inválido o expirado
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        console.log('Token inválido o expirado, limpiando datos de sesión');
        sessionStorage.removeItem('access_token');
        sessionStorage.removeItem('refresh_token');
        clearAuthCookies();
      }
      
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (username_or_email: string, password: string) => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Intentando iniciar sesión con:', username_or_email);
      
      // Usar la función de login exportada desde api.ts
      const loginData = await apiLogin(username_or_email, password);
      
      console.log('Respuesta de login:', loginData);
      const { access, refresh } = loginData;

      // Guardar tokens en sessionStorage
      sessionStorage.setItem("access_token", access);
      sessionStorage.setItem("refresh_token", refresh);
      
      // Update cookies and dispatch auth change event
      updateAuthCookies(access);
      
      setIsAuthenticated(true);

      // Obtener datos del perfil
      const userProfile = await fetchUserProfile();

      // Verificar si el usuario necesita completar perfil
      if (userProfile && !userProfile.is_profile_completed) {
        console.log('Usuario necesita completar perfil, redirigiendo...');
        router.push(ROUTES.PROTECTED.PROFILE_COMPLETE);
      } else if (userProfile) {
        console.log('Perfil completo, redirigiendo al dashboard...');
        router.push(ROUTES.PROTECTED.DASHBOARD);
      }
    } catch (err: unknown) {
      console.error("Error en login:", err);
      
      let message = "Login failed";
      if (axios.isAxiosError(err)) {
        const errorData = err.response?.data;
        message = errorData?.detail || errorData?.non_field_errors?.[0] || "Credenciales inválidas";
        console.error('Detalles del error:', errorData);
      }
      
      setError(message);
      setIsAuthenticated(false);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [fetchUserProfile, router]);

  const loginWithGoogle = useCallback(async (googleToken: string, tipo: string) => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Intentando login con Google, tipo:', tipo);

      // Usar la función de login con Google exportada desde api.ts
      const loginData = await apiLoginWithGoogle(googleToken, tipo);
      
      console.log('Respuesta de Google login:', loginData);
      const { access, refresh } = loginData;

      // Guardar tokens
      sessionStorage.setItem("access_token", access);
      sessionStorage.setItem("refresh_token", refresh);
      
      // Update cookies and dispatch auth change event
      updateAuthCookies(access);
      
      setIsAuthenticated(true);

      // Obtener perfil
      const userProfile = await fetchUserProfile();

      // Verificar si necesita completar perfil
      if (userProfile && !userProfile.is_profile_completed) {
        console.log('Usuario Google necesita completar perfil, redirigiendo...');
        router.push(ROUTES.PROTECTED.PROFILE_COMPLETE);
      } else if (userProfile) {
        console.log('Perfil Google completo, redirigiendo al dashboard...');
        router.push(ROUTES.PROTECTED.DASHBOARD);
      }
    } catch (err: unknown) {
      console.error("Error en Google login:", err);
      
      let message = "Google login failed";
      if (axios.isAxiosError(err)) {
        const errorData = err.response?.data;
        message = errorData?.detail || "Error al iniciar sesión con Google";
        console.error('Detalles del error Google:', errorData);
      }
      
      setError(message);
      setIsAuthenticated(false);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [fetchUserProfile, router]);

  const logout = useCallback(() => {
    console.log('Cerrando sesión...');
    
    // Utilizar la función de logout exportada desde api.ts
    apiLogout()
      .catch(err => console.error('Error en logout API:', err))
      .finally(() => {
        // La función apiLogout ya limpia sessionStorage, pero aseguramos la limpieza completa
        sessionStorage.removeItem('access_token');
        sessionStorage.removeItem('refresh_token');
        clearAuthCookies();
        setUser(null);
        setIsAuthenticated(false);
        router.push(ROUTES.PUBLIC.LOGIN);
      });
  }, [router]);

  // Listen for auth changes from other components
  useEffect(() => {
    const unsubscribe = subscribeToAuthChanges((newAuthState) => {
      console.log('Auth state changed from event:', newAuthState);
      setIsAuthenticated(newAuthState);
      
      // If authentication state changed to false, clear user
      if (!newAuthState) {
        setUser(null);
      } else if (newAuthState && !user) {
        // If authenticated but no user data, fetch profile
        fetchUserProfile();
      }
    });
    
    return unsubscribe;
  }, [fetchUserProfile, user]);

  // Verificar autenticación al cargar el componente
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const isAuthFromStorage = checkStorageAuth();
        console.log('Token en sessionStorage:', isAuthFromStorage ? 'presente' : 'ausente');
        
        if (isAuthFromStorage) {
          // Sync cookies with session storage state
          syncAuthState();
          
          const userProfile = await fetchUserProfile();
          
          // Si el usuario está autenticado pero necesita completar perfil,
          // verificamos en qué página estamos para redirigir si es necesario
          if (userProfile && !userProfile.is_profile_completed) {
            // Verificar si ya estamos en la página de completar perfil para evitar redirecciones circulares
            const currentPath = window.location.pathname;
            if (currentPath !== ROUTES.PROTECTED.PROFILE_COMPLETE) {
              console.log('Perfil incompleto, redirigiendo desde checkAuth...');
              router.push(ROUTES.PROTECTED.PROFILE_COMPLETE);
            }
          }
        } else {
          setLoading(false);
        }
      } catch (error) {
        console.error("Error verificando autenticación:", error);
        setLoading(false);
        setIsAuthenticated(false);
      }
    };
    
    checkAuth();
    
    // Add event listener for storage changes in other tabs
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'access_token' || event.key === null) {
        checkStorageAuth();
        syncAuthState();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [checkStorageAuth, fetchUserProfile, router]);

  return {
    user,
    loading,
    error,
    isAuthenticated,
    login,
    loginWithGoogle,
    logout,
    refreshProfile: fetchUserProfile,
  };
}