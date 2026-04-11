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

export const useProducts = (params?: any) => {
  return useQuery<Product[]>({
    queryKey: ['products', params],
    queryFn: async () => {
      const response = await api.get('/api/products/', { params });
      return response.data;
    },
  });
};

export const useCategories = () => {
  return useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: async () => {
      const response = await api.get('/api/products/categories/');
      return response.data;
    },
  });
};

export const useBrands = () => {
  return useQuery<Brand[]>({
    queryKey: ['brands'],
    queryFn: async () => {
      const response = await api.get('/api/products/brands/');
      return response.data;
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
