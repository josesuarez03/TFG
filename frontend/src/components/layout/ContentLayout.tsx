'use client';

import React, { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import Loading from "@/components/loading";
import { ROUTES } from "@/routes/routePaths";
import { useAuth } from "@/hooks/useAuth";
import { usePathname, useRouter } from 'next/navigation';

export default function ContentLayout({ children }: { children: React.ReactNode }) {
    const { isAuthenticated, loading } = useAuth();
    const pathname = usePathname();
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);
    const safePath = pathname || "";

    // Verificar si la ruta actual es pública de manera más explícita
    const isPublicRoute = Object.values(ROUTES.PUBLIC).some(route => 
        pathname === route || 
        (pathname && pathname.startsWith(`${route}/`)) ||
        (pathname && pathname.startsWith(route) && pathname.charAt(route.length) === '?')
    );

    // Determinar si es una ruta protegida explícitamente
    const isProtectedRoute = Object.values(ROUTES.PROTECTED).some(route => 
        pathname === route || 
        (pathname && pathname.startsWith(`${route}/`)) ||
        (pathname && pathname.startsWith(route) && pathname.charAt(route.length) === '?')
    );

    // Determinar si es una ruta de doctor explícitamente
    const isDoctorRoute = Object.values(ROUTES.DOCTOR).some(route => 
        pathname === route || 
        (pathname && pathname.startsWith(`${route}/`)) ||
        (pathname && pathname.startsWith(route) && pathname.charAt(route.length) === '?')
    );

    // Solo mostrar el layout completo si está autenticado Y está en una ruta protegida o de doctor
    const shouldShowFullLayout = isAuthenticated && (isProtectedRoute || isDoctorRoute);

    // Handle navigation and auth state
    useEffect(() => {
        // Solo proceder si no está cargando
        if (!loading) {
            setIsLoading(false);
            
            // Manejar redirección de la ruta raíz
            if (pathname === '/') {
                if (isAuthenticated) {
                    router.push(ROUTES.PROTECTED.DASHBOARD);
                } else {
                    router.push(ROUTES.PUBLIC.LOGIN);
                }
                return;
            }
          
            // Manejar acceso a rutas protegidas cuando no está autenticado
            if (!isAuthenticated && (isProtectedRoute || isDoctorRoute)) {
                router.push(`${ROUTES.PUBLIC.LOGIN}?from=${encodeURIComponent(safePath)}`);
                return;
            }

        }
    }, [isAuthenticated, isProtectedRoute, isDoctorRoute, loading, pathname, router, safePath]);
    
    // Mostrar componente de carga mientras se determina el estado de autenticación
    if (loading || isLoading) {
        return <Loading />;
    }

    // Layout completo para usuarios autenticados en rutas no públicas
    if (shouldShowFullLayout) {
        return (
            <div className="flex h-screen bg-gradient-to-b from-slate-100 to-slate-50 dark:from-slate-950 dark:to-slate-900">
                <Sidebar />
                <div className="flex flex-col flex-1 overflow-hidden">
                    <Header />
                    <main className="flex-1 overflow-y-auto">
                        <div className="page-container">
                        {children}
                        </div>
                    </main>
                </div>
            </div>
        );
    }
      
    // Layout simple para rutas públicas
    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-100 to-slate-50 dark:from-slate-950 dark:to-slate-900">
            <div className="flex justify-center items-center min-h-screen px-4 py-8">
                {children}
            </div>
        </div>
    );
}
