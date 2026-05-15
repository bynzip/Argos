import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from '../lib/axios';

export const useAttendances = () => {
  return useQuery({
    queryKey: ['hr', 'attendances'],
    queryFn: async () => {
      const response = await axios.get('/api/hr/attendance/');
      return response.data.results ?? response.data;
    },
  });
};

export const useCorrections = () => {
  return useQuery({
    queryKey: ['hr', 'corrections'],
    queryFn: async () => {
      const response = await axios.get('/api/hr/corrections/');
      return response.data.results ?? response.data;
    },
  });
};

export const useMarkAttendance = (action: 'mark_entry' | 'start_break' | 'end_break' | 'mark_exit') => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const response = await axios.post(`/api/hr/attendance/${action}/`, {});
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'attendances'] });
    },
  });
};

export const useRequestCorrection = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Record<string, any>) => {
      const response = await axios.post(`/api/hr/attendance/${payload.attendance_id}/request_correction/`, payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'corrections'] });
      queryClient.invalidateQueries({ queryKey: ['hr', 'attendances'] });
    },
  });
};

export const useDecideCorrection = (decision: 'approve' | 'reject') => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const response = await axios.post(`/api/hr/corrections/${id}/${decision}/`, {});
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'corrections'] });
      queryClient.invalidateQueries({ queryKey: ['hr', 'attendances'] });
    },
  });
};
