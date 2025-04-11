export interface UserProfile {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    tipo: string;
    fecha_nacimiento?: string;
    telefono?: string;
    direccion?: string;
    genero?: string;
    is_profile_completed: boolean;
    patient?: {
      ocupacion?: string;
      allergies?: string;
    };
    doctor?: {
      especialidad?: string;
      numero_licencia?: string;
    };
}