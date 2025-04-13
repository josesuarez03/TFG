export const ROUTES = {
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
  
  // Navigation data for sidebar and menus
  export const NAVIGATION_ITEMS = {
    // Main navigation
    main: [
      { name: 'Dashboard', path: ROUTES.PROTECTED.DASHBOARD, icon: 'HomeIcon' },
      { name: 'Profile', path: ROUTES.PROTECTED.PROFILE, icon: 'UserIcon' },
      { name: 'Chat', path: ROUTES.PROTECTED.CHAT, icon: 'ChatBubbleOvalLeftIcon' },
      { name: 'Medical Data', path: ROUTES.PROTECTED.MEDICAL_DATA, icon: 'ClipboardDocumentListIcon' },
    ],
    
    // Doctor-specific navigation
    doctor: [
      { name: 'Patients', path: ROUTES.DOCTOR.PATIENTS, icon: 'UserGroupIcon' },
      { name: 'Medical Data', path: ROUTES.DOCTOR.MEDICAL_DATA, icon: 'DocumentChartBarIcon' },
    ],
    
    // Profile-related links
    profile: [
      { name: 'Edit Profile', path: ROUTES.PROTECTED.PROFILE_EDIT, icon: 'PencilIcon' },
      { name: 'Change Password', path: ROUTES.PROTECTED.PROFILE_CHANGE_PASSWORD, icon: 'LockClosedIcon' },
      { name: 'Delete Account', path: ROUTES.PROTECTED.PROFILE_DELETE_ACCOUNT, icon: 'TrashIcon' },
    ],
  };