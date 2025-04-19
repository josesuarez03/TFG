'use client';

import React from "react";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import Loading from "@/components/loading";
import { ROUTES } from "@/routes/routePaths";
import { useAuth } from "@/hooks/useAuth";
import { usePathname, useRouter } from 'next/navigation';

export default function ContentLayout({ children }: { children: React.ReactNode }) {
    const { isAuthenticated, loading } = useAuth();
    const pathname = usePathname();
    const router = useRouter();

    const isPublicRoute = Object.values(ROUTES.PUBLIC).some(route => pathname?.startsWith(route));

    const shouldShowFullLayout = isAuthenticated && !isPublicRoute;

    React.useEffect(() => {
        if (!loading) {
          if (!isAuthenticated && !isPublicRoute) {
            router.push(`/login?from=${encodeURIComponent(pathname || '')}`);
          } else if (isAuthenticated && isPublicRoute) {
            router.push('/dashboard');
          }
        }
    }, [isAuthenticated, isPublicRoute, loading, pathname, router]);
    
    // Mientras carga, muestra el componente de carga
    if (loading) {
        return <Loading />;
    }

    if (shouldShowFullLayout) {
        return (
          <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
            <Sidebar />
            <div className="flex flex-col flex-1 overflow-hidden">
              <Header />
              <main className="flex-1 p-6 overflow-y-auto">
                {children}
              </main>
            </div>
          </div>
        );
      }
      
      // Layout simple para rutas públicas o cuando no está autenticado
      return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
          {isPublicRoute ? (
            // Layout para páginas públicas (login, registro, etc.)
            <div className="flex justify-center items-center min-h-screen">
              <div className="w-full max-w-md p-8 bg-white dark:bg-gray-800 rounded-lg shadow-md">
                <div className="text-center mb-8">
                  <h1 className="text-3xl font-bold text-gray-800 dark:text-white">MediCheck</h1>
                </div>
                {children}
              </div>
            </div>
          ) : (
            // Layout para redireccionamiento (usuario no autenticado intentando acceder a ruta protegida)
            <div className="flex justify-center items-center min-h-screen">
              <div className="text-center p-8">
                <p className="text-gray-600 dark:text-gray-300">Acceso denegado. Por favor inicia sesión.</p>
              </div>
            </div>
          )}
        </div>
      );
}