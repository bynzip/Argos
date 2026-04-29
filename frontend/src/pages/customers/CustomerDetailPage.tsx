import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useCustomer } from '../../hooks/useCustomers';
import { ArrowLeft, Edit, Smartphone, Plus, Ticket, User, MapPin, Mail, Phone, Info } from 'lucide-react';
import AddDeviceModal from '../../components/customers/AddDeviceModal';
import { TicketStatusBadge } from '../../components/ui/TicketStatusBadge';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { cn } from '../../lib/utils';

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const customerId = id ? parseInt(id, 10) : null;
  const [isAddDeviceOpen, setIsAddDeviceOpen] = useState(false);
  
  const { data: customer, isLoading, error } = useCustomer(customerId);

  if (isLoading) {
    return (
      <div className="flex justify-center p-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-brand-blue)] border-t-transparent"></div>
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="p-20 text-center text-[var(--color-danger)] font-bold">
        Error al cargar los datos del cliente.
      </div>
    );
  }

  const getLabelClass = (etiqueta: string) => {
    const classes: Record<string, string> = {
      'NUEVO': 'badge-nuevo',
      'REGULAR': 'badge-regular',
      'FRECUENTE': 'badge-frecuente',
      'VIP': 'badge-vip',
      'MOROSO': 'badge-moroso',
      'ESPECIAL': 'badge-especial',
    };
    return classes[etiqueta] || '';
  };

  return (
    <div className="p-8 max-w-[1400px] mx-auto">
      {/* Header & Navigation */}
      <div className="mb-6">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => navigate('/customers')}
          className="mb-4 text-[var(--gray-500)]"
        >
          <ArrowLeft size={16} className="mr-2" />
          Volver al directorio
        </Button>
        <PageHeader 
          title={customer.nombre}
          subtitle={`${customer.tipo_cliente === 'PERSONA' ? 'DNI' : 'RUC'}: ${customer.identificador}`}
          actions={
            <div className="flex gap-2">
              <Link to={`/customers/edit/${customer.id}`}>
                <Button variant="secondary">
                  <Edit size={16} className="mr-2" />
                  Editar Cliente
                </Button>
              </Link>
              <Link to={`/tickets/new?customer_id=${customer.id}`}>
                <Button variant="primary">
                  <Plus size={18} className="mr-2" />
                  Nuevo Ticket
                </Button>
              </Link>
            </div>
          }
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Stats and Info */}
        <div className="lg:col-span-4 space-y-8">
          
          {/* Contact Info Card */}
          <Card>
            <CardHeader className="py-4 border-b border-[var(--gray-100)]">
              <CardTitle className="text-[13px] text-[var(--gray-400)] uppercase tracking-wider flex items-center gap-2">
                <User size={14} /> Información de Contacto
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[var(--gray-50)] flex items-center justify-center text-[var(--gray-400)] shrink-0">
                    <Phone size={16} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[11px] font-bold text-[var(--gray-400)] uppercase tracking-wide">Teléfono</span>
                    <span className="text-[14px] font-bold text-[var(--gray-800)]">{customer.telefono || 'No registrado'}</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[var(--gray-50)] flex items-center justify-center text-[var(--gray-400)] shrink-0">
                    <Mail size={16} />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[11px] font-bold text-[var(--gray-400)] uppercase tracking-wide">Email</span>
                    <span className="text-[14px] font-bold text-[var(--gray-800)] truncate">{customer.correo_electronico || 'No registrado'}</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[var(--gray-50)] flex items-center justify-center text-[var(--gray-400)] shrink-0">
                    <MapPin size={16} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[11px] font-bold text-[var(--gray-400)] uppercase tracking-wide">Dirección</span>
                    <span className="text-[14px] font-bold text-[var(--gray-800)]">{customer.direccion || 'No registrada'}</span>
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-[var(--gray-100)]">
                <span className="text-[11px] font-bold text-[var(--gray-400)] uppercase tracking-wide block mb-3">Etiqueta de Cliente</span>
                <span className={cn("badge", getLabelClass(customer.etiqueta))}>
                  {customer.etiqueta}
                </span>
              </div>

              {customer.notas && (
                <div className="pt-6 border-t border-[var(--gray-100)]">
                  <span className="text-[11px] font-bold text-[var(--gray-400)] uppercase tracking-wide block mb-2">Notas Internas</span>
                  <div className="p-3 bg-[var(--gray-50)] rounded-xl border border-[var(--gray-100)] text-[13px] text-[var(--gray-600)] leading-relaxed italic">
                    "{customer.notas}"
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Devices Card */}
          <Card>
            <CardHeader className="py-4 border-b border-[var(--gray-100)] flex flex-row items-center justify-between">
              <CardTitle className="text-[13px] text-[var(--gray-400)] uppercase tracking-wider flex items-center gap-2">
                <Smartphone size={14} /> Equipos Registrados
              </CardTitle>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-[var(--color-brand-blue)]"
                onClick={() => setIsAddDeviceOpen(true)}
              >
                <Plus size={18} />
              </Button>
            </CardHeader>
            <CardContent className="pt-4">
              {customer.devices && customer.devices.length > 0 ? (
                <div className="space-y-3">
                  {customer.devices.map((device: any) => (
                    <div key={device.id} className="p-4 bg-[var(--gray-50)] rounded-xl border border-[var(--gray-100)] group hover:border-[var(--color-brand-blue)] transition-colors">
                      <div className="flex justify-between items-start">
                        <div className="flex flex-col">
                          <span className="text-[14px] font-bold text-[var(--gray-800)]">{device.marca} {device.modelo}</span>
                          <span className="text-[11px] font-medium text-[var(--gray-400)] uppercase tracking-tight">{device.tipo_equipo}</span>
                          <span className="text-[12px] text-[var(--gray-500)] mt-1 font-mono">S/N: {device.numero_serie || 'N/E'}</span>
                        </div>
                        <Link 
                          to={`/tickets?search=${device.numero_serie || device.modelo}`}
                          className="text-[var(--gray-300)] hover:text-[var(--color-brand-blue)] transition-colors"
                          title="Ver historial de tickets"
                        >
                          <Ticket size={18} />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center">
                  <Smartphone size={32} className="mx-auto text-[var(--gray-200)] mb-2" />
                  <p className="text-[13px] text-[var(--gray-400)] font-medium">No hay equipos registrados.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Ticket History */}
        <div className="lg:col-span-8">
          <Card className="overflow-hidden">
            <CardHeader className="py-4 bg-[var(--gray-50)] border-b border-[var(--gray-100)]">
              <CardTitle className="text-[14px] font-bold text-[var(--gray-800)] uppercase tracking-tight">Historial de Tickets de Reparación</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {customer.tickets && customer.tickets.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-[var(--gray-50)] text-[10px] font-bold text-[var(--gray-400)] uppercase tracking-wider border-b border-[var(--gray-100)]">
                      <tr>
                        <th className="px-6 py-3">Folio / Fecha</th>
                        <th className="px-6 py-3">Equipo / Problema</th>
                        <th className="px-6 py-3">Estado</th>
                        <th className="px-6 py-3 text-right">Total (S/)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--gray-100)]">
                      {customer.tickets.map((ticket: any) => (
                        <tr key={ticket.id} className="hover:bg-[var(--gray-50)] transition-colors">
                          <td className="px-6 py-4">
                            <Link to={`/tickets/${ticket.id}`} className="text-sm font-bold text-[var(--color-brand-blue)] hover:underline block">
                              {ticket.folio}
                            </Link>
                            <span className="text-[11px] text-[var(--gray-400)] font-medium">{new Date(ticket.created_at).toLocaleDateString()}</span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="text-sm font-bold text-[var(--gray-700)]">
                                {ticket.device ? `${ticket.device.marca} ${ticket.device.modelo}` : 'Sin equipo'}
                              </span>
                              <span className="text-[11px] text-[var(--gray-400)] truncate max-w-[200px]">{ticket.descripcion_problema}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <TicketStatusBadge status={ticket.estado} />
                          </td>
                          <td className="px-6 py-4 text-sm font-black text-[var(--gray-800)] text-right">
                            S/ {parseFloat(ticket.total).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-20 text-center">
                  <div className="w-16 h-16 bg-[var(--gray-50)] rounded-full flex items-center justify-center mx-auto mb-4">
                    <Info size={32} className="text-[var(--gray-200)]" />
                  </div>
                  <h3 className="text-[16px] font-bold text-[var(--gray-800)]">Sin tickets registrados</h3>
                  <p className="text-sm text-[var(--gray-400)] mt-1 max-w-[300px] mx-auto">
                    Este cliente aún no ha ingresado equipos para servicio técnico.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {isAddDeviceOpen && customerId && (
        <AddDeviceModal 
          customerId={customerId} 
          onClose={() => {
            setIsAddDeviceOpen(false);
            // Optional: refetch or state update
          }} 
        />
      )}
    </div>
  );
}
