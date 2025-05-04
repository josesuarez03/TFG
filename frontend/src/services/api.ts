import axios from 'axios';
import Router from 'next/router'; 

export const redirectToLogin = () => {
    Router.push('/auth/login'); 
};

const BASEURL = 'http://localhost/api/';

const API = axios.create({
    baseURL: BASEURL,
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json',
    },
});

API.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('access_token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

API.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        // Si el token ha expirado, intenta renovarlo
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;
            try {
                const refreshToken = localStorage.getItem('refresh_token');
                if (refreshToken) {
                    const response = await axios.post(
                        `${BASEURL}token/refresh-token/`,	
                        { refresh: refreshToken },
                        { headers: { 'Content-Type': 'application/json' } }
                    );
                    const { access } = response.data;

                    // Guarda el nuevo access_token
                    localStorage.setItem('access_token', access);

                    // Reintenta la solicitud original con el nuevo token
                    originalRequest.headers.Authorization = `Bearer ${access}`;
                    return API(originalRequest);
                }
            } catch {
                // Redirige al usuario al login si no se puede renovar el token
                localStorage.removeItem('access_token');
                localStorage.removeItem('refresh_token');
                redirectToLogin();
            }
        }

        // Manejo de otros errores genéricos
        if (error.response?.status && error.response.status !== 401) {
            console.error(`Error HTTP ${error.response.status}:`, error.response.data);
        }

        return Promise.reject(error);
    }
);

export default API;