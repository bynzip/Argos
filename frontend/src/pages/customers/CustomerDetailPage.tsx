import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCustomer } from '../../hooks/useCustomers';
import { ArrowLeft, Edit, Smartphone, AlertCircle, Plus } from 'lucide-react';
import AddDeviceModal from '../../components/customers/AddDeviceModal';

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const customerId = id ? parseInt(id, 10) : null;
  const [isAddDeviceOpen, setIsAddDeviceOpen] = useState(false);
  
  const { data: customer, isLoading, error } = useCustomer(customerId);

  if (isLoading) {
    return (
      <div className="flex justify-center p-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-blue border-t-transparent"></div>
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="p-8 text-center text-red-600 font-semibold">
        Error al cargar los datos del cliente.
      </div>
    );
  }

  const getLabelColor = (etiqueta: string) => {
    const colors: Record<string, string> = {
      NUEVO: 'bg-blue-100 text-blue-800 border-blue-200',
      REGULAR: 'bg-green-100 text-green-800 border-green-200',
      FRECUENTE: 'bg-purple-100 text-purple-800 border-purple-200',
      VIP: 'bg-amber-100 text-amber-800 border-amber-200',
      MOROSO: 'bg-red-100 text-red-800 border-red-200',
      ESPECIAL: 'bg-orange-100 text-orange-800 border-orange-200',
    };
    return colors[etiqueta] || 'bg-slate-100 text-slate-800 border-slate-200';
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/customers')}
            className="p-3 rounded-2xl hover:bg-slate-200 border border-transparent hover:border-slate-300 text-slate-500 transition-all bg-white shadow-sm"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">{customer.nombre}</h1>
            <p className="muted-copy mt-1 font-medium">
              {customer.tipo_cliente === 'PERSONA' ? 'DNI: ' : 'RUC: '} {customer.identificador}
            </p>
          </div>
        </div>
        <button className="secondary-button text-sm">
          <Edit size={16} />
          Editar Cliente
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Información Principal */}
        <div className="lg:col-span-1 space-y-6">
          <div className="surface-card p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Detalles de Contacto</h2>
            <dl className="space-y-4 text-sm">
              <div className="flex flex-col gap-1">
                <dt className="font-semibold text-slate-500">Teléfono</dt>
                <dd className="font-medium text-slate-900">{customer.telefono || '-'}</dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="font-semibold text-slate-500">Correo Electrónico</dt>
                <dd className="font-medium text-slate-900">{customer.correo_electronico || '-'}</dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="font-semibold text-slate-500">Dirección</dt>
                <dd className="font-medium text-slate-900">{customer.direccion || '-'}</dd>
              </div>
              <div className="flex flex-col gap-1 pt-2">
                <dt className="font-semibold text-slate-500 mb-2">Etiqueta actual</dt>
                <dd>
                  <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold border shadow-sm ${getLabelColor(customer.etiqueta)}`}>
                    {customer.etiqueta}
                  </span>
                </dd>
              </div>
              {customer.notas && (
                <div className="flex flex-col gap-1 pt-4 border-t border-slate-100">
                  <dt className="font-semibold text-slate-500 mb-1">Notas internas</dt>
                  <dd className="text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-xl">{customer.notas}</dd>
                </div>
              )}
            </dl>
          </div>
        </div>

        {/* Dispositivos e Historial */}
        <div className="lg:col-span-2 space-y-6">
          <div className="surface-panel overflow-hidden">
            <div className="border-b border-slate-100 px-6 py-5 flex justify-between items-center bg-slate-50/50">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <div className="soft-icon p-2 shrink-0">
                  <Smartphone size={18} className="text-orange-600" />
                </div>
                Equipos Registrados
              </h2>
              <button 
                onClick={() => setIsAddDeviceOpen(true)}
                className="primary-button text-xs px-4 py-2"
              >
                <Plus size={16} />
                Añadir Equipo
              </button>
            </div>
            
            <div className="p-0">
              {customer.devices && customer.devices.length > 0 ? (
                <ul className="divide-y divide-slate-100">
                  {customer.devices.map((device: any) => (
                    <li key={device.id} className="flex justify-between items-center gap-x-6 p-6 hover:bg-slate-50/50 transition-colors">
                      <div className="flex min-w-0 gap-x-4 items-center">
                        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white border border-slate-200 text-slate-400 shadow-sm shrink-0">
                          <Smartphone size={24} />
                        </div>
                        <div className="min-w-0 flex-auto">
                          <p className="text-base font-bold text-slate-900">
                            {device.tipo_equipo} {device.marca} {device.modelo}
                          </p>
                          <p className="mt-1 truncate text-sm font-medium text-slate-500">
                            N° Serie: {device.numero_serie || 'No especificado'}
                          </p>
                        </div>
                      </div>
                      <div className="hidden sm:flex sm:flex-col sm:items-end">
                        <button className="text-sm font-bold text-brand-blue hover:text-brand-orange transition-colors">
                          Ver historial
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-center py-12">
                  <AlertCircle className="mx-auto h-10 w-10 text-slate-300 mb-4" />
                  <p className="text-sm font-semibold text-slate-600">No hay dispositivos registrados.</p>
                  <p className="text-xs text-slate-400 mt-1">Registra un equipo para empezar a crear tickets.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {isAddDeviceOpen && customerId && (
        <AddDeviceModal 
          customerId={customerId} 
          onClose={() => setIsAddDeviceOpen(false)} 
        />
      )}
    </div>
  );
}
