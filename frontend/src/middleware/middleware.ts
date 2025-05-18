import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { ROUTES } from '@/routes/routePaths';

// Checks if a path exactly matches or starts with any route in the object
const pathMatches = (path: string, routeMap: Record<string, string>): boolean => {
  return Object.values(routeMap).some(route => 
    path === route || path.startsWith(`${route}/`) || 
    (path.startsWith(route) && path.charAt(route.length) === '?')
  );
};

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Check authentication cookies
  const authCookie = request.cookies.get('isAuthenticated')?.value;
  const userTypeCookie = request.cookies.get('userType')?.value;
  const profileCompletedCookie = request.cookies.get('isProfileCompleted')?.value;
  
  const isAuthenticated = authCookie === 'true';
  const isProfileCompleted = profileCompletedCookie === 'true';
  
  // Define important paths
  const dashboardPath = ROUTES.PROTECTED.DASHBOARD;
  const profileCompletePath = ROUTES.PROTECTED.PROFILE_COMPLETE;
  const loginPath = ROUTES.PUBLIC.LOGIN;

  // Manejo de la ruta raíz
  if (pathname === ROUTES.PUBLIC.ROOT_LOGIN) {
    if (isAuthenticated) {
      if (!isProfileCompleted) {
        return NextResponse.redirect(new URL(profileCompletePath, request.url));
      }
      return NextResponse.redirect(new URL(dashboardPath, request.url));
    } else {
      return NextResponse.redirect(new URL(loginPath, request.url));
    }
  }
  
  // Si ya está autenticado y trata de acceder al login, redirigir al dashboard
  if (pathname === loginPath && isAuthenticated) {
    if (!isProfileCompleted) {
      return NextResponse.redirect(new URL(profileCompletePath, request.url));
    }
    return NextResponse.redirect(new URL(dashboardPath, request.url));
  }
  
  // Permitir acceso a páginas públicas sin autenticación
  if (pathMatches(pathname, ROUTES.PUBLIC)) {
    return NextResponse.next();
  }
  
  // Verificar autenticación para rutas protegidas
  if (!isAuthenticated && (pathMatches(pathname, ROUTES.PROTECTED) || pathMatches(pathname, ROUTES.DOCTOR))) {
    const url = new URL(loginPath, request.url);
    url.searchParams.set('from', pathname);
    return NextResponse.redirect(url);
  }
  
  // Manejar rutas específicas de doctores
  if (isAuthenticated && pathMatches(pathname, ROUTES.DOCTOR) && userTypeCookie !== 'doctor') {
    return NextResponse.redirect(new URL(dashboardPath, request.url));
  }
  
  // Verificar completitud del perfil - no redirigir si ya están en la página de completar perfil
  if (isAuthenticated && !isProfileCompleted && pathname !== profileCompletePath) {
    return NextResponse.redirect(new URL(profileCompletePath, request.url));
  }
  
  return NextResponse.next();
}

// Configure middleware to run on all routes except static assets and API routes
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|public|api).*)',
  ],
};