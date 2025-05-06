import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import API from "@/services/api";
import { LoginResponse } from "@/types/auth";
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
        return;
      }
      
      // Usar API importado para mantener consistencia
      const response = await API.get<UserProfile>("/profile/");
      console.log('Perfil obtenido:', response.data);
      setUser(response.data);
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
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Intentando iniciar sesión con email:', email);
      
      // Usar API importado en lugar de axios directo para mantener consistencia
      const response = await API.post<LoginResponse>(
        "/login/", 
        { email, password }
      );

      console.log('Respuesta de login:', response.data);
      const { access, refresh } = response.data;

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

      // Usar API importado para mantener consistencia
      const response = await API.post<LoginResponse>(
        "/google/login/", 
        {
          token: googleToken,
          profile_type: tipo,
        }
      );
      
      console.log('Respuesta de Google login:', response.data);
      const { access, refresh } = response.data;

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
    sessionStorage.removeItem('access_token');
    sessionStorage.removeItem('refresh_token');
    clearAuthCookies();
    setUser(null);
    setIsAuthenticated(false);
    router.push(ROUTES.PUBLIC.LOGIN);
  }, [router]);

  // Verificar autenticación al cargar el componente
  useEffect(() => {
    const checkAuth = async () => {
      const token = sessionStorage.getItem("access_token");
      console.log('Token en sessionStorage:', token ? 'presente' : 'ausente');
      
      if (token) {
        await fetchUserProfile();
      }
      
      setLoading(false);
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
  };
}