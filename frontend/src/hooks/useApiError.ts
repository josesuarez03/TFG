import { useState } from 'react';
import axios, { AxiosError } from 'axios';

// Definir la estructura del error de la API
export interface ApiErrorData {
  detail?: string;
  [key: string]: unknown; // Para otros campos de error
}

export interface ApiError {
  message: string;
  statusCode?: number;
  data?: ApiErrorData;
}

export function useApiError() {
  const [error, setError] = useState<ApiError | null>(null);
  
  // Función para manejar errores de API
  const handleApiError = (err: unknown): ApiError => {
    let errorObj: ApiError;
    
    if (axios.isAxiosError(err)) {
      const axiosError = err as AxiosError<ApiErrorData>;
      errorObj = {
        message: axiosError.response?.data?.detail || 
                 axiosError.message || 
                 'Error en la solicitud',
        statusCode: axiosError.response?.status,
        data: axiosError.response?.data
      };
    } else if (err instanceof Error) {
      errorObj = {
        message: err.message,
      };
    } else {
      errorObj = {
        message: 'Error desconocido',
      };
    }
    
    setError(errorObj);
    return errorObj;
  };
  
  // Función para resetear error
  const clearError = () => setError(null);
  
  return {
    error,
    handleApiError,
    clearError,
    setError
  };
}