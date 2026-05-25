import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import api from '../lib/axios';

export interface Warehouse {
  id: number;
  nombre: string;
  ubicacion?: string;
  deleted_at?: string | null;
}

export interface StockItem {
  id: number;
  product: number;
  product_name: string;
  product_code: string;
  warehouse: number;
  warehouse_name: string;
  cantidad: string;
  reservado: string;
  disponible: string;
  costo_promedio: string;
  ubicacion_especifica?: string;
  created_at: string;
  updated_at: string;
}

export interface StockReservation {
  id: number;
  stock_item: StockItem;
  ticket: {
    id: string;
    folio: string;
    estado: string;
  };
  cantidad: string;
  estado: string;
  notas?: string;
  entregado_el?: string | null;
  entregado_por?: number | null;
  consumido_el?: string | null;
  liberado_el?: string | null;
  created_at: string;
  was_partial?: boolean;
  requested_quantity?: string;
  missing_quantity?: string;
  detail?: string;
}

export interface InventoryMovement {
  id: number;
  product: number;
  product_name: string;
  product_code: string;
  warehouse: number;
  warehouse_name: string;
  destination_warehouse?: number | null;
  destination_warehouse_name?: string | null;
  movement_type: string;
  quantity: string;
  unit_cost?: string | null;
  total_cost?: string | null;
  reference_type?: string;
  reference_id?: string;
  serial_numbers?: string[] | null;
  notes?: string;
  created_by_name?: string | null;
  created_at: string;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

const normalizePaginated = <T,>(data: any): PaginatedResponse<T> | T[] => {
  if (data && typeof data === 'object' && Array.isArray(data.results)) {
    return data as PaginatedResponse<T>;
  }
  return (Array.isArray(data) ? data : []) as T[];
};

export const useWarehouses = (params?: Record<string, any>) => {
  return useQuery<PaginatedResponse<Warehouse> | Warehouse[]>({
    queryKey: ['inventory', 'warehouses', params],
    queryFn: async () => {
      const response = await api.get('/api/products/warehouses/', { params });
      return normalizePaginated<Warehouse>(response.data);
    },
  });
};

export const useStockItems = (params?: Record<string, any>) => {
  return useQuery<PaginatedResponse<StockItem> | StockItem[]>({
    queryKey: ['inventory', 'stock-items', params],
    queryFn: async () => {
      const response = await api.get('/api/products/stock/', { params });
      return normalizePaginated<StockItem>(response.data);
    },
  });
};

export const useReservations = (params?: Record<string, any>) => {
  return useQuery<PaginatedResponse<StockReservation> | StockReservation[]>({
    queryKey: ['inventory', 'reservations', params],
    queryFn: async () => {
      const response = await api.get('/api/products/reservations/', { params });
      return normalizePaginated<StockReservation>(response.data);
    },
  });
};

export const useMovements = (params?: Record<string, any>) => {
  return useQuery<PaginatedResponse<InventoryMovement> | InventoryMovement[]>({
    queryKey: ['inventory', 'movements', params],
    queryFn: async () => {
      const response = await api.get('/api/products/movements/', { params });
      return normalizePaginated<InventoryMovement>(response.data);
    },
  });
};

export const useProductKardex = (productId: number | string | null) => {
  return useQuery<PaginatedResponse<InventoryMovement> | InventoryMovement[]>({
    queryKey: ['inventory', 'kardex', productId],
    queryFn: async () => {
      if (!productId) throw new Error('Product required');
      const response = await api.get(`/api/products/${productId}/kardex/`);
      return normalizePaginated<InventoryMovement>(response.data);
    },
    enabled: !!productId,
  });
};

export const useCreateReservation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { ticket_id: string; stock_item_id: number; cantidad: string; notas?: string }) => {
      const response = await api.post('/api/products/reservations/', payload);
      return response.data as StockReservation;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['inventory', 'reservations'] });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'stock-items'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['tickets', variables.ticket_id] });
    },
  });
};

export const useReleaseReservation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, notas }: { id: number; notas?: string }) => {
      const response = await api.post(`/api/products/reservations/${id}/release/`, { notas });
      return response.data as StockReservation;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['inventory', 'reservations'] });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'stock-items'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['tickets', data.ticket.id] });
    },
  });
};

export const useCreateWarehouse = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { nombre: string; ubicacion?: string }) => {
      const response = await api.post('/api/products/warehouses/', payload);
      return response.data as Warehouse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory', 'warehouses'] });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'stock-items'] });
    },
  });
};

export const useUpdateWarehouse = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: number; nombre?: string; ubicacion?: string }) => {
      const response = await api.patch(`/api/products/warehouses/${id}/`, payload);
      return response.data as Warehouse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory', 'warehouses'] });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'stock-items'] });
    },
  });
};

export const useDeleteWarehouse = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: number }) => {
      await api.delete(`/api/products/warehouses/${id}/`);
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory', 'warehouses'] });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'stock-items'] });
    },
  });
};

export const useRestoreWarehouse = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: number }) => {
      const response = await api.post(`/api/products/warehouses/${id}/restore/`);
      return response.data as Warehouse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory', 'warehouses'] });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'stock-items'] });
    },
  });
};

export const useHardDeleteWarehouse = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: number }) => {
      await api.post(`/api/products/warehouses/${id}/hard_delete/`);
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory', 'warehouses'] });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'stock-items'] });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'movements'] });
    },
  });
};

export const useDeliverReservation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, notas }: { id: number; notas?: string }) => {
      const response = await api.post(`/api/products/reservations/${id}/deliver/`, { notas });
      return response.data as StockReservation;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['inventory', 'reservations'] });
      queryClient.invalidateQueries({ queryKey: ['tickets', data.ticket.id] });
    },
  });
};

export const useConsumeReservation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, notas }: { id: number; notas?: string }) => {
      const response = await api.post(`/api/products/reservations/${id}/consume/`, { notas });
      return response.data as StockReservation;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['inventory', 'reservations'] });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'stock-items'] });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'movements'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['tickets', data.ticket.id] });
    },
  });
};

export const useAdjustStock = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { stock_item: number; movement_type: string; quantity: string; notes: string; unit_cost?: string }) => {
      const response = await api.post('/api/products/movements/adjust/', payload);
      return response.data as StockItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory', 'stock-items'] });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'movements'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
};

export const useTransferStock = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { source_stock_item: number; destination_warehouse: number; quantity: string; notes?: string }) => {
      const response = await api.post('/api/products/movements/transfer/', payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory', 'stock-items'] });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'movements'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
};
