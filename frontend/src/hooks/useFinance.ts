import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from '../lib/axios';

export interface CashClosure {
  id: string;
  user: any;
  estado: string;
  opening_amount: string;
  expected_amount: string | null;
  declared_amount: string | null;
  difference: string | null;
  opened_at: string;
  closed_at: string | null;
  closing_notes: string | null;
  total_dia?: number;
  ingresos_por_metodo?: { metodo_pago: string, total: number }[];
  receipts?: any[];
}

export const useCajaStatus = () => {
  return useQuery({
    queryKey: ['caja'],
    queryFn: async () => {
      try {
        const response = await axios.get('/api/finance/caja/');
        return response.data as CashClosure;
      } catch (error: any) {
        if (error.response && error.response.status === 404) {
          return null; // No caja is open
        }
        throw error;
      }
    },
    retry: false
  });
};

export const useAbrirCaja = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (openingAmount: number) => {
      const response = await axios.post('/api/finance/caja/abrir/', { opening_amount: openingAmount });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['caja'] });
    },
  });
};

export const useCerrarCaja = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ declaredAmount, notes }: { declaredAmount: number, notes?: string }) => {
      const response = await axios.post('/api/finance/caja/cerrar/', { declared_amount: declaredAmount, notes });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['caja'] });
    },
  });
};

export const useRegistrarPago = (ticketId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: FormData) => {
      const response = await axios.post(`/api/finance/tickets/${ticketId}/pagos/`, data, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets', ticketId] });
      queryClient.invalidateQueries({ queryKey: ['caja'] });
    },
  });
};
