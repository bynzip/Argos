import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from '../lib/axios';

export interface Ticket {
  id: string;
  folio: string;
  estado: string;
  prioridad: string;
  descripcion_problema: string;
  diagnostico: string | null;
  solucion: string | null;
  monto_estimado: string | null;
  monto_aprobado: string | null;
  total: string;
  created_at: string;
  customer?: any;
  device?: any;
  assigned_to?: any;
  accessories?: any[];
  evidences?: any[];
  transitions?: any[];
}

export const useTickets = (params?: Record<string, any>) => {
  return useQuery({
    queryKey: ['tickets', params],
    queryFn: async () => {
      const response = await axios.get('/tickets/', { params });
      return response.data;
    }
  });
};

export const useTicket = (id: string) => {
  return useQuery({
    queryKey: ['tickets', id],
    queryFn: async () => {
      const response = await axios.get(`/tickets/${id}/`);
      return response.data;
    },
    enabled: !!id,
  });
};

export const useCreateTicket = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: FormData) => {
      const response = await axios.post('/tickets/', data, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
  });
};

export const useTicketTransition = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, newStatus, motivo }: { id: string, newStatus: string, motivo?: string }) => {
      const response = await axios.post(`/tickets/${id}/transition/`, {
        new_status: newStatus,
        motivo: motivo || '',
      });
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      queryClient.invalidateQueries({ queryKey: ['tickets', variables.id] });
    },
  });
};
