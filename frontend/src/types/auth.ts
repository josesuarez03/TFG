export interface LoginResponse {
    refresh: string;
    access: string;
    profile_complete?: boolean;
}