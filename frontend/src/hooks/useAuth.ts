import { useState, useEffect, useCallback } from "react";
import API from "@/services/api";
import { jwtDecode } from "jwt-decode";
import { useRouter } from "next/router";
import { LoginResponse } from "@/types/auth";
import { UserProfile } from "@/types/user";
import { syncAuthState, updateAuthCookies, clearAuthCookies } from "@/utils/authSync";

type User = UserProfile;

export const useAuth = () => {
    const router = useRouter();
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    // Función para decodificar el token
    const decodeToken = (token: string): { is_profile_completed?: boolean } | null => {
        try {
            return jwtDecode<{ is_profile_completed?: boolean }>(token);
        } catch (err) {
            console.error("Error al decodificar el token:", err);
            return null;
        }
    };

    // Función para manejar redirecciones
    const handleRedirection = (isProfileCompleted?: boolean) => {
        if (!isProfileCompleted) {
            router.push("/profile/complete");
        } else {
            router.push("/dashboard");
        }
    };

    // Función para iniciar sesión
    const login = async (email: string, password: string): Promise<void> => {
        setLoading(true);
        setError(null);

        try {
            const response = await API.post<LoginResponse>("token/", { email, password });
            const { access, refresh } = response.data;

            localStorage.setItem("access_token", access);
            localStorage.setItem("refresh_token", refresh);
            
            // Update cookies for middleware
            updateAuthCookies(access);

            const decodedToken = decodeToken(access);
            handleRedirection(decodedToken?.is_profile_completed);

            await fetchUser();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Error desconocido al iniciar sesión");
        } finally {
            setLoading(false);
        }
    };

    // Función para iniciar sesión con Google
    const loginWithGoogle = async (token: string): Promise<void> => {
        setLoading(true);
        setError(null);

        try {
            const profileType = localStorage.getItem('selectedProfileType') || 'patient';
            const response = await API.post<LoginResponse>("auth/google/", { 
                token,
                tipo: profileType
            });
            const { access, refresh } = response.data;

            localStorage.setItem("access_token", access);
            localStorage.setItem("refresh_token", refresh);
            
            // Update cookies for middleware
            updateAuthCookies(access);

            const decodedToken = decodeToken(access);
            handleRedirection(decodedToken?.is_profile_completed);

            await fetchUser();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Error desconocido con Google Login");
        } finally {
            setLoading(false);
        }
    };

    // Función para cerrar sesión
    const logout = useCallback((): void => {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        
        // Clear cookies for middleware
        clearAuthCookies();
        
        setUser(null);
        router.push("/auth/login");
    }, [router]);

    // Función para obtener los datos del usuario autenticado
    const fetchUser = useCallback(async (): Promise<void> => {
        try {
            const response = await API.get<User>("profile/");
            setUser(response.data);
        } catch (err: unknown) {
            console.error("Error al obtener el usuario:", err);
            logout();
        }
    }, [logout]);

    // Verify auth state and sync with cookies on mount and when token changes
    useEffect(() => {
        syncAuthState();
        
        const token = localStorage.getItem("access_token");
        if (token) {
            fetchUser().catch(() => logout());
        } else {
            setLoading(false);
        }
        
        // Set up event listener for storage changes
        const handleStorageChange = () => {
            syncAuthState();
        };
        
        window.addEventListener('storage', handleStorageChange);
        return () => {
            window.removeEventListener('storage', handleStorageChange);
        };
    }, [fetchUser, logout]);

    return { user, login, loginWithGoogle, logout, loading, error };
};