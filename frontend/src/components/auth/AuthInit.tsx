import React, { useEffect, useState } from 'react';
import api from '../../lib/axios';
import { useAuthStore } from '../../store/authStore';

export const AuthInit = ({ children }: { children: React.ReactNode }) => {
  const { setAuth, clearAuth, accessToken } = useAuthStore();
  const [loading, setLoading] = useState(!accessToken);

  useEffect(() => {
    const initAuth = async () => {
      if (accessToken) {
        setLoading(false);
        return;
      }
      try {
        const response = await api.post('/api/auth/refresh/');
        const newAccessToken = response.data.access;
        
        // Obtenemos info del usuario inyectando el token directamente
        const meResponse = await api.get('/api/auth/me/', {
          headers: {
            Authorization: `Bearer ${newAccessToken}`
          }
        });
        setAuth(meResponse.data, newAccessToken);
      } catch (error) {
        clearAuth();
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--surface-page)]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--color-brand-blue)] border-t-transparent"></div>
          <p className="text-sm font-medium text-[var(--gray-500)]">Cargando sesión...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
