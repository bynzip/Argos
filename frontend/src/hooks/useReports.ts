import { useQuery } from '@tanstack/react-query';
import axios from '../lib/axios';

export const useDailySummaryReport = () => {
  return useQuery({
    queryKey: ['reports', 'daily-summary'],
    queryFn: async () => {
      const response = await axios.get('/api/reports/daily-summary/');
      return response.data;
    },
  });
};

export const useInventoryReport = () => {
  return useQuery({
    queryKey: ['reports', 'inventory'],
    queryFn: async () => {
      const response = await axios.get('/api/reports/inventory/');
      return response.data;
    },
  });
};

export const usePurchaseReport = () => {
  return useQuery({
    queryKey: ['reports', 'purchases'],
    queryFn: async () => {
      const response = await axios.get('/api/reports/purchases/');
      return response.data;
    },
  });
};

export const useDelinquentCustomersReport = () => {
  return useQuery({
    queryKey: ['reports', 'delinquent-customers'],
    queryFn: async () => {
      const response = await axios.get('/api/reports/delinquent-customers/');
      return response.data;
    },
  });
};
