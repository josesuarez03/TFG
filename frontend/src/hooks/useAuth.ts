import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import API from "@/services/api";
import { jwtDecode } from "jwt-decode";
import { LoginResponse } from "@/types/auth";
import { UserProfile, RegisterData } from "@/types/user";
import { syncAuthState, updateAuthCookies, clearAuthCookies } from "@/utils/authSync";
import { ROUTES } from "@/routes/routePaths";


export function useAuth() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  // Decode token to get profile completion status and user type
  const decodeToken = (token: string) => {
    try {
      return jwtDecode<{ is_profile_completed?: boolean; tipo?: string }>(token);
    } catch (err) {
      console.error("Error decoding token:", err);
      return null;
    }
  };

  // Fetch user profile data
  const fetchUser = useCallback(async (): Promise<UserProfile | null> => {
    try {
      const response = await API.get<UserProfile>("profile/");
      const userData = response.data;
      setUser(userData);
      setIsAuthenticated(true);
      return userData;
    } catch (err) {
      console.error("Error fetching user profile:", err);
      setUser(null);
      setIsAuthenticated(false);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle login
  const login = async (email: string, password: string): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const response = await API.post<LoginResponse>("token/", { email, password });
      const { access, refresh } = response.data;

      // Store tokens in localStorage
      localStorage.setItem("access_token", access);
      localStorage.setItem("refresh_token", refresh);
      
      // Update cookies for middleware
      updateAuthCookies(access);
      
      // Set authenticated state
      setIsAuthenticated(true);

      // Get user data
      await fetchUser();
      
      // Handle redirection based on profile completion
      const decodedToken = decodeToken(access);
      if (decodedToken?.is_profile_completed === false) {
        router.push(ROUTES.PROTECTED.PROFILE_COMPLETE);
      } else {
        router.push(ROUTES.PROTECTED.DASHBOARD);
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Unknown login error";
      setError(errorMessage);
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  // Handle Google login
  const loginWithGoogle = async (token: string, profileType?: string): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      // Get profile type from parameter or localStorage
      const tipo = profileType || localStorage.getItem('selectedProfileType') || 'patient';
      
      // Make API request with both token and tipo
      const response = await API.post<LoginResponse>("google/login/", { 
        token,
        tipo
      });
      
      const { access, refresh } = response.data;

      // Store tokens in localStorage
      localStorage.setItem("access_token", access);
      localStorage.setItem("refresh_token", refresh);
      
      // Update cookies for middleware
      updateAuthCookies(access);
      
      // Set authenticated state
      setIsAuthenticated(true);

      // Get user data
      await fetchUser();
      
      // Handle redirection based on profile completion
      const decodedToken = decodeToken(access);
      if (decodedToken?.is_profile_completed === false) {
        router.push(ROUTES.PROTECTED.PROFILE_COMPLETE);
      } else {
        router.push(ROUTES.PROTECTED.DASHBOARD);
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Unknown Google login error";
      setError(errorMessage);
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  // Handle logout
  const logout = useCallback((): void => {
    // Clear tokens from localStorage
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    
    // Clear cookies for middleware
    clearAuthCookies();
    
    // Reset state
    setUser(null);
    setIsAuthenticated(false);
    
    // Redirect to login page
    router.push(ROUTES.PUBLIC.LOGIN);
  }, [router]);

  // Register a new user - with proper typing
  const register = async (userData: RegisterData): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      await API.post("register/", userData);
      // After successful registration, redirect to login
      router.push(ROUTES.PUBLIC.LOGIN);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Unknown registration error";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Check authentication status on mount
  useEffect(() => {
    const checkAuth = async () => {
      setLoading(true);
      
      // Sync auth state with cookies
      syncAuthState();
      
      const token = localStorage.getItem("access_token");
      if (token) {
        // Token exists, fetch user data
        const userData = await fetchUser();
        if (!userData) {
          // User data fetch failed, logout
          logout();
        }
      } else {
        // No token, user is not authenticated
        setIsAuthenticated(false);
        setLoading(false);
      }
    };
    
    checkAuth();
    
    // Listen for storage events (e.g., logout in another tab)
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'access_token') {
        syncAuthState();
        if (!event.newValue) {
          setUser(null);
          setIsAuthenticated(false);
        }
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [fetchUser, logout]);

  // Return hook state and methods
  return {
    user,
    loading,
    error,
    isAuthenticated,
    login,
    loginWithGoogle,
    logout,
    register,
    fetchUser
  };
}