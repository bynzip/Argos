import { useDashboard } from '../../hooks/useCore';
import { useAuthStore } from '../../store/authStore';
import { Users, Ticket, Package, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';

const DashboardPage = () => {
  const { data, isLoading } = useDashboard();
  const { user } = useAuthStore();

  if (isLoading) return <div className="p-6">Cargando métricas...</div>;
  if (!data) return <div className="p-6">No hay datos disponibles</div>;

  const isAdmin = data.role === 'Administrador' || user?.is_superuser;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Hola, {user?.nombre}</h1>
        <p className="text-sm text-gray-500">Bienvenido al panel de control ({data.role})</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Vistas combinadas dependiendo de las metricas devueltas por el backend */}
        
        {data.metrics.active_tickets !== undefined && (
          <div className="bg-white p-6 rounded-lg shadow border-l-4 border-blue-500">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-blue-100 text-blue-600 mr-4">
                <Ticket className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Tickets Activos</p>
                <p className="text-2xl font-bold text-gray-900">{data.metrics.active_tickets}</p>
              </div>
            </div>
            {isAdmin && (
              <Link to="/tickets" className="mt-4 text-sm text-blue-600 hover:text-blue-800 block font-medium">Ver todos los tickets &rarr;</Link>
            )}
          </div>
        )}

        {data.metrics.customers_count !== undefined && (
          <div className="bg-white p-6 rounded-lg shadow border-l-4 border-indigo-500">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-indigo-100 text-indigo-600 mr-4">
                <Users className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Clientes Registrados</p>
                <p className="text-2xl font-bold text-gray-900">{data.metrics.customers_count}</p>
              </div>
            </div>
            <Link to="/customers" className="mt-4 text-sm text-indigo-600 hover:text-indigo-800 block font-medium">Gestionar clientes &rarr;</Link>
          </div>
        )}

        {data.metrics.products_count !== undefined && (
          <div className="bg-white p-6 rounded-lg shadow border-l-4 border-emerald-500">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-emerald-100 text-emerald-600 mr-4">
                <Package className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Productos en Catálogo</p>
                <p className="text-2xl font-bold text-gray-900">{data.metrics.products_count}</p>
              </div>
            </div>
            <Link to="/inventory" className="mt-4 text-sm text-emerald-600 hover:text-emerald-800 block font-medium">Ver inventario &rarr;</Link>
          </div>
        )}

        {data.metrics.low_stock_alerts !== undefined && (
          <div className="bg-amber-50 p-6 rounded-lg shadow border border-amber-200">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-amber-200 text-amber-700 mr-4">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-amber-800">Alertas de Stock Bajo</p>
                <p className="text-2xl font-bold text-amber-900">{data.metrics.low_stock_alerts}</p>
              </div>
            </div>
            <Link to="/inventory" className="mt-4 text-sm text-amber-700 hover:text-amber-900 block font-medium">Ver productos agotados &rarr;</Link>
          </div>
        )}

        {data.metrics.ready_tickets !== undefined && (
          <div className="bg-green-50 p-6 rounded-lg shadow border border-green-200">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-green-200 text-green-700 mr-4">
                <CheckCircle className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-green-800">Tickets Listos para Entregar</p>
                <p className="text-2xl font-bold text-green-900">{data.metrics.ready_tickets}</p>
              </div>
            </div>
            <Link to="/tickets" className="mt-4 text-sm text-green-700 hover:text-green-900 block font-medium">Ir a tickets &rarr;</Link>
          </div>
        )}

        {data.metrics.my_active_tickets !== undefined && (
          <div className="bg-blue-50 p-6 rounded-lg shadow border border-blue-200">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-blue-200 text-blue-700 mr-4">
                <Clock className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-blue-800">Mis Tickets Pendientes</p>
                <p className="text-2xl font-bold text-blue-900">{data.metrics.my_active_tickets}</p>
              </div>
            </div>
            <Link to="/tickets/queue" className="mt-4 text-sm text-blue-700 hover:text-blue-900 block font-medium">Ir a mi cola de trabajo &rarr;</Link>
          </div>
        )}

      </div>
    </div>
  );
};

export default DashboardPage;