import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import axios from '../lib/axios';

export interface Supplier {
  id: number;
  nombre: string;
  ruc: string;
  contacto: string;
  telefono: string;
  correo: string;
  direccion: string;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface PurchaseOrderItem {
  id: number;
  product: number;
  product_name: string;
  product_code: string;
  cantidad_pedida: string;
  cantidad_recibida: string;
  precio_unitario: string;
  serial_numbers?: string[] | null;
  created_at: string;
}

export interface PurchaseOrderStatusHistory {
  id: number;
  estado_anterior: string;
  estado_nuevo: string;
  cambiado_por?: number | null;
  cambiado_por_nombre?: string | null;
  motivo: string;
  created_at: string;
}

export interface PurchaseOrder {
  id: number;
  folio: string;
  supplier: number;
  supplier_name: string;
  destination_warehouse: number;
  destination_warehouse_name: string;
  estado: string;
  subtotal: string;
  notes: string;
  created_by?: number | null;
  sent_at?: string | null;
  received_at?: string | null;
  created_at: string;
  updated_at: string;
  items: PurchaseOrderItem[];
  status_history: PurchaseOrderStatusHistory[];
}

export interface PurchaseSuggestion {
  product_id: number;
  product_name: string;
  product_code: string;
  available: string;
  minimum: string;
  suggested_quantity: string;
}

export interface SupplierPayload {
  nombre: string;
  ruc: string;
  contacto?: string;
  telefono?: string;
  correo?: string;
  direccion?: string;
  activo?: boolean;
}

export interface PurchaseOrderItemPayload {
  id?: number;
  product: number;
  cantidad_pedida: string;
  precio_unitario: string;
}

export interface PurchaseOrderPayload {
  supplier: number;
  destination_warehouse: number;
  items: PurchaseOrderItemPayload[];
  notes?: string;
}

const invalidatePurchaseQueries = (queryClient: ReturnType<typeof useQueryClient>) => {
  queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
  queryClient.invalidateQueries({ queryKey: ['purchase-suggestions'] });
  queryClient.invalidateQueries({ queryKey: ['inventory', 'stock-items'] });
  queryClient.invalidateQueries({ queryKey: ['inventory', 'movements'] });
  queryClient.invalidateQueries({ queryKey: ['products'] });
};

export const useSuppliers = () => {
  return useQuery<Supplier[]>({
    queryKey: ['suppliers'],
    queryFn: async () => {
      const response = await axios.get('/api/suppliers/');
      return response.data.results ?? response.data;
    },
  });
};

export const useSupplier = (id: number | null) => {
  return useQuery<Supplier>({
    queryKey: ['suppliers', id],
    queryFn: async () => {
      if (!id) throw new Error('Supplier id required');
      const response = await axios.get(`/api/suppliers/${id}/`);
      return response.data as Supplier;
    },
    enabled: !!id,
  });
};

export const useCreateSupplier = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: SupplierPayload) => {
      const response = await axios.post('/api/suppliers/', payload);
      return response.data as Supplier;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
  });
};

export const useUpdateSupplier = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: SupplierPayload & { id: number }) => {
      const response = await axios.patch(`/api/suppliers/${id}/`, payload);
      return response.data as Supplier;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
  });
};

export const usePurchaseOrders = () => {
  return useQuery<PurchaseOrder[]>({
    queryKey: ['purchase-orders'],
    queryFn: async () => {
      const response = await axios.get('/api/suppliers/purchase-orders/');
      return response.data.results ?? response.data;
    },
  });
};

export const usePurchaseOrder = (id: number | null) => {
  return useQuery<PurchaseOrder>({
    queryKey: ['purchase-orders', id],
    queryFn: async () => {
      if (!id) throw new Error('Purchase order id required');
      const response = await axios.get(`/api/suppliers/purchase-orders/${id}/`);
      return response.data as PurchaseOrder;
    },
    enabled: !!id,
  });
};

export const usePurchaseSuggestions = () => {
  return useQuery<PurchaseSuggestion[]>({
    queryKey: ['purchase-suggestions'],
    queryFn: async () => {
      const response = await axios.get('/api/suppliers/purchase-orders/suggestions/');
      return response.data;
    },
  });
};

export const useCreatePurchaseOrder = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: PurchaseOrderPayload) => {
      const response = await axios.post('/api/suppliers/purchase-orders/', payload);
      return response.data as PurchaseOrder;
    },
    onSuccess: () => {
      invalidatePurchaseQueries(queryClient);
    },
  });
};

export const useUpdatePurchaseOrder = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: PurchaseOrderPayload & { id: number }) => {
      const response = await axios.patch(`/api/suppliers/purchase-orders/${id}/`, payload);
      return response.data as PurchaseOrder;
    },
    onSuccess: () => {
      invalidatePurchaseQueries(queryClient);
    },
  });
};

export const useSendPurchaseOrder = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, notes }: { id: number; notes?: string }) => {
      const response = await axios.post(`/api/suppliers/purchase-orders/${id}/send_order/`, { notes });
      return response.data as PurchaseOrder;
    },
    onSuccess: () => {
      invalidatePurchaseQueries(queryClient);
    },
  });
};

export const useReceivePurchaseOrder = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      items,
      notes,
      close_incomplete,
    }: {
      id: number;
      items: Array<{ id: number; cantidad_recibida: string; serial_numbers?: string[] }>;
      notes?: string;
      close_incomplete?: boolean;
    }) => {
      const response = await axios.post(`/api/suppliers/purchase-orders/${id}/receive_order/`, {
        items,
        notes,
        close_incomplete,
      });
      return response.data as PurchaseOrder;
    },
    onSuccess: () => {
      invalidatePurchaseQueries(queryClient);
    },
  });
};

export const useCancelPurchaseOrder = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, notes }: { id: number; notes?: string }) => {
      const response = await axios.post(`/api/suppliers/purchase-orders/${id}/cancel_order/`, { notes });
      return response.data as PurchaseOrder;
    },
    onSuccess: () => {
      invalidatePurchaseQueries(queryClient);
    },
  });
};
