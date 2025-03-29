import { useState, useEffect, useCallback } from "react";
import API from "@/services/api";
import { LoginResponse, User } from "@/types/auth";

export const useAuth = () => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState<boolean>(true); // Inicialmente cargando
    const [error, setError] = useState<string | null>(null);

    // Función para iniciar sesión
    const login = async (email: string, password: string): Promise<void> => {
        setLoading(true);
        setError(null);

        try {
            const response = await API.post<LoginResponse>("token/", { email, password });
            const { access, refresh } = response.data;

            // Guardar tokens en localStorage
            localStorage.setItem("access_token", access);
            localStorage.setItem("refresh_token", refresh);

            // Obtener datos del usuario autenticado
            await fetchUser();
        } catch (err: unknown) {
            if (err instanceof Error) {
                setError(err.message);
            } else if (typeof err === "object" && err !== null && "response" in err) {
                const axiosError = err as { response: { data: { detail: string } } };
                setError(axiosError.response?.data?.detail || "Error al iniciar sesión");
            } else {
                setError("Error desconocido al iniciar sesión");
            }
        } finally {
            setLoading(false);
        }
    };

    // Función para cerrar sesión
    const logout = useCallback((): void => {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        setUser(null);
        window.location.href = "/auth/login"; // Redirigir al login
    }, []);

    // Función para obtener los datos del usuario autenticado
    const fetchUser = useCallback(async (): Promise<void> => {
        try {
            const response = await API.get<User>("profile/");
            setUser(response.data);
        } catch (err: unknown) {
            console.error("Error al obtener el usuario:", err);
            logout(); // Si falla, cerrar sesión
        }
    }, [logout]);

    // Verificar si el usuario está autenticado al cargar el hook
    useEffect(() => {
        const token = localStorage.getItem("access_token");
        if (token) {
            fetchUser().catch(() => logout());
        } else {
            setLoading(false); // Si no hay token, dejar de cargar
        }
    }, [fetchUser, logout]);

    return { user, login, logout, loading, error };
};