import { createBrowserRouter, Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

import LoginPage from '../pages/auth/LoginPage';
import MainLayout from '../components/layout/MainLayout';
import UserListPage from '../pages/users/UserListPage';
import CustomerListPage from '../pages/customers/CustomerListPage';
import CustomerFormPage from '../pages/customers/CustomerFormPage';
import CustomerEditPage from '../pages/customers/CustomerEditPage';
import CustomerDetailPage from '../pages/customers/CustomerDetailPage';
import ProductListPage from '../pages/products/ProductListPage';
import ProductFormPage from '../pages/products/ProductFormPage';
import ProductDetailPage from '../pages/products/ProductDetailPage';
import TicketListPage from '../pages/tickets/TicketListPage';
import TicketFormPage from '../pages/tickets/TicketFormPage';
import TicketDetailPage from '../pages/tickets/TicketDetailPage';
import TechnicianQueuePage from '../pages/tickets/TechnicianQueuePage';
import CajaPage from '../pages/finance/CajaPage';
import DashboardPage from '../pages/dashboard/DashboardPage';

// Componente para proteger rutas
const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const { accessToken } = useAuthStore();
  
  if (!accessToken) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
};

// Componente para evitar que usuarios logueados vean el login
const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { accessToken } = useAuthStore();
  
  if (accessToken) {
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
};

export const router = createBrowserRouter([
  {
    path: '/login',
    element: (
      <PublicRoute>
        <LoginPage />
      </PublicRoute>
    ),
  },
  {
    path: '/',
    element: (
      <PrivateRoute>
        <MainLayout />
      </PrivateRoute>
    ),
    children: [
      {
        path: '',
        element: <DashboardPage />,
      },
      {
        path: 'users',
        element: <UserListPage />,
      },
      {
        path: 'customers',
        children: [
          { path: '', element: <CustomerListPage /> },
          { path: 'new', element: <CustomerFormPage /> },
          { path: 'edit/:id', element: <CustomerEditPage /> },
          { path: ':id', element: <CustomerDetailPage /> },
        ]
      },
      {
        path: 'inventory',
        children: [
          { path: '', element: <ProductListPage /> },
          { path: 'new', element: <ProductFormPage /> },
          { path: ':id', element: <ProductDetailPage /> },
        ]
      },
      {
        path: 'tickets',
        children: [
          { path: '', element: <TicketListPage /> },
          { path: 'new', element: <TicketFormPage /> },
          { path: 'queue', element: <TechnicianQueuePage /> },
          { path: ':id', element: <TicketDetailPage /> },
        ]
      },
      {
        path: 'finance',
        children: [
          { path: '', element: <CajaPage /> },
        ]
      },
    ],
  },
]);
