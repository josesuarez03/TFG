import React, { ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";

interface ProtectedRouteProps {
    children: ReactNode;
}

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
    const { user, loading } = useAuth();

    if (loading) {
        return <p>Cargando...</p>; // Mostrar un mensaje de carga mientras se verifica la autenticación
    }

    if (!user) {
        window.location.href = "/auth/login"; // Redirigir al login si no está autenticado
        return null;
    }

    return <>{children}</>;
};