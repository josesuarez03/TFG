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
    
    // Also consider root path as public
    const isPublicOrRoot = isPublicRoute || pathname === '/';

    // Determine if we should show the full layout (sidebar + header)
    const shouldShowFullLayout = isAuthenticated && !isPublicOrRoot;

    React.useEffect(() => {
        // Only redirect if not loading
        if (!loading) {
          // Handle root path - silently redirect to login if not authenticated
          if (pathname === '/' && !isAuthenticated) {
            router.push(ROUTES.PUBLIC.LOGIN);
            return;
          }
          
          // Only redirect from protected routes to login if not authenticated
          // Don't redirect away from public routes
          if (!isAuthenticated && !isPublicRoute && pathname !== '/') {
            router.push(ROUTES.PUBLIC.LOGIN + '?from=' + encodeURIComponent(pathname || ''));
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
        {isPublicOrRoot ? (
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