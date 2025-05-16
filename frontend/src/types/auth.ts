export interface LoginResponse {
    refresh: string;
    access: string;
    is_profile_completed?: boolean;
}