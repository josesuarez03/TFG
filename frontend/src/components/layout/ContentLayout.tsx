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

    // Check if current path is a public route
    const isPublicRoute = Object.values(ROUTES.PUBLIC).some(route => pathname === route || pathname?.startsWith(route));

    // Determine if we should show the full layout (sidebar + header)
    const shouldShowFullLayout = isAuthenticated && !isPublicRoute;

    React.useEffect(() => {

        if (!loading) {
          if (!isAuthenticated && !isPublicRoute && pathname !== '/') {
            router.push('/auth/login?from=' + encodeURIComponent(pathname || ''));
          }
        }
    }, [isAuthenticated, isPublicRoute, loading, pathname, router]);
    
    // Show loading component while authentication state is being determined
    if (loading) {
        return <Loading />;
    }

    // Full layout for authenticated users on protected routes
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
      
    // Simple layout for public routes
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        {isPublicRoute ? (
          // Layout for public pages (login, register, etc.)
          <div className="flex justify-center items-center min-h-screen">

              {children}
          </div>
        ) : (
          // Layout for unauthorized access (should be handled by middleware)
          <div className="flex justify-center items-center min-h-screen">
            <div className="text-center p-8">
              <p className="text-gray-600 dark:text-gray-300">Acceso denegado. Por favor inicia sesión.</p>
            </div>
          </div>
        )}
      </div>
    );
}