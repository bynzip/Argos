import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useCustomer } from '../../hooks/useCustomers';
import { ArrowLeft, Edit, Smartphone, AlertCircle, Plus, Ticket } from 'lucide-react';
import AddDeviceModal from '../../components/customers/AddDeviceModal';
import { TicketStatusBadge } from '../../components/ui/TicketStatusBadge';

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
    <div className="max-w-6xl mx-auto space-y-8 p-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/customers')}
            className="p-2 rounded-xl hover:bg-slate-200 border border-transparent hover:border-slate-300 text-slate-500 transition-all bg-white shadow-sm"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">{customer.nombre}</h1>
            <p className="text-slate-500 mt-1 text-sm font-medium">
              {customer.tipo_cliente === 'PERSONA' ? 'DNI: ' : 'RUC: '} {customer.identificador}
            </p>
          </div>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Link to={`/tickets/new?customer_id=${customer.id}`} className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 flex items-center justify-center flex-1 sm:flex-none">
            <Plus size={16} className="mr-2" /> Nuevo Ticket
          </Link>
          <Link 
            to={`/customers/edit/${customer.id}`}
            className="px-4 py-2 bg-white text-slate-700 border border-slate-300 rounded-md text-sm font-medium hover:bg-slate-50 flex items-center justify-center flex-1 sm:flex-none"
          >
            <Edit size={16} className="mr-2" /> Editar
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Información Principal */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-lg shadow border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4 border-b pb-2">Detalles de Contacto</h2>
            <dl className="space-y-4 text-sm">
              <div className="flex flex-col gap-1">
                <dt className="font-semibold text-slate-500">Teléfono</dt>
                <dd className="font-medium text-slate-900">{customer.telefono || '-'}</dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="font-semibold text-slate-500">Correo Electrónico</dt>
                <dd className="font-medium text-slate-900 break-all">{customer.correo_electronico || '-'}</dd>
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

          <div className="bg-white rounded-lg shadow border border-slate-200 p-6">
            <div className="flex justify-between items-center border-b pb-2 mb-4">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Smartphone size={18} className="text-orange-600" />
                Equipos
              </h2>
              <button 
                onClick={() => setIsAddDeviceOpen(true)}
                className="text-blue-600 hover:text-blue-800 p-1"
                title="Añadir Equipo"
              >
                <Plus size={18} />
              </button>
            </div>
            
            {customer.devices && customer.devices.length > 0 ? (
              <ul className="space-y-4">
                {customer.devices.map((device: any) => (
                  <li key={device.id} className="flex flex-col gap-1 p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <p className="text-sm font-bold text-slate-900">
                      {device.tipo_equipo} {device.marca} {device.modelo}
                    </p>
                    <p className="text-xs text-slate-500">
                      SN: {device.numero_serie || 'No especificado'}
                    </p>
                    <Link to={`/tickets?search=${device.numero_serie || device.modelo}`} className="text-xs font-semibold text-blue-600 hover:underline mt-1 inline-flex items-center">
                      <Ticket size={12} className="mr-1" /> Ver tickets de este equipo
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-center py-6">
                <p className="text-sm text-slate-500">No hay dispositivos registrados.</p>
              </div>
            )}
          </div>
        </div>

        {/* Historial de Tickets */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-lg shadow border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4 border-b pb-2">Historial de Tickets</h2>
            
            {customer.tickets && customer.tickets.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Folio / Fecha</th>
                      <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Equipo</th>
                      <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Estado</th>
                      <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase text-right">Total (S/)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {customer.tickets.map((ticket: any) => (
                      <tr key={ticket.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4">
                          <Link to={`/tickets/${ticket.id}`} className="text-sm font-bold text-blue-600 hover:underline block">
                            {ticket.folio}
                          </Link>
                          <span className="text-xs text-slate-500">{new Date(ticket.created_at).toLocaleDateString()}</span>
                        </td>
                        <td className="py-3 px-4 text-sm text-slate-700">
                          {ticket.device ? `${ticket.device.marca} ${ticket.device.modelo}` : 'Sin equipo'}
                        </td>
                        <td className="py-3 px-4">
                          <TicketStatusBadge status={ticket.estado} />
                        </td>
                        <td className="py-3 px-4 text-sm font-medium text-slate-900 text-right">
                          {parseFloat(ticket.total).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <AlertCircle className="mx-auto h-10 w-10 text-slate-300 mb-4" />
                <p className="text-sm font-semibold text-slate-600">No hay tickets registrados.</p>
                <p className="text-xs text-slate-400 mt-1">Este cliente aún no ha ingresado equipos a reparación.</p>
              </div>
            )}
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
