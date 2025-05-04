// src/middleware.ts
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
  
  // Check password recovery flow cookies
  const recoveryInitiatedCookie = request.cookies.get('recoveryInitiated')?.value;
  const recoveryEmailSentCookie = request.cookies.get('recoveryEmailSent')?.value;
  
  const isAuthenticated = authCookie === 'true';
  
  // Define login path based on routes configuration
  const loginPath = ROUTES.PUBLIC.LOGIN;
  const isLoginPage = pathname === loginPath;
  
  // Root path handling - let client-side handle this to avoid redirect loops
  if (pathname === '/') {
    // For the root path, we'll let ContentLayout handle it
    // This prevents potential conflicts between middleware and client-side redirects
    return NextResponse.next();
  }
  
  // Allow direct access to login page without parameters
  if (isLoginPage && !request.nextUrl.search) {
    return NextResponse.next();
  }
  
  // Prevent circular redirects for login page with "from" parameter
  if (isLoginPage) {
    const fromParam = request.nextUrl.searchParams.get('from');
    
    // If fromParam is login page or doesn't exist, remove the parameter
    if (!fromParam || fromParam === loginPath || fromParam.startsWith(`${loginPath}?`)) {
      const cleanUrl = new URL(loginPath, request.url);
      return NextResponse.redirect(cleanUrl);
    }
    
    // Otherwise, allow normal access
    return NextResponse.next();
  }
  
  // Handle password recovery flow
  const recoverPasswordPath = ROUTES.PUBLIC.RECOVER_PASSWORD;
  const verifyCodePath = ROUTES.PUBLIC.VERIFY_CODE;
  const isRecoverPasswordPath = pathname === recoverPasswordPath;
  const isVerifyCodePath = pathname === verifyCodePath;
  
  if (isRecoverPasswordPath || isVerifyCodePath) {
    // For recover-password, verify if coming from login or already in flow
    if (isRecoverPasswordPath && !recoveryInitiatedCookie) {
      const fromLogin = request.nextUrl.searchParams.get('fromLogin');
      if (fromLogin !== 'true') {
        // If not from login and recovery flow not initiated, redirect to login
        return NextResponse.redirect(new URL(loginPath, request.url));
      }
    }
    
    // For verify-code, check if recover-password completed
    if (isVerifyCodePath && !recoveryEmailSentCookie) {
      // If email not sent (recover-password not completed), redirect to recover-password
      return NextResponse.redirect(new URL(recoverPasswordPath, request.url));
    }
    
    // Allow access to password recovery pages if conditions met
    return NextResponse.next();
  }
  
  // Unauthenticated user trying to access protected route
  if (!isAuthenticated && 
      (pathMatches(pathname, ROUTES.PROTECTED) || pathMatches(pathname, ROUTES.DOCTOR))) {
    const url = new URL(loginPath, request.url);
    url.searchParams.set('from', pathname);
    return NextResponse.redirect(url);
  }
  
  // Authenticated user trying to access public routes (like login/register)
  if (isAuthenticated && pathMatches(pathname, ROUTES.PUBLIC)) {
    return NextResponse.redirect(new URL(ROUTES.PROTECTED.DASHBOARD, request.url));
  }
  
  // Handle doctor-specific routes
  if (isAuthenticated && pathMatches(pathname, ROUTES.DOCTOR) && userTypeCookie !== 'doctor') {
    return NextResponse.redirect(new URL(ROUTES.PROTECTED.DASHBOARD, request.url));
  }
  
  // Check profile completion
  if (isAuthenticated && pathname !== ROUTES.PROTECTED.PROFILE_COMPLETE && 
      profileCompletedCookie === 'false') {
    return NextResponse.redirect(new URL(ROUTES.PROTECTED.PROFILE_COMPLETE, request.url));
  }
  
  return NextResponse.next();
}

// Configure middleware to run on all routes except static assets and API routes
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|public|api).*)',
  ],
};