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
  activo: boolean;
  total_stock: number;
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
