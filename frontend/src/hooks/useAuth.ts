import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { login as apiLogin, loginWithGoogle as apiLoginWithGoogle, getUserProfile, logout as apiLogout } from "@/services/api";
//import { LoginResponse } from "@/types/auth";
import { UserProfile } from "@/types/user";
import { ROUTES } from "@/routes/routePaths";
import { clearAuthCookies, updateAuthCookies } from "@/utils/authSync";

export function useAuth() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  const fetchUserProfile = useCallback(async () => {
    try {
      console.log('Intentando obtener perfil de usuario...');
      const token = sessionStorage.getItem('access_token');
      
      if (!token) {
        console.log('No hay token disponible');
        setUser(null);
        setIsAuthenticated(false);
        setLoading(false);
        return;
      }
      
      // Usar la función getUserProfile importada desde api.ts
      const userProfile = await getUserProfile();
      console.log('Perfil obtenido:', userProfile);
      setUser(userProfile);
      setIsAuthenticated(true);
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
      const loginData = await apiLogin({ username_or_email, password });
      
      console.log('Respuesta de login:', loginData);
      const { access, refresh } = loginData;

      // Guardar tokens en sessionStorage
      sessionStorage.setItem("access_token", access);
      sessionStorage.setItem("refresh_token", refresh);
      updateAuthCookies(access);

      // Obtener datos del perfil
      await fetchUserProfile();

      setIsAuthenticated(true);
      router.push(ROUTES.PROTECTED.DASHBOARD);
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
      updateAuthCookies(access);

      // Obtener perfil
      await fetchUserProfile();

      setIsAuthenticated(true);
      router.push(ROUTES.PROTECTED.DASHBOARD);
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

  // Verificar autenticación al cargar el componente
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = sessionStorage.getItem("access_token");
        console.log('Token en sessionStorage:', token ? 'presente' : 'ausente');
        
        if (token) {
          await fetchUserProfile();
        } else {
          setLoading(false);
          setIsAuthenticated(false);
        }
      } catch (error) {
        console.error("Error verificando autenticación:", error);
        setLoading(false);
        setIsAuthenticated(false);
      }
    };
    
    checkAuth();
  }, [fetchUserProfile]);

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