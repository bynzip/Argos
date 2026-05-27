import axios from 'axios';
import { useAuthStore } from '../store/authStore';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Importante para enviar cookies HttpOnly
});

// Request Interceptor
api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().accessToken;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    if (config.data instanceof FormData && config.headers) {
      delete config.headers['Content-Type'];
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // Si el error es 401 y no hemos reintentado ya esta petición
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        // Intentar obtener un nuevo token mediante la cookie
        const response = await axios.post(
          `${API_BASE_URL}/api/auth/refresh/`, 
          {}, 
          { withCredentials: true }
        );
        
        const newAccessToken = response.data.access;
        
        // Actualizar el token en el store
        const authStore = useAuthStore.getState();
        authStore.setAuth(authStore.user!, newAccessToken);
        
        // Reintentar la petición original con el nuevo token
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(originalRequest);
        
      } catch (refreshError) {
        // Si el refresh falla (ej: cookie expirada), desloguear al usuario
        useAuthStore.getState().clearAuth();
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);

export default api;
