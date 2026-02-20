import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import {
  login as apiLogin,
  loginWithGoogle as apiLoginWithGoogle,
  getUserProfile,
  logout as apiLogout,
} from "@/services/api";
import { UserProfile } from "@/types/user";
import { ROUTES } from "@/routes/routePaths";
import {
  clearAuthCookies,
  updateAuthCookies,
  syncAuthState,
  subscribeToAuthChanges,
} from "@/utils/authSync";

export function useAuth() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  const clearSession = useCallback(() => {
    sessionStorage.removeItem("access_token");
    sessionStorage.removeItem("refresh_token");
    clearAuthCookies();
    setUser(null);
    setIsAuthenticated(false);
  }, []);

  const checkStorageAuth = useCallback(() => {
    const token = sessionStorage.getItem("access_token");
    const authenticated = !!token;
    setIsAuthenticated(authenticated);
    return authenticated;
  }, []);

  const fetchUserProfile = useCallback(async (): Promise<UserProfile | null> => {
    try {
      const token = sessionStorage.getItem("access_token");
      if (!token) {
        setUser(null);
        setIsAuthenticated(false);
        return null;
      }

      const userProfile = await getUserProfile();
      setUser(userProfile);
      setIsAuthenticated(true);
      syncAuthState();
      return userProfile;
    } catch (err) {
      setUser(null);
      setIsAuthenticated(false);

      if (axios.isAxiosError(err) && err.response?.status === 401) {
        clearSession();
      }

      return null;
    } finally {
      setLoading(false);
    }
  }, [clearSession]);

  const login = useCallback(
    async (username_or_email: string, password: string): Promise<UserProfile | null> => {
      try {
        setLoading(true);
        setError(null);

        const loginData = await apiLogin(username_or_email, password);
        const { access, refresh } = loginData;

        sessionStorage.setItem("access_token", access);
        sessionStorage.setItem("refresh_token", refresh);
        updateAuthCookies(access);

        setIsAuthenticated(true);
        return await fetchUserProfile();
      } catch (err: unknown) {
        let message = "Credenciales inválidas";
        if (axios.isAxiosError(err)) {
          const errorData = err.response?.data;
          message = errorData?.detail || errorData?.non_field_errors?.[0] || message;
        }
        setError(message);
        clearSession();
        return null;
      } finally {
        setLoading(false);
      }
    },
    [clearSession, fetchUserProfile]
  );

  const loginWithGoogle = useCallback(
    async (googleToken: string, tipo: string): Promise<UserProfile | null> => {
      try {
        setLoading(true);
        setError(null);

        const loginData = await apiLoginWithGoogle(googleToken, tipo);
        const { access, refresh } = loginData;

        sessionStorage.setItem("access_token", access);
        sessionStorage.setItem("refresh_token", refresh);
        updateAuthCookies(access);

        setIsAuthenticated(true);
        return await fetchUserProfile();
      } catch (err: unknown) {
        let message = "Error al iniciar sesión con Google";
        if (axios.isAxiosError(err)) {
          const errorData = err.response?.data;
          message = errorData?.detail || message;
        }
        setError(message);
        clearSession();
        return null;
      } finally {
        setLoading(false);
      }
    },
    [clearSession, fetchUserProfile]
  );

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } catch {
      // Always clear local state even when API logout fails.
    } finally {
      clearSession();
      router.push(ROUTES.PUBLIC.LOGIN);
    }
  }, [clearSession, router]);

  useEffect(() => {
    const unsubscribe = subscribeToAuthChanges((newAuthState) => {
      setIsAuthenticated(newAuthState);

      if (!newAuthState) {
        setUser(null);
      } else if (!user) {
        fetchUserProfile();
      }
    });

    return unsubscribe;
  }, [fetchUserProfile, user]);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const isAuthFromStorage = checkStorageAuth();
        if (isAuthFromStorage) {
          syncAuthState();
          await fetchUserProfile();
        } else {
          setLoading(false);
        }
      } catch {
        setLoading(false);
        setIsAuthenticated(false);
      }
    };

    checkAuth();

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === "access_token" || event.key === null) {
        checkStorageAuth();
        syncAuthState();
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [checkStorageAuth, fetchUserProfile]);

  return {
    user,
    loading,
    error,
    isAuthenticated,
    login,
    loginWithGoogle,
    logout,
    refreshProfile: fetchUserProfile,
  };
}
