import { jwtDecode } from "jwt-decode";

interface DecodedToken {
  tipo?: string;
  is_profile_completed?: boolean;
  [key: string]: unknown;
}

// Event to notify subscribers when auth state changes
const AUTH_CHANGE_EVENT = 'auth_state_changed';

// Create a custom event for auth state changes
export function dispatchAuthChange(isAuthenticated: boolean): void {
  if (typeof window === 'undefined') return;
  
  const event = new CustomEvent(AUTH_CHANGE_EVENT, { 
    detail: { isAuthenticated } 
  });
  window.dispatchEvent(event);
}

// Subscribe to auth state changes
export function subscribeToAuthChanges(callback: (isAuthenticated: boolean) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  
  const handler = (event: Event) => {
    const customEvent = event as CustomEvent;
    callback(customEvent.detail.isAuthenticated);
  };
  
  window.addEventListener(AUTH_CHANGE_EVENT, handler);
  return () => window.removeEventListener(AUTH_CHANGE_EVENT, handler);
}

// Sync localStorage tokens to cookies for middleware to access
export function syncAuthState(): void {
  // Run only in browser
  if (typeof window === 'undefined') return;
  
  const accessToken = sessionStorage.getItem('access_token');
  let isAuthenticated = false;
  
  if (accessToken) {
    isAuthenticated = true;
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
  
  // Notify subscribers about the auth state change
  dispatchAuthChange(isAuthenticated);
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
    
    // Notify subscribers about the auth state change
    dispatchAuthChange(true);
  } catch (e) {
    console.error('Error decoding token:', e);
  }
}

// Function to call when logging out
export function clearAuthCookies(): void {
  document.cookie = `isAuthenticated=false; path=/; max-age=0; samesite=lax`;
  document.cookie = `userType=; path=/; max-age=0; samesite=lax`;
  document.cookie = `isProfileCompleted=; path=/; max-age=0; samesite=lax`;
  
  // Notify subscribers about the auth state change
  dispatchAuthChange(false);
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

// Run syncAuthState on initial load
if (typeof window !== 'undefined') {
  syncAuthState();
  
  // Also sync when storage changes in other tabs
  window.addEventListener('storage', (event) => {
    if (event.key === 'access_token' || event.key === null) {
      syncAuthState();
    }
  });
}