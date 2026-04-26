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
  metrics: Record<string, number>;
  recent_activity: any[];
}

export const useDashboard = () => {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const response = await axios.get('/core/dashboard/');
      return response.data as DashboardData;
    },
    refetchInterval: 60000, // Refetch every 1 minute
  });
};

export const useNotifications = (no_leidas: boolean = false) => {
  return useQuery({
    queryKey: ['notificaciones', { no_leidas }],
    queryFn: async () => {
      const response = await axios.get('/core/notificaciones/', {
        params: { no_leidas: no_leidas ? 'true' : 'false' }
      });
      return response.data as Notification[];
    },
    refetchInterval: 30000, // Poll every 30 seconds
  });
};

export const useMarkNotificationRead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const response = await axios.post(`/core/notificaciones/${id}/mark_read/`);
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
      const response = await axios.post('/core/notificaciones/mark_all_read/');
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificaciones'] });
    }
  });
};

