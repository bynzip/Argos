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
        
        // Hacemos set temporal del token para poder hacer la peticion /me
        useAuthStore.getState().setAuth({} as any, newAccessToken);
        
        const meResponse = await api.get('/api/auth/me/');
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
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
          <p className="text-sm font-medium text-slate-500">Cargando sesión...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
