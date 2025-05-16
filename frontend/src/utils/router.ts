// src/utils/router.ts
'use client';

import { useRouter } from 'next/navigation';
import { ROUTES } from '@/routes/routePaths';

export function useAppRouter() {
  const router = useRouter();

  // Navigation helpers
  const navigate = {
    // Public routes
    toLogin: (from?: string) => {
      // Podemos usar la ruta raíz para login o la ruta específica, aquí preferimos la raíz
      const path = ROUTES.PUBLIC.ROOT_LOGIN;
      if (from) {
        router.push(`${path}?from=${encodeURIComponent(from)}`);
      } else {
        router.push(path);
      }
    },
    toHome: () => router.push(ROUTES.PUBLIC.ROOT_LOGIN),  // Ahora la home es el login
    toRegister: () => router.push(ROUTES.PUBLIC.REGISTER),
    toProfileType: () => router.push(ROUTES.PUBLIC.PROFILE_TYPE),
    toCompleteProfile: () => router.push(ROUTES.PUBLIC.COMPLETE_PROFILE),
    toRecoverPassword: (fromLogin = true) => {
      const path = ROUTES.PUBLIC.RECOVER_PASSWORD;
      if (fromLogin) {
        router.push(`${path}?fromLogin=true`);
      } else {
        router.push(path);
      }
    },
    toVerifyCode: () => router.push(ROUTES.PUBLIC.VERIFY_CODE),

    // Protected routes
    toDashboard: () => router.push(ROUTES.PROTECTED.DASHBOARD),
    toProfile: () => router.push(ROUTES.PROTECTED.PROFILE),
    toProfileComplete: () => router.push(ROUTES.PROTECTED.PROFILE_COMPLETE),
    toEditProfile: () => router.push(ROUTES.PROTECTED.PROFILE_EDIT),
    toChangePassword: () => router.push(ROUTES.PROTECTED.PROFILE_CHANGE_PASSWORD),
    toDeleteAccount: () => router.push(ROUTES.PROTECTED.PROFILE_DELETE_ACCOUNT),
    toChat: () => router.push(ROUTES.PROTECTED.CHAT),
    toMedicalData: () => router.push(ROUTES.PROTECTED.MEDICAL_DATA),

    // Doctor routes
    toPatients: () => router.push(ROUTES.DOCTOR.PATIENTS),
    toDoctorMedicalData: () => router.push(ROUTES.DOCTOR.MEDICAL_DATA),
  };

  return {
    router,
    navigate,
  };
}