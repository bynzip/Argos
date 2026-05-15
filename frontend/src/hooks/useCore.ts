import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from '../lib/axios';

export interface Notification {
  id: number;
  message: string;
  is_read: boolean;
  created_at: string;
}

export interface DashboardData {
  role: string;
  metrics: Record<string, any>;
  charts: Record<string, Record<string, number>>;
  recent_activity: any[];
}

export interface CompanyProfile {
  id: number;
  business_name: string;
  legal_name?: string;
  ruc: string;
  phone: string;
  email: string;
  address?: string;
  cochera_grace_days: number;
  cochera_daily_rate: string;
  credit_grace_days: number;
  credit_morosidad_limit: string;
}

export interface AuditLogEntry {
  id: number;
  action: string;
  module: string;
  model_name: string;
  object_id: string;
  object_repr: string;
  created_at: string;
  user?: { nombre?: string };
}

export const useDashboard = () => {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const response = await axios.get('/api/core/dashboard/');
      return response.data as DashboardData;
    },
    refetchInterval: 60000, // Refetch every 1 minute
  });
};

export const useNotifications = (no_leidas: boolean = false) => {
  return useQuery({
    queryKey: ['notificaciones', { no_leidas }],
    queryFn: async () => {
      const response = await axios.get('/api/core/notificaciones/', {
        params: { no_leidas: no_leidas ? 'true' : 'false' }
      });
      return (response.data.results ?? response.data) as Notification[];
    },
    refetchInterval: 30000, // Poll every 30 seconds
  });
};

export const useCompanyProfile = () => {
  return useQuery({
    queryKey: ['company-profile'],
    queryFn: async () => {
      const response = await axios.get('/api/core/company/current/');
      return response.data as CompanyProfile;
    },
  });
};

export const useUpdateCompanyProfile = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<CompanyProfile>) => {
      const response = await axios.patch('/api/core/company/1/', payload);
      return response.data as CompanyProfile;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-profile'] });
    }
  });
};

export const useAuditLogs = (params?: Record<string, any>) => {
  return useQuery({
    queryKey: ['audit-logs', params],
    queryFn: async () => {
      const response = await axios.get('/api/core/audit-logs/', { params });
      return (response.data.results ?? response.data) as AuditLogEntry[];
    }
  });
};

export const useMarkNotificationRead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const response = await axios.post(`/api/core/notificaciones/${id}/mark_read/`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificaciones'] });
    }
  });
};

export const useMarkAllNotificationsRead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const response = await axios.post('/api/core/notificaciones/mark_all_read/');
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificaciones'] });
    }
  });
};

