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
  active_quote?: {
    id: number;
    folio: string;
    version: number;
    estado: string;
    total: string;
    is_active_version: boolean;
  } | null;
  stock_reservations?: Array<{
    id: number;
    cantidad: string;
    estado: string;
    notas?: string;
    stock_item: {
      id: number;
      product_name: string;
      product_code: string;
      warehouse_name: string;
      cantidad: string;
      reservado: string;
      disponible: string;
    };
  }>;
  checklist_items?: Array<{
    id: number;
    nombre: string;
    requerido: boolean;
    completado: boolean;
    notas?: string;
  }>;
  subarea_movements?: Array<any>;
  warranty_children?: Array<{ id: string; folio: string; estado: string; created_at: string }>;
  parent_ticket_summary?: { id: string; folio: string; estado: string } | null;
  payment_schedules?: Array<any>;
  cochera_charges?: Array<any>;
  discounts?: Array<any>;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export const useTickets = (params?: Record<string, any>) => {
  return useQuery({
    queryKey: ['tickets', params],
    queryFn: async () => {
      const response = await axios.get('/api/tickets/', { params });
      const data = response.data;
      
      // Si la respuesta es paginada, devolvemos el objeto completo para que el componente maneje la paginación
      if (data && typeof data === 'object' && Array.isArray(data.results)) {
        return data as PaginatedResponse<Ticket>;
      }
      
      // Fallback para respuestas tipo lista simple
      return (Array.isArray(data) ? data : []) as Ticket[];
    }
  });
};

export const useTicket = (id: string) => {
  return useQuery({
    queryKey: ['tickets', id],
    queryFn: async () => {
      const response = await axios.get(`/api/tickets/${id}/`);
      return response.data;
    },
    enabled: !!id,
  });
};

export const useCreateTicket = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: FormData) => {
      const response = await axios.post('/api/tickets/', data, {
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
      const response = await axios.post(`/api/tickets/${id}/transition/`, {
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

export const useUpdateTicketAmounts = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, monto_estimado, total, motivo }: { id: string, monto_estimado?: string, total?: string, motivo?: string }) => {
      const response = await axios.patch(`/api/tickets/${id}/update_amounts/`, {
        monto_estimado,
        total,
        motivo,
      });
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      queryClient.invalidateQueries({ queryKey: ['tickets', variables.id] });
    },
  });
};

export const useUpdateTechnicalDetails = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, diagnostico, solucion }: { id: string; diagnostico?: string; solucion?: string }) => {
      const response = await axios.patch(`/api/tickets/${id}/update_technical_details/`, {
        diagnostico,
        solucion,
      });
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tickets', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
  });
};

export const useAddChecklistItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ ticketId, data }: { ticketId: string; data: FormData }) => {
      const response = await axios.post(`/api/tickets/${ticketId}/add_checklist_item/`, data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tickets', variables.ticketId] });
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
  });
};

export const useUpdateChecklistItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ ticketId, checklistId, data }: { ticketId: string; checklistId: number; data: FormData }) => {
      const response = await axios.patch(`/api/tickets/${ticketId}/checklist-items/${checklistId}/`, data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tickets', variables.ticketId] });
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
  });
};

export const useCreateWarrantyTicket = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ ticketId, descripcion_problema, prioridad }: { ticketId: string; descripcion_problema: string; prioridad?: string }) => {
      const response = await axios.post(`/api/tickets/${ticketId}/create_warranty/`, {
        descripcion_problema,
        prioridad,
      });
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tickets', variables.ticketId] });
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
  });
};
