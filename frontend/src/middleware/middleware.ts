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
  
  // Define login path based on routes configuration
  const loginPath = ROUTES.PUBLIC.LOGIN;
  const dashboardPath = ROUTES.PROTECTED.DASHBOARD;
  const profileCompletePath = ROUTES.PROTECTED.PROFILE_COMPLETE;

  // Handle root path `/`
  if (pathname === '/') {
    if (!isAuthenticated) {
      // Redirect immediately to the login page
      return NextResponse.redirect(new URL(loginPath, request.url));
    }
    
    // If authenticated but not completed profile, redirect to profile completion
    if (!isProfileCompleted) {
      return NextResponse.redirect(new URL(profileCompletePath, request.url));
    }
    
    // If authenticated and profile complete, redirect to the dashboard
    return NextResponse.redirect(new URL(dashboardPath, request.url));
  }
  
  // Allow direct access to specific public pages without authentication
  if (pathMatches(pathname, ROUTES.PUBLIC)) {
    return NextResponse.next();
  }
  
  // Handle unauthenticated access to protected routes
  if (!isAuthenticated && (pathMatches(pathname, ROUTES.PROTECTED) || pathMatches(pathname, ROUTES.DOCTOR))) {
    const url = new URL(loginPath, request.url);
    url.searchParams.set('from', pathname);
    return NextResponse.redirect(url);
  }
  
  // Handle authenticated access to public routes
  if (isAuthenticated && pathMatches(pathname, ROUTES.PUBLIC)) {
    // If profile not completed, don't redirect to dashboard but to profile completion
    if (!isProfileCompleted) {
      return NextResponse.redirect(new URL(profileCompletePath, request.url));
    }
    return NextResponse.redirect(new URL(dashboardPath, request.url));
  }
  
  // Handle doctor-specific routes
  if (isAuthenticated && pathMatches(pathname, ROUTES.DOCTOR) && userTypeCookie !== 'doctor') {
    return NextResponse.redirect(new URL(dashboardPath, request.url));
  }
  
  // Check profile completion - don't redirect if they're already on the profile complete page
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