import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
  pending_total?: number;
  ingresos_por_metodo?: { metodo_pago: string; total: number }[];
  pendientes_por_metodo?: { metodo_pago: string; total: number }[];
  receipts?: any[];
}

export interface PaymentSchedule {
  id: number;
  numero_cuota: number;
  amount: string;
  monto_pagado: string;
  saldo_pendiente: string;
  due_date: string;
  esta_pagado: boolean;
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
          return null;
        }
        throw error;
      }
    },
    retry: false,
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
    mutationFn: async ({ declaredAmount, notes }: { declaredAmount: number; notes?: string }) => {
      const response = await axios.post('/api/finance/caja/cerrar/', { declared_amount: declaredAmount, notes });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['caja'] });
    },
  });
};

export const useRegistrarPago = (quoteId: number | string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: FormData) => {
      const response = await axios.post(`/api/finance/quotes/${quoteId}/pagos/`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes', quoteId] });
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      queryClient.invalidateQueries({ queryKey: ['caja'] });
    },
  });
};

export const useConfirmarPago = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ receiptId, schedule_items }: { receiptId: number; schedule_items?: Array<{ schedule_id: number; amount: string }> }) => {
      const response = await axios.post(`/api/finance/pagos/${receiptId}/confirm/`, schedule_items ? { schedule_items } : {});
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      queryClient.invalidateQueries({ queryKey: ['caja'] });
    },
  });
};

export const useQuoteSchedules = (quoteId?: number | string) => {
  return useQuery({
    queryKey: ['quote-schedules', quoteId],
    queryFn: async () => {
      const response = await axios.get(`/api/finance/quotes/${quoteId}/schedules/`);
      return response.data as PaymentSchedule[];
    },
    enabled: !!quoteId,
  });
};

export const useCreateQuoteSchedules = (quoteId: number | string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (installments: Array<{ amount: string; due_date: string }>) => {
      const response = await axios.post(`/api/finance/quotes/${quoteId}/schedules/`, { installments });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quote-schedules', quoteId] });
      queryClient.invalidateQueries({ queryKey: ['quotes', quoteId] });
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
  });
};

export const useReprogramSchedule = (quoteId: number | string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ scheduleId, new_date, motivo }: { scheduleId: number; new_date: string; motivo: string }) => {
      const response = await axios.post(`/api/finance/quotes/${quoteId}/schedules/${scheduleId}/reprogram/`, {
        new_date,
        motivo,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quote-schedules', quoteId] });
      queryClient.invalidateQueries({ queryKey: ['quotes', quoteId] });
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
  });
};

export const useDiscounts = (ticketId?: string) => {
  return useQuery({
    queryKey: ['discounts', ticketId],
    queryFn: async () => {
      const response = await axios.get('/api/finance/discounts/', {
        params: ticketId ? { ticket_id: ticketId } : undefined,
      });
      return response.data;
    },
  });
};

export const useCreateDiscountRequest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Record<string, any>) => {
      const response = await axios.post('/api/finance/discounts/', payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discounts'] });
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
  });
};

export const useDecideDiscount = (decision: 'approve' | 'reject') => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const response = await axios.post(`/api/finance/discounts/${id}/${decision}/`, {});
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discounts'] });
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
  });
};

export const useReversals = () => {
  return useQuery({
    queryKey: ['reversals'],
    queryFn: async () => {
      const response = await axios.get('/api/finance/reversals/');
      return response.data;
    },
  });
};

export const useCreateReversalRequest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Record<string, any>) => {
      const response = await axios.post('/api/finance/reversals/', payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reversals'] });
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
  });
};

export const useDecideReversal = (decision: 'approve' | 'reject') => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const response = await axios.post(`/api/finance/reversals/${id}/${decision}/`, {});
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reversals'] });
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
  });
};
