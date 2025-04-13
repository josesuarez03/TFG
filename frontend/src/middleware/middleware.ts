import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Define route groups
const ROUTES = {
  // Public routes
  PUBLIC: {
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    PROFILE_TYPE: '/auth/profile-type',
    RECOVER_PASSWORD: '/auth/recover-password',
    VERIFY_CODE: '/auth/verify-code',
  },
  
  // Protected routes
  PROTECTED: {
    DASHBOARD: '/dashboard',
    HOME: '/home',
    PROFILE: '/profile',
    PROFILE_COMPLETE: '/profile/complete',
    PROFILE_EDIT: '/profile/edit',
    PROFILE_CHANGE_PASSWORD: '/profile/change-password',
    PROFILE_DELETE_ACCOUNT: '/profile/delete-account',
    CHAT: '/chat',
    MEDICAL_DATA: '/medical-data',
  },
  
  // Doctor-specific routes
  DOCTOR: {
    PATIENTS: '/doctor/patients',
    MEDICAL_DATA: '/doctor/medical-data',
  }
};

// Check if a path starts with any of the paths in the array
const pathStartsWith = (path: string, routeMap: Record<string, string>): boolean => {
  return Object.values(routeMap).some(route => path.startsWith(route));
};

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Check for authentication cookie
  const authCookie = request.cookies.get('isAuthenticated')?.value;
  const userTypeCookie = request.cookies.get('userType')?.value;
  const profileCompletedCookie = request.cookies.get('isProfileCompleted')?.value;
  
  // Check for password recovery flow cookies/tokens
  const recoveryInitiatedCookie = request.cookies.get('recoveryInitiated')?.value;
  const recoveryEmailSentCookie = request.cookies.get('recoveryEmailSent')?.value;
  
  const isAuthenticated = authCookie === 'true';
  
  // Handle root path - make it behave like dashboard
  if (pathname === '/') {
    if (!isAuthenticated) {
      // If not authenticated, redirect to login
      const url = new URL(ROUTES.PUBLIC.LOGIN, request.url);
      url.searchParams.set('from', ROUTES.PROTECTED.DASHBOARD);
      return NextResponse.redirect(url);
    }
    
    // If profile is not complete, redirect to complete profile
    if (profileCompletedCookie === 'false') {
      return NextResponse.redirect(new URL(ROUTES.PROTECTED.PROFILE_COMPLETE, request.url));
    }
    
    // Otherwise, continue to root path which will show dashboard content
    return NextResponse.redirect(new URL(ROUTES.PROTECTED.DASHBOARD, request.url));
  }
  
  // Handle password recovery flow
  if (pathStartsWith(pathname, ROUTES.PUBLIC) && 
      (pathname === ROUTES.PUBLIC.RECOVER_PASSWORD || pathname === ROUTES.PUBLIC.VERIFY_CODE)) {
    // For recover-password, check if coming from login or already in flow
    if (pathname === ROUTES.PUBLIC.RECOVER_PASSWORD && !recoveryInitiatedCookie) {
      // Check if the request includes a specific query parameter from login
      const fromLogin = request.nextUrl.searchParams.get('fromLogin');
      if (fromLogin !== 'true') {
        // If not from login and no recovery flow initiated, redirect to login
        return NextResponse.redirect(new URL(ROUTES.PUBLIC.LOGIN, request.url));
      }
    }
    
    // For verify-code, check if recover-password was completed
    if (pathname === ROUTES.PUBLIC.VERIFY_CODE && !recoveryEmailSentCookie) {
      // If email not sent (recover-password not completed), redirect to recover-password
      return NextResponse.redirect(new URL(ROUTES.PUBLIC.RECOVER_PASSWORD, request.url));
    }
    
    // Allow access to password recovery pages if conditions are met
    return NextResponse.next();
  }
  
  // User is not authenticated and trying to access protected route
  if (!isAuthenticated && (pathStartsWith(pathname, ROUTES.PROTECTED) || 
                          pathStartsWith(pathname, ROUTES.DOCTOR))) {
    const url = new URL(ROUTES.PUBLIC.LOGIN, request.url);
    url.searchParams.set('from', pathname);
    return NextResponse.redirect(url);
  }
  
  // User is authenticated but trying to access public routes (like login/register)
  if (isAuthenticated && pathStartsWith(pathname, ROUTES.PUBLIC)) {
    return NextResponse.redirect(new URL(ROUTES.PROTECTED.DASHBOARD, request.url));
  }
  
  // Handle doctor-specific routes
  if (isAuthenticated && pathStartsWith(pathname, ROUTES.DOCTOR) && userTypeCookie !== 'doctor') {
    return NextResponse.redirect(new URL(ROUTES.PROTECTED.DASHBOARD, request.url));
  }
  
  // Profile completion check
  if (isAuthenticated && pathname !== ROUTES.PROTECTED.PROFILE_COMPLETE && 
      profileCompletedCookie === 'false') {
    return NextResponse.redirect(new URL(ROUTES.PROTECTED.PROFILE_COMPLETE, request.url));
  }
  
  return NextResponse.next();
}

// Configure the middleware to run on all paths except static assets and API routes
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|public|api).*)',
  ],
};