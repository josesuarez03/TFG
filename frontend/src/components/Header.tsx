import React from "react";
import { useAuth } from "@/hooks/useAuth";

export default function Header() {
    const { user, loading } = useAuth();

    const getName = () => {
        if (loading) return "Cargando...";
        if (!user) return "Usuario";
        return user.first_name || "Usuario";
    };

    return (
        <header className="flex items-center justify-between p-4 ">
            <h1 className="text-4xl font-bold">
                Bienvenido, <span className="font-semibold">{getName()}</span>
            </h1>
        </header>
    );
}