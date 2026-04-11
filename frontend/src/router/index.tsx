import { createBrowserRouter, Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

import LoginPage from '../pages/auth/LoginPage';
import MainLayout from '../components/layout/MainLayout';
import UserListPage from '../pages/users/UserListPage';
import CustomerListPage from '../pages/customers/CustomerListPage';
import CustomerFormPage from '../pages/customers/CustomerFormPage';
import CustomerDetailPage from '../pages/customers/CustomerDetailPage';
import ProductListPage from '../pages/products/ProductListPage';
import ProductFormPage from '../pages/products/ProductFormPage';
import ProductDetailPage from '../pages/products/ProductDetailPage';

// Componente temporal para el Dashboard
const Dashboard = () => (
  <div>
    <h1 className="text-2xl font-bold text-gray-900">Dashboard Argos MVP</h1>
    <p className="mt-2 text-gray-600">Bienvenido al sistema.</p>
  </div>
);

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
        element: <Dashboard />,
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
      // Aquí se agregarán las rutas de tickets, etc. en futuros sprints
    ],
  },
]);
