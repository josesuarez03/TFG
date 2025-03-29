export interface LoginResponse {
    access: string;
    refresh: string;
}

export interface User {
    id: string;
    email: string;
    username: string;
    first_name: string;
    last_name: string;
    tipo: string;
    is_profile_completed: boolean;
}