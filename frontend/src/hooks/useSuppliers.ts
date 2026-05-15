import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from '../lib/axios';

export const useSuppliers = () => {
  return useQuery({
    queryKey: ['suppliers'],
    queryFn: async () => {
      const response = await axios.get('/api/suppliers/');
      return response.data.results ?? response.data;
    },
  });
};

export const useCreateSupplier = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Record<string, any>) => {
      const response = await axios.post('/api/suppliers/', payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
  });
};

export const usePurchaseOrders = () => {
  return useQuery({
    queryKey: ['purchase-orders'],
    queryFn: async () => {
      const response = await axios.get('/api/suppliers/purchase-orders/');
      return response.data.results ?? response.data;
    },
  });
};

export const usePurchaseSuggestions = () => {
  return useQuery({
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
    mutationFn: async (payload: Record<string, any>) => {
      const response = await axios.post('/api/suppliers/purchase-orders/', payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-suggestions'] });
    },
  });
};

export const useSendPurchaseOrder = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const response = await axios.post(`/api/suppliers/purchase-orders/${id}/send_order/`, {});
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
    },
  });
};
