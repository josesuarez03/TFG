export interface UserProfile {
  id: string;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  tipo: string;
  fecha_nacimiento?: string;
  telefono?: string;
  direccion?: string;
  genero?: string;
  is_profile_completed: boolean;
  patient?: {
    triaje_level?: string;
    ocupacion?: string;
    pain_scale?: number;
    medical_context?: string;
    allergies?: string;
    medications?: string;
    medical_history?: string;
  };
  doctor?: {
    especialidad?: string;
    numero_licencia?: string;
  };
  date_joined: string;
  last_login: string;
  is_active: boolean;
}