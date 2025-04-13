import React, { useEffect } from 'react';
import { useRouter } from 'next/router';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/hooks/useAuth';
import { ROUTES } from '@/routes/routePaths';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const { isAuthenticated, loading } = useAuth();
    const router = useRouter();

    // Efecto para protección de rutas en el lado del cliente
    useEffect(() => {
        // Si no está cargando y no está autenticado, redirigir al login
        if (!loading && !isAuthenticated) {
            router.push({
                pathname: ROUTES.PUBLIC.LOGIN,
                query: { from: router.pathname }
            });
        }
    }, [isAuthenticated, loading, router]);

    // Mientras carga, muestra un spinner
    if (loading) {
        return (
            <div className="flex justify-center items-center h-screen bg-gray-100">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-900"></div>
            </div>
        );
    }

    // Si no está autenticado, no muestra el contenido
    if (!isAuthenticated) {
        return null;
    }

    // Si está autenticado, muestra el layout completo
    return (
        <div className="flex h-screen">
            <Sidebar />
            <main className="flex-1 p-6 bg-gray-100 overflow-y-auto">
                {children}
            </main>
        </div>
    );
}