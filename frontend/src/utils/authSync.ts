// utils/authSync.ts
import { jwtDecode } from "jwt-decode";

interface DecodedToken {
  tipo?: string;
  is_profile_completed?: boolean;
  [key: string]: unknown;
}

// Sync localStorage tokens to cookies for middleware to access
export function syncAuthState(): void {
  // Run only in browser
  if (typeof window === 'undefined') return;
  
  const accessToken = localStorage.getItem('access_token');
  
  if (accessToken) {
    // Set authentication cookie
    document.cookie = `isAuthenticated=true; path=/; max-age=86400; samesite=lax`;
    
    try {
      // Decode token to get user type and profile status
      const decoded = jwtDecode<DecodedToken>(accessToken);
      
      // Set user type cookie
      if (decoded.tipo) {
        document.cookie = `userType=${decoded.tipo}; path=/; max-age=86400; samesite=lax`;
      }
      
      // Set profile completed cookie
      if (decoded.is_profile_completed !== undefined) {
        document.cookie = `isProfileCompleted=${decoded.is_profile_completed}; path=/; max-age=86400; samesite=lax`;
      }
    } catch (e) {
      console.error('Error decoding token:', e);
    }
  } else {
    // Clear auth cookies if no token exists
    document.cookie = `isAuthenticated=false; path=/; max-age=0; samesite=lax`;
    document.cookie = `userType=; path=/; max-age=0; samesite=lax`;
    document.cookie = `isProfileCompleted=; path=/; max-age=0; samesite=lax`;
  }
}

// Function to call when logging in
export function updateAuthCookies(accessToken: string): void {
  if (!accessToken) return;
  
  // Set authentication cookie
  document.cookie = `isAuthenticated=true; path=/; max-age=86400; samesite=lax`;
  
  try {
    // Decode token to get user type and profile status
    const decoded = jwtDecode<DecodedToken>(accessToken);
    
    // Set user type cookie
    if (decoded.tipo) {
      document.cookie = `userType=${decoded.tipo}; path=/; max-age=86400; samesite=lax`;
    }
    
    // Set profile completed cookie
    if (decoded.is_profile_completed !== undefined) {
      document.cookie = `isProfileCompleted=${decoded.is_profile_completed}; path=/; max-age=86400; samesite=lax`;
    }
  } catch (e) {
    console.error('Error decoding token:', e);
  }
}

// Function to call when logging out
export function clearAuthCookies(): void {
  document.cookie = `isAuthenticated=false; path=/; max-age=0; samesite=lax`;
  document.cookie = `userType=; path=/; max-age=0; samesite=lax`;
  document.cookie = `isProfileCompleted=; path=/; max-age=0; samesite=lax`;
}

// --- Password Recovery Flow Functions ---

// Function to call when initiating password recovery from login
export function initiatePasswordRecovery(): void {
  document.cookie = `recoveryInitiated=true; path=/; max-age=3600; samesite=lax`; // 1 hour expiration
}

// Function to call when email is sent in recover-password page
export function confirmRecoveryEmailSent(): void {
  document.cookie = `recoveryEmailSent=true; path=/; max-age=3600; samesite=lax`; // 1 hour expiration
}

// Function to call when password reset is complete
export function clearRecoveryState(): void {
  document.cookie = `recoveryInitiated=; path=/; max-age=0; samesite=lax`;
  document.cookie = `recoveryEmailSent=; path=/; max-age=0; samesite=lax`;
}