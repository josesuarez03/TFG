'use client';

import React, { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import { useAuth as useAuthHook } from '@/hooks/useAuth';
import { UserProfile } from '@/types/user';
import { useAppRouter } from '@/utils/router';
import { syncAuthState } from '@/utils/authSync';

interface AuthContextType {
  user: UserProfile | null;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: (token: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const auth = useAuthHook();
  const { navigate } = useAppRouter();
  
  useEffect(() => {
    // Sync auth state on mount
    syncAuthState();
    
    // Set up event listener for storage changes
    const handleStorageChange = () => {
      syncAuthState();
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);
  
  // Enhanced logout function
  const enhancedAuth: AuthContextType = {
    user: auth.user,
    login: auth.login,
    loginWithGoogle: auth.loginWithGoogle,
    logout: () => {
      auth.logout();
      navigate.toLogin();
    },
    loading: auth.loading,
    error: auth.error,
  };
  
  return (
    <AuthContext.Provider value={enhancedAuth}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};