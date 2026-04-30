import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/axios';

// Tipos
export interface Customer {
  id: number;
  tipo_cliente: 'PERSONA' | 'EMPRESA';
  identificador: string;
  nombre: string;
  telefono?: string;
  correo_electronico?: string;
  etiqueta: 'NUEVO' | 'REGULAR' | 'FRECUENTE' | 'VIP' | 'MOROSO' | 'ESPECIAL';
  is_active: boolean;
  devices?: any[];
}

export interface CustomerDetail extends Customer {
  direccion?: string;
  etiqueta_anterior?: string;
  veces_moroso: number;
  notas?: string;
  created_at: string;
  devices: any[]; // Se tipará después cuando hagamos los dispositivos
  tickets?: any[];
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

// Búsqueda y listado
export const useCustomers = (params?: { search?: string; etiqueta?: string; is_active?: boolean; page?: number }) => {
  return useQuery<PaginatedResponse<Customer> | Customer[]>({
    queryKey: ['customers', params],
    queryFn: async () => {
      const response = await api.get('/api/customers/', { params });
      const data = response.data;
      
      if (data && typeof data === 'object' && Array.isArray(data.results)) {
        return data as PaginatedResponse<Customer>;
      }
      return (Array.isArray(data) ? data : []) as Customer[];
    },
  });
};

// Detalle
export const useCustomer = (id: number | null) => {
  return useQuery<CustomerDetail>({
    queryKey: ['customers', id],
    queryFn: async () => {
      if (!id) throw new Error('ID required');
      const response = await api.get(`/api/customers/${id}/`);
      return response.data;
    },
    enabled: !!id,
  });
};

// Mutaciones
export const useCreateCustomer = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: Partial<CustomerDetail>) => {
      const response = await api.post('/api/customers/', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
};

export const useUpdateCustomer = (id: number) => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: Partial<CustomerDetail>) => {
      const response = await api.patch(`/api/customers/${id}/`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customers', id] });
    },
  });
};

export const useCreateDevice = (customerId: number) => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: { tipo_equipo: string; marca: string; modelo: string; numero_serie?: string; notas?: string }) => {
      const response = await api.post(`/api/customers/${customerId}/devices/`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers', customerId] });
    },
  });
};
