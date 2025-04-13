import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
 
// Define route groups
const protectedRoutes = [
    '/dashboard',
    '/home',
    '/profile',
    '/chat',
    '/medical-data',
    '/profile/edit',
    '/profile/change-password',
    '/profile/delete-account',
];

const publicRoutes = [
    '/auth/login',
    '/auth/register',
    '/auth/profile-type',
];

const passwordRecoveryRoutes = [
    '/auth/recover-password',
    '/auth/verify-code'
];

const doctorRoutes = [
    '/doctor/patients',
    '/doctor/medical-data',
];

// Check if a path starts with any of the paths in the array
const pathStartsWith = (path: string, routes: string[]): boolean => {
    return routes.some(route => path.startsWith(route));
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
            const url = new URL('/auth/login', request.url);
            url.searchParams.set('from', '/dashboard');
            return NextResponse.redirect(url);
        }
        
        // If profile is not complete, redirect to complete profile
        if (profileCompletedCookie === 'false') {
            return NextResponse.redirect(new URL('/profile/complete', request.url));
        }
        
        // Otherwise, continue to root path which will show dashboard content
        return NextResponse.next();
    }
    
    // Handle password recovery flow
    if (pathStartsWith(pathname, passwordRecoveryRoutes)) {
        // For recover-password, check if coming from login or already in flow
        if (pathname === '/auth/recover-password' && !recoveryInitiatedCookie) {
            // Check if the request includes a specific query parameter from login
            const fromLogin = request.nextUrl.searchParams.get('fromLogin');
            if (fromLogin !== 'true') {
                // If not from login and no recovery flow initiated, redirect to login
                return NextResponse.redirect(new URL('/auth/login', request.url));
            }
        }
        
        // For verify-code, check if recover-password was completed
        if (pathname === '/auth/verify-code' && !recoveryEmailSentCookie) {
            // If email not sent (recover-password not completed), redirect to recover-password
            return NextResponse.redirect(new URL('/auth/recover-password', request.url));
        }
        
        // Allow access to password recovery pages if conditions are met
        return NextResponse.next();
    }
    
    // User is not authenticated and trying to access protected route
    if (!isAuthenticated && (pathStartsWith(pathname, protectedRoutes) || pathStartsWith(pathname, doctorRoutes))) {
        const url = new URL('/auth/login', request.url);
        url.searchParams.set('from', pathname);
        return NextResponse.redirect(url);
    }
    
    // User is authenticated but trying to access public routes (like login/register)
    if (isAuthenticated && pathStartsWith(pathname, publicRoutes)) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    
    // Handle doctor-specific routes
    if (isAuthenticated && pathStartsWith(pathname, doctorRoutes) && userTypeCookie !== 'doctor') {
        return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    
    // Profile completion check
    if (isAuthenticated && pathname !== '/profile/complete' && profileCompletedCookie === 'false') {
        return NextResponse.redirect(new URL('/profile/complete', request.url));
    }
    
    return NextResponse.next();
}

// Configure the middleware to run only on specific paths
export const config = {
    matcher: [
        /*
         * Match all request paths except:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public files (public folder)
         * - api routes
         */
        '/((?!_next/static|_next/image|favicon.ico|public|api).*)',
    ],
};