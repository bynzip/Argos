import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/axios';

export interface Category {
  id: number;
  nombre: string;
}

export interface Brand {
  id: number;
  nombre: string;
}

export interface ProductSupplier {
  id: number;
  product: number;
  product_name?: string;
  supplier: number | null;
  supplier_name?: string;
  supplier_price?: string | null;
  lead_time_days?: number | null;
  is_primary: boolean;
  created_at: string;
}

export interface Product {
  id: number;
  codigo: string;
  nombre: string;
  descripcion: string;
  category: number;
  category_name: string;
  brand: number;
  brand_name: string;
  precio_costo: string;
  precio_venta: string;
  stock_minimo: number;
  unidad: string;
  is_serializable: boolean;
  activo: boolean;
  total_stock: string;
  total_stock_fisico: string;
  total_stock_reservado: string;
  total_stock_disponible: string;
  stocks?: Array<{
    id: number;
    warehouse: number;
    warehouse_name: string;
    cantidad: string;
    reservado: string;
    disponible: string;
    costo_promedio: string;
    ubicacion_especifica?: string;
  }>;
  product_suppliers?: ProductSupplier[];
  created_at: string;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export const useProducts = (params?: any) => {
  return useQuery<PaginatedResponse<Product> | Product[]>({
    queryKey: ['products', params],
    queryFn: async () => {
      const response = await api.get('/api/products/', { params });
      const data = response.data;
      
      if (data && typeof data === 'object' && Array.isArray(data.results)) {
        return data as PaginatedResponse<Product>;
      }
      return (Array.isArray(data) ? data : []) as Product[];
    },
  });
};

export const useCategories = () => {
  return useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: async () => {
      const response = await api.get('/api/products/categories/');
      return response.data.results ?? response.data;
    },
  });
};

export const useBrands = () => {
  return useQuery<Brand[]>({
    queryKey: ['brands'],
    queryFn: async () => {
      const response = await api.get('/api/products/brands/');
      return response.data.results ?? response.data;
    },
  });
};

export const useCreateProduct = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const response = await api.post('/api/products/', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
};

export const useProduct = (id: number | string | null) => {
  return useQuery<Product>({
    queryKey: ['products', id],
    queryFn: async () => {
      if (!id) throw new Error('ID required');
      const response = await api.get(`/api/products/${id}/`);
      return response.data;
    },
    enabled: !!id,
  });
};

export const useUpdateProduct = (id: number | string) => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: Partial<Product>) => {
      const response = await api.patch(`/api/products/${id}/`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['products', id] });
    },
  });
};

export const useProductSuppliers = (params?: Record<string, any>) => {
  return useQuery<ProductSupplier[]>({
    queryKey: ['product-suppliers', params],
    queryFn: async () => {
      const response = await api.get('/api/products/product-suppliers/', { params });
      return response.data.results ?? response.data;
    },
  });
};

export const useCreateProductSupplier = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Omit<ProductSupplier, 'id' | 'created_at' | 'product_name' | 'supplier_name'>) => {
      const response = await api.post('/api/products/product-suppliers/', payload);
      return response.data as ProductSupplier;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['product-suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['products', variables.product] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
};

export const useUpdateProductSupplier = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<ProductSupplier> & { id: number }) => {
      const response = await api.patch(`/api/products/product-suppliers/${id}/`, payload);
      return response.data as ProductSupplier;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['product-suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['products', data.product] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
};

export const useDeleteProductSupplier = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, product }: { id: number; product: number }) => {
      await api.delete(`/api/products/product-suppliers/${id}/`);
      return { id, product };
    },
    onSuccess: ({ product }) => {
      queryClient.invalidateQueries({ queryKey: ['product-suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['products', product] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
};
