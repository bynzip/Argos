import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { router } from './router';
import { AuthInit } from './components/auth/AuthInit';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthInit>
        <RouterProvider router={router} />
      </AuthInit>
    </QueryClientProvider>
  </React.StrictMode>
);
