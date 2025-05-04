// src/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { ROUTES } from '@/routes/routePaths';

// Comprueba si una ruta comienza con cualquiera de las rutas en el objeto
const pathStartsWith = (path: string, routeMap: Record<string, string>): boolean => {
  return Object.values(routeMap).some(route => path.startsWith(route));
};

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Verifica las cookies de autenticación
  const authCookie = request.cookies.get('isAuthenticated')?.value;
  const userTypeCookie = request.cookies.get('userType')?.value;
  const profileCompletedCookie = request.cookies.get('isProfileCompleted')?.value;
  
  // Verifica cookies del flujo de recuperación de contraseña
  const recoveryInitiatedCookie = request.cookies.get('recoveryInitiated')?.value;
  const recoveryEmailSentCookie = request.cookies.get('recoveryEmailSent')?.value;
  
  const isAuthenticated = authCookie === 'true';
  
  // Verifica si estamos en la página de login basada en la estructura app/auth/login
  const loginPath = '/auth/login';
  const isLoginPage = pathname === loginPath;
  
  // Manejo de la ruta raíz
  if (pathname === '/') {
    return isAuthenticated 
      ? NextResponse.redirect(new URL(ROUTES.PROTECTED.DASHBOARD, request.url))
      : NextResponse.redirect(new URL(loginPath, request.url));
  }
  
  // Permitir acceso directo a la página de login sin parámetros
  if (isLoginPage && !request.nextUrl.search) {
    return NextResponse.next();
  }
  
  // Prevenir redirección circular para la página de login con parámetro "from"
  if (isLoginPage) {
    const fromParam = request.nextUrl.searchParams.get('from');
    
    // Si fromParam es la página de login o no existe, eliminamos el parámetro
    if (!fromParam || fromParam === loginPath || fromParam.startsWith(`${loginPath}?`)) {
      const cleanUrl = new URL(loginPath, request.url);
      return NextResponse.redirect(cleanUrl);
    }
    
    // En cualquier otro caso, permitimos el acceso normal
    return NextResponse.next();
  }
  
  // Manejo del flujo de recuperación de contraseña
  const recoverPasswordPath = '/auth/recover-password';
  const verifyCodePath = '/auth/verify-code';
  const isRecoverPasswordPath = pathname === recoverPasswordPath;
  const isVerifyCodePath = pathname === verifyCodePath;
  
  if (isRecoverPasswordPath || isVerifyCodePath) {
    // Para recover-password, verificar si viene de login o ya está en el flujo
    if (isRecoverPasswordPath && !recoveryInitiatedCookie) {
      const fromLogin = request.nextUrl.searchParams.get('fromLogin');
      if (fromLogin !== 'true') {
        // Si no viene de login y no se ha iniciado el flujo de recuperación, redirigir a login
        return NextResponse.redirect(new URL(loginPath, request.url));
      }
    }
    
    // Para verify-code, verificar si se completó recover-password
    if (isVerifyCodePath && !recoveryEmailSentCookie) {
      // Si no se envió email (recover-password no completado), redirigir a recover-password
      return NextResponse.redirect(new URL(recoverPasswordPath, request.url));
    }
    
    // Permitir acceso a las páginas de recuperación de contraseña si se cumplen las condiciones
    return NextResponse.next();
  }
  
  // Usuario no autenticado intentando acceder a ruta protegida
  if (!isAuthenticated && 
      (pathStartsWith(pathname, ROUTES.PROTECTED) || pathStartsWith(pathname, ROUTES.DOCTOR))) {
    const url = new URL(loginPath, request.url);
    url.searchParams.set('from', pathname);
    return NextResponse.redirect(url);
  }
  
  // Usuario autenticado intentando acceder a rutas públicas (como login/registro)
  if (isAuthenticated && pathStartsWith(pathname, ROUTES.PUBLIC)) {
    return NextResponse.redirect(new URL(ROUTES.PROTECTED.DASHBOARD, request.url));
  }
  
  // Manejo de rutas específicas para doctores
  if (isAuthenticated && pathStartsWith(pathname, ROUTES.DOCTOR) && userTypeCookie !== 'doctor') {
    return NextResponse.redirect(new URL(ROUTES.PROTECTED.DASHBOARD, request.url));
  }
  
  // Verificación de completitud del perfil
  if (isAuthenticated && pathname !== ROUTES.PROTECTED.PROFILE_COMPLETE && 
      profileCompletedCookie === 'false') {
    return NextResponse.redirect(new URL(ROUTES.PROTECTED.PROFILE_COMPLETE, request.url));
  }
  
  return NextResponse.next();
}

// Configurar el middleware para ejecutarse en todas las rutas excepto assets estáticos y rutas API
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|public|api).*)',
  ],
};