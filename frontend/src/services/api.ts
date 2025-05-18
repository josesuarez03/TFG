import axios from 'axios';
import { LoginResponse } from '@/types/auth';
import { UserProfile, RegisterData, ProfileUpdateData } from '@/types/user';

// Define la URL base de la API
const API_URL = 'http://localhost:8000/';

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
        const response = await axios.post(`${API_URL}token/refresh/`, { 
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
export const login = async (username_or_email: string, password: string): Promise<LoginResponse> => {
  try {
    // Determine if the input is an email or username
    const isEmail = username_or_email.includes('@');
    
    // Send the appropriate field based on input type
    const credentials = isEmail 
      ? { email: username_or_email, password } 
      : { username: username_or_email, password };
    
    const response = await API.post('login/', credentials);
    return response.data;
  } catch (error) {
    console.error('Error en la función de inicio de sesión:', error);
    throw error;
  }
};

export const loginWithGoogle = async (token: string, profile_type:string): Promise<LoginResponse> => {
  try {
    const response = await API.post('google/login/', { token, profile_type:profile_type });
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

// Función mejorada para obtener el perfil del usuario con mejor manejo de errores
export const getUserProfile = async (): Promise<UserProfile> => {
  try {
    // Verificamos primero si tenemos un token
    const token = sessionStorage.getItem('access_token');
    if (!token) {
      throw new Error('No hay token de acceso disponible');
    }
    
    console.log('Obteniendo perfil de usuario con token:', token ? 'presente' : 'ausente');
    
    // Hacemos la solicitud explícitamente con el token en los headers
    const response = await API.get('profile/', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('Perfil de usuario obtenido:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error al obtener el perfil del usuario:', error);
    
    // Manejo específico según el tipo de error
    if (axios.isAxiosError(error) && error.response) {
      if (error.response.status === 401) {
        console.error('Error de autenticación al obtener perfil: Token inválido o expirado');
      } else if (error.response.status === 404) {
        console.error('Perfil no encontrado en el servidor');
      } else {
        console.error(`Error del servidor: ${error.response.status}`);
      }
    }
    
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

// Función para completar el perfil del usuario
export const completeProfile = async (data: unknown): Promise<UserProfile> => {
  try {
    console.log('Enviando datos para completar perfil:', data);
    const response = await API.post('complete/', data);
    console.log('Respuesta al completar perfil:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error al completar el perfil:', error);
    throw error;
  }
};

// FIXED: Enviar el refresh token al cerrar sesión
export const logout = async (): Promise<void> => {
  try {
    // Obtener el refresh token
    const refreshToken = sessionStorage.getItem('refresh_token');
    
    if (refreshToken) {
      // Enviar el refresh token al backend
      await API.post('logout/', { refresh: refreshToken });
    } else {
      // Si no hay refresh token, intentar cerrar sesión sin él
      await API.post('logout/');
    }
    
    // Limpiar el almacenamiento local independientemente del resultado
    sessionStorage.removeItem('access_token');
    sessionStorage.removeItem('refresh_token');
  } catch (error) {
    console.error('Error al cerrar sesión:', error);
    // Limpiar tokens incluso si hay error
    sessionStorage.removeItem('access_token');
    sessionStorage.removeItem('refresh_token');
    throw error;
  }
};

// FIXED: Asegurar que se envía el password correctamente en la solicitud DELETE
export const deleteUser = async (password: string): Promise<void> => {
  try {
    // Intentar primero con el cuerpo de la solicitud
    await API.delete('account/delete/', {
      data: { password }
    });
    
    // Limpiar tokens después de eliminar la cuenta
    sessionStorage.removeItem('access_token');
    sessionStorage.removeItem('refresh_token');
  } catch (error) {
    console.error('Error al eliminar el usuario:', error);
    
    // Imprimir más detalles sobre el error
    if (axios.isAxiosError(error) && error.response) {
      console.error('Detalles del error:', error.response.data);
    }
    
    throw error;
  }
};

export const changePassword = async (data: { old_password: string; new_password: string; confirm_password: string; }): Promise<void> => {
  try {
    const response = await API.post('password/change/', data);
    if (response.status !== 200) {
      throw new Error('Error al cambiar la contraseña');
    }
  } catch (error) {
    console.error('Error al cambiar la contraseña:', error);
    throw error;
  }
}

export default API;