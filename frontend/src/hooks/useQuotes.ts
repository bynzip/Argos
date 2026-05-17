import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import api from '../lib/axios';

export interface QuoteSummary {
  id: number;
  folio: string;
  version: number;
  estado: string;
  total: string;
  is_active_version: boolean;
}

export interface QuoteLine {
  id?: number;
  line_type: 'PRODUCT' | 'SERVICE';
  product?: number | null;
  product_name?: string;
  service?: number | null;
  service_name?: string;
  descripcion: string;
  cantidad: string;
  precio_unitario: string;
  descuento_linea: string;
  total_linea?: string;
  supply_status?: string;
  orden?: number;
}

export interface QuoteApproval {
  id: number;
  approval_type: string;
  required_level: string;
  estado: string;
  decidido_por?: { nombre: string } | null;
  decidido_el?: string | null;
  notas?: string | null;
  created_at: string;
}

export interface QuoteAttachment {
  id: number;
  archivo: string;
  nombre_archivo: string;
  tamano_archivo?: number | null;
  created_at: string;
}

export interface Quote {
  id: number;
  folio: string;
  version: number;
  estado: string;
  subtotal: string;
  descuento: string;
  igv_rate: string;
  igv_amount: string;
  total: string;
  valido_hasta: string | null;
  condiciones?: string | null;
  notas?: string | null;
  is_active_version: boolean;
  requires_amount_approval: boolean;
  latest_amount_approval_status?: string | null;
  customer: { id: number; nombre: string; identificador: string };
  device?: { id: number; marca: string; modelo: string; numero_serie?: string } | null;
  source_ticket?: { id: string; folio: string; estado: string } | null;
  lines: QuoteLine[];
  approvals: QuoteApproval[];
  attachments: QuoteAttachment[];
  version_history: Array<{
    id: number;
    version: number;
    estado: string;
    is_active_version: boolean;
    created_at: string;
  }>;
  created_at: string;
}

export interface ServiceCategory {
  id: number;
  nombre: string;
  activo: boolean;
}

export interface Service {
  id: number;
  codigo: string;
  category: number | null;
  category_name?: string;
  nombre: string;
  descripcion?: string;
  precio_base: string;
  horas_estimadas?: string | null;
  activo: boolean;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

type QuotePayload = {
  customer: number;
  device?: number | null;
  source_ticket?: string | null;
  descuento?: string;
  igv_rate?: string;
  valido_hasta?: string;
  condiciones?: string;
  notas?: string;
  lines: QuoteLine[];
  attachments?: File[];
};

const toFormData = (payload: QuotePayload) => {
  const formData = new FormData();
  formData.append('customer', String(payload.customer));
  if (payload.device) formData.append('device', String(payload.device));
  if (payload.source_ticket) formData.append('source_ticket', String(payload.source_ticket));
  if (payload.descuento !== undefined) formData.append('descuento', payload.descuento);
  if (payload.igv_rate !== undefined) formData.append('igv_rate', payload.igv_rate);
  if (payload.valido_hasta) formData.append('valido_hasta', payload.valido_hasta);
  formData.append('condiciones', payload.condiciones || '');
  formData.append('notas', payload.notas || '');
  formData.append('lines', JSON.stringify(payload.lines));

  (payload.attachments || []).forEach((file) => {
    formData.append('attachments', file);
  });

  return formData;
};

export const useQuotes = (params?: Record<string, any>) => {
  return useQuery<PaginatedResponse<Quote> | Quote[]>({
    queryKey: ['quotes', params],
    queryFn: async () => {
      const response = await api.get('/api/quotes/', { params });
      const data = response.data;
      if (data && typeof data === 'object' && Array.isArray(data.results)) {
        return data as PaginatedResponse<Quote>;
      }
      return (Array.isArray(data) ? data : []) as Quote[];
    },
  });
};

export const useQuote = (id: number | string | null) => {
  return useQuery<Quote>({
    queryKey: ['quotes', id],
    queryFn: async () => {
      if (!id) throw new Error('ID required');
      const response = await api.get(`/api/quotes/${id}/`);
      return response.data;
    },
    enabled: !!id,
  });
};

export const useCreateQuote = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: QuotePayload) => {
      const response = await api.post('/api/quotes/', toFormData(payload));
      return response.data as Quote;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
  });
};

export const useUpdateQuote = (id: number | string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<QuotePayload>) => {
      const response = await api.patch(`/api/quotes/${id}/`, toFormData({
        customer: payload.customer!,
        device: payload.device,
        source_ticket: payload.source_ticket,
        descuento: payload.descuento,
        igv_rate: payload.igv_rate,
        valido_hasta: payload.valido_hasta,
        condiciones: payload.condiciones,
        notas: payload.notas,
        lines: payload.lines || [],
        attachments: payload.attachments,
      }));
      return response.data as Quote;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['quotes', id] });
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
  });
};

const simpleQuoteAction = (pathSuffix: string) => {
  return (id: number | string, data?: any) => api.post(`/api/quotes/${id}/${pathSuffix}/`, data ?? {});
};

export const useSendQuote = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number | string) => (await simpleQuoteAction('send')(id)).data as Quote,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['quotes', id] });
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
  });
};

export const useApproveQuote = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number | string) => (await simpleQuoteAction('approve')(id)).data as Quote,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['quotes', id] });
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
  });
};

export const useRejectQuote = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, motivo }: { id: number | string; motivo: string }) =>
      (await simpleQuoteAction('reject')(id, { motivo })).data as Quote,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['quotes', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
  });
};

export const useCreateQuoteVersion = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number | string) => (await simpleQuoteAction('new_version')(id)).data as Quote,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
  });
};

export const useConvertQuoteToTicket = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number | string) =>
      (await simpleQuoteAction('convert_to_ticket')(id)).data as { ticket_id: string; ticket_folio: string },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
  });
};

export const useApproveAmountQuote = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, notas }: { id: number | string; notas?: string }) =>
      (await simpleQuoteAction('approve_amount')(id, { notas })).data,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['quotes', variables.id] });
    },
  });
};

export const useRejectAmountQuote = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, notas }: { id: number | string; notas?: string }) =>
      (await simpleQuoteAction('reject_amount')(id, { notas })).data,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['quotes', variables.id] });
    },
  });
};

export const downloadQuotePdf = async (id: number | string, folio?: string, version?: number) => {
  const response = await api.get(`/api/quotes/${id}/download-pdf/`, {
    responseType: 'blob',
  });

  const blob = new Blob([response.data], { type: 'application/pdf' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${folio || 'cotizacion'}${version ? `-v${version}` : ''}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

export const useServices = (params?: Record<string, any>) => {
  return useQuery<PaginatedResponse<Service> | Service[]>({
    queryKey: ['services', params],
    queryFn: async () => {
      const response = await api.get('/api/services/', { params });
      const data = response.data;
      if (data && typeof data === 'object' && Array.isArray(data.results)) {
        return data as PaginatedResponse<Service>;
      }
      return (Array.isArray(data) ? data : []) as Service[];
    },
  });
};

export const useServiceCategories = () => {
  return useQuery<ServiceCategory[]>({
    queryKey: ['service-categories'],
    queryFn: async () => {
      const response = await api.get('/api/services/categories/');
      return response.data.results ?? response.data;
    },
  });
};

export const useCreateServiceCategory = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<ServiceCategory>) => {
      const response = await api.post('/api/services/categories/', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-categories'] });
    },
  });
};

export const useCreateService = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Record<string, any>) => {
      const response = await api.post('/api/services/', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
    },
  });
};
