// components/AuthStateSync.tsx
"use client";

import { useEffect } from 'react';
import { syncAuthState } from '@/utils/authSync';

// This component will sync the auth state across the app
export default function AuthStateSync() {
  useEffect(() => {
    // Initial sync
    syncAuthState();
    
    // Setup event listeners
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Re-sync when tab becomes visible again
        syncAuthState();
      }
    };
    
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'access_token' || event.key === null) {
        syncAuthState();
      }
    };
    
    // Add visibility change event listener for tab focus
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Add storage change event listener for cross-tab synchronization
    window.addEventListener('storage', handleStorageChange);
    
    // Run sync every minute to handle token expiry
    const interval = setInterval(syncAuthState, 60000);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  return null; // This component doesn't render anything
}