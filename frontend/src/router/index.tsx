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
import ProductEditPage from '../pages/products/ProductEditPage';
import ProductDetailPage from '../pages/products/ProductDetailPage';
import InventoryReservationsPage from '../pages/products/InventoryReservationsPage';
import InventoryMovementsPage from '../pages/products/InventoryMovementsPage';
import WarehousesPage from '../pages/products/WarehousesPage';
import TicketListPage from '../pages/tickets/TicketListPage';
import TicketFormPage from '../pages/tickets/TicketFormPage';
import TicketDetailPage from '../pages/tickets/TicketDetailPage';
import TechnicianQueuePage from '../pages/tickets/TechnicianQueuePage';
import CajaPage from '../pages/finance/CajaPage';
import DashboardPage from '../pages/dashboard/DashboardPage';
import QuoteListPage from '../pages/quotes/QuoteListPage';
import QuoteEditorPage from '../pages/quotes/QuoteEditorPage';
import ServiceCatalogPage from '../pages/quotes/ServiceCatalogPage';
import SupplierListPage from '../pages/suppliers/SupplierListPage';
import SupplierFormPage from '../pages/suppliers/SupplierFormPage';
import PurchaseOrderListPage from '../pages/suppliers/PurchaseOrderListPage';
import PurchaseOrderFormPage from '../pages/suppliers/PurchaseOrderFormPage';
import PurchaseOrderDetailPage from '../pages/suppliers/PurchaseOrderDetailPage';
import AttendancePage from '../pages/hr/AttendancePage';
import ReportsPage from '../pages/reports/ReportsPage';
import CompanyProfilePage from '../pages/settings/CompanyProfilePage';

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
          { path: 'warehouses', element: <WarehousesPage /> },
          { path: 'reservations', element: <InventoryReservationsPage /> },
          { path: 'movements', element: <InventoryMovementsPage /> },
          { path: 'edit/:id', element: <ProductEditPage /> },
          { path: ':id', element: <ProductDetailPage /> },
        ]
      },
      {
        path: 'warehouses',
        element: <WarehousesPage />,
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
        path: 'quotes',
        children: [
          { path: '', element: <QuoteListPage /> },
          { path: 'new', element: <QuoteEditorPage /> },
          { path: 'services', element: <ServiceCatalogPage /> },
          { path: ':id', element: <QuoteEditorPage /> },
        ]
      },
      {
        path: 'finance',
        children: [
          { path: '', element: <CajaPage /> },
        ]
      },
      {
        path: 'suppliers',
        children: [
          { path: '', element: <SupplierListPage /> },
          { path: 'new', element: <SupplierFormPage /> },
          { path: 'edit/:id', element: <SupplierFormPage /> },
          { path: 'orders', element: <PurchaseOrderListPage /> },
          { path: 'orders/new', element: <PurchaseOrderFormPage /> },
          { path: 'orders/edit/:id', element: <PurchaseOrderFormPage /> },
          { path: 'orders/:id', element: <PurchaseOrderDetailPage /> },
        ]
      },
      {
        path: 'hr',
        children: [
          { path: '', element: <AttendancePage /> },
        ]
      },
      {
        path: 'reports',
        children: [
          { path: '', element: <ReportsPage /> },
        ]
      },
      {
        path: 'settings',
        children: [
          { path: '', element: <CompanyProfilePage /> },
        ]
      },
    ],
  },
]);
