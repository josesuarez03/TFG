import axios from 'axios';
import { LoginResponse } from '@/types/auth';
import { UserProfile, RegisterData, LoginCredentials, ProfileUpdateData } from '@/types/user';

// Define la URL base de la API
const API_URL = 'https://localhost:8443/api/';

const API = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  timeout: 10000,
  withCredentials: true,
});

// Interceptor de solicitud - añade el token de autorización a cada petición
API.interceptors.request.use(
  (config) => {
    const token = sessionStorage.getItem('access_token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    console.error('Error en la petición:', error);
    return Promise.reject(error);
  }
);

// Interceptor de respuesta - maneja errores y renovación de tokens
API.interceptors.response.use(
  (response) => {
    // Simplemente devuelve la respuesta si todo va bien
    return response;
  },
  async (error) => {
    // Maneja errores de respuesta
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }

    const originalRequest = error.config;
    // Si el error es 401 (no autorizado) y no hemos intentado renovar el token ya
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = sessionStorage.getItem('refresh_token');
      
      if (!refreshToken) {
        // Si no hay refresh token, no podemos renovar la sesión
        return Promise.reject(error);
      }

      try {
        // Intenta renovar el token
        const response = await axios.post(`${API_URL}auth/refresh/`, { 
          refresh: refreshToken 
        }, {
          headers: { 'Content-Type': 'application/json' }
        });
        
        const { access } = response.data;
        // Guarda el nuevo token de acceso
        sessionStorage.setItem('access_token', access);
        // Actualiza el token para la petición original
        originalRequest.headers['Authorization'] = `Bearer ${access}`;
        // Reintenta la petición original con el nuevo token
        return axios(originalRequest);
      } catch (refreshError) {
        console.error('Error refreshing token:', refreshError);
        // Si no se puede renovar el token, elimina los tokens almacenados
        sessionStorage.removeItem('access_token');
        sessionStorage.removeItem('refresh_token');
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);

// Función para iniciar sesión
export const login = async (credentials: LoginCredentials): Promise<LoginResponse> => {
  try {
    const response = await API.post('login/', credentials);
    return response.data;
  } catch (error) {
    console.error('Error en la función de inicio de sesión:', error);
    throw error;
  }
};

export const loginWithGoogle = async (token: string, profile_type:string): Promise<LoginResponse> => {
  try {
    const response = await API.post('google/login', { token, profile_type:profile_type });
    if (response.status !== 200) {
        throw new Error('Error al iniciar sesión con Google');
        }
    return response.data;
  }
  catch (error) {
    console.error('Error en la función de inicio de sesión con Google:', error);
    throw error;
  }
};

// Función para registrar un nuevo usuario
export const register = async (data: RegisterData): Promise<LoginResponse> => {
  try {
    const response = await API.post('register/', data);
    return response.data;
  } catch (error) {
    console.error('Error en la función de registro:', error);
    throw error;
  }
};

export const getUserProfile = async (): Promise<UserProfile> => {
  try {
    const response = await API.get('profile/');
    return response.data;
  } catch (error) {
    console.error('Error al obtener el perfil del usuario:', error);
    throw error;
  }
};

export const updateUserProfile = async (data: ProfileUpdateData): Promise<UserProfile> => {
  try {
    const response = await API.put('profile/', data);
    return response.data;
  } catch (error) {
    console.error('Error al actualizar el perfil del usuario:', error);
    throw error;
  }
};

export const logout = async (): Promise<void> => {
  try {
    await API.post('logout/');
    sessionStorage.removeItem('access_token');
    sessionStorage.removeItem('refresh_token');
  } catch (error) {
    console.error('Error al cerrar sesión:', error);
    throw error;
  }
};

export const deleteUser = async (): Promise<void> => {
  try {
    await API.delete('account/delete/');
    sessionStorage.removeItem('access_token');
    sessionStorage.removeItem('refresh_token');
  } catch (error) {
    console.error('Error al eliminar el usuario:', error);
    throw error;
  }
};

export default API;