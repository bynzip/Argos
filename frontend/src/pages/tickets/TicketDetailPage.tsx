import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useTicket, useTicketTransition, useUpdateTicketAmounts } from '../../hooks/useTickets';
import { useAuthStore } from '../../store/authStore';
import { TicketStatusBadge } from '../../components/ui/TicketStatusBadge';
import { PriorityBadge } from '../../components/ui/PriorityBadge';
import { PaymentModal } from '../../components/finance/PaymentModal';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { ArrowLeft, CreditCard, Clock, User as UserIcon, Laptop, ClipboardList, Camera, History, Edit2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Input } from '../../components/ui/Input';
import { Label } from '../../components/ui/Label';

const VALID_TRANSITIONS: Record<string, string[]> = {
  'INTAKE': ['DIAGNOSTIC'],
  'DIAGNOSTIC': ['QUOTED', 'IN_REPAIR'],
  'QUOTED': ['APPROVED', 'REJECTED'],
  'APPROVED': ['WAITING_PARTS', 'IN_REPAIR'],
  'WAITING_PARTS': ['IN_REPAIR'],
  'IN_REPAIR': ['IN_TESTING', 'DIAGNOSTIC'],
  'IN_TESTING': ['READY'],
  'READY': ['DELIVERED', 'STORAGE'],
  'STORAGE': ['DELIVERED'],
  'DELIVERED': ['CLOSED'],
  'REJECTED': ['DELIVERED'],
};

const statusLabels: Record<string, string> = {
  'INTAKE': 'Ingreso',
  'DIAGNOSTIC': 'Diagnóstico',
  'QUOTED': 'Cotizado',
  'APPROVED': 'Aprobado',
  'WAITING_PARTS': 'En espera repuesto',
  'IN_REPAIR': 'En reparación',
  'IN_TESTING': 'En pruebas',
  'READY': 'Listo',
  'DELIVERED': 'Entregado',
  'CLOSED': 'Cerrado',
  'REJECTED': 'Rechazado',
  'STORAGE': 'Cochera',
};

const TicketDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: ticket, isLoading, refetch } = useTicket(id || '');
  const transitionMutation = useTicketTransition();
  const updateAmountsMutation = useUpdateTicketAmounts();
  const { user } = useAuthStore();
  const [motivo, setMotivo] = useState('');
  const [showMotivoInput, setShowMotivoInput] = useState<string | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  
  // States for updating amounts
  const [showAmountsModal, setShowAmountsModal] = useState(false);
  const [montoEstimadoInput, setMontoEstimadoInput] = useState('');
  const [totalInput, setTotalInput] = useState('');

  // Poll for real-time balance updates
  useEffect(() => {
    const interval = setInterval(() => refetch(), 15000);
    return () => clearInterval(interval);
  }, [refetch]);

  if (isLoading) return <div className="p-12 text-center">Cargando ticket...</div>;
  if (!ticket) return <div className="p-12 text-center">Ticket no encontrado</div>;

  const allowedNextStatuses = VALID_TRANSITIONS[ticket.estado] || [];
  
  const isRecep = user?.role === 'Recepcionista' || user?.is_superuser;
  const isTech = user?.role === 'Técnico' || user?.is_superuser;
  const isAdmin = user?.is_superuser || user?.role === 'Administrador';
  
  const canTransition = (nextStatus: string) => {
    if (nextStatus === 'DELIVERED' || nextStatus === 'CLOSED') return isRecep;
    if (nextStatus === 'DIAGNOSTIC' && ticket.estado === 'INTAKE') return isRecep || isTech; 
    return isTech;
  };

  const handleTransition = (newStatus: string) => {
    if (newStatus === 'REJECTED' && !motivo && showMotivoInput !== newStatus) {
      setShowMotivoInput(newStatus);
      return;
    }
    
    transitionMutation.mutate({ id: ticket.id, newStatus, motivo }, {
      onSuccess: () => {
        setShowMotivoInput(null);
        setMotivo('');
      },
      onError: (error: any) => {
        alert(error.response?.data?.detail || "Error al transicionar");
      }
    });
  };

  const openAmountsModal = () => {
    setMontoEstimadoInput(ticket.monto_estimado || '');
    setTotalInput(ticket.total || '0.00');
    setShowAmountsModal(true);
  };

  const handleUpdateAmounts = () => {
    updateAmountsMutation.mutate({
      id: ticket.id,
      monto_estimado: montoEstimadoInput || undefined,
      total: totalInput || undefined,
      motivo: 'Actualización manual de montos'
    }, {
      onSuccess: () => {
        setShowAmountsModal(false);
      }
    });
  };

  // Derive balance
  const pagosConfirmados = ticket.receipts ? 
    ticket.receipts.filter((r: any) => r.estado === 'CONFIRMED').reduce((acc: number, curr: any) => acc + parseFloat(curr.amount), 0) : 0;
  
  const total = parseFloat(ticket.total);
  const saldoPendiente = total - pagosConfirmados;

  return (
    <div className="p-8 max-w-[1400px] mx-auto">
      {/* Back Button & Header */}
      <div className="mb-6">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => navigate('/tickets')}
          className="mb-4 text-[var(--gray-500)]"
        >
          <ArrowLeft size={16} className="mr-2" />
          Volver a la lista
        </Button>
        <PageHeader 
          title={ticket.folio}
          subtitle={`Creado el ${new Date(ticket.created_at).toLocaleString()} por ${ticket.created_by?.nombre || '-'}`}
          actions={
            <div className="flex flex-wrap gap-2 items-center">
              <TicketStatusBadge status={ticket.estado} />
              <PriorityBadge priority={ticket.prioridad} />
              
              <div className="h-6 w-px bg-[var(--gray-200)] mx-2"></div>
              
              {isRecep && saldoPendiente > 0 && !['DELIVERED', 'CLOSED'].includes(ticket.estado) && (
                <Button variant="primary" onClick={() => setShowPaymentModal(true)}>
                  <CreditCard size={18} className="mr-2" />
                  Registrar Cobro
                </Button>
              )}
              
              {allowedNextStatuses.map(status => {
                if (!canTransition(status)) return null;
                if (status === 'DELIVERED' && saldoPendiente > 0) return null;
                
                if (showMotivoInput === status) {
                  return (
                    <div key={status} className="flex gap-2 items-center bg-[var(--gray-50)] p-1 rounded-lg border border-[var(--gray-200)]">
                      <Input 
                        value={motivo} 
                        onChange={e => setMotivo(e.target.value)} 
                        placeholder="Motivo..."
                        className="h-8 text-xs w-32"
                      />
                      <Button size="sm" onClick={() => handleTransition(status)}>OK</Button>
                      <Button size="sm" variant="ghost" onClick={() => setShowMotivoInput(null)}>X</Button>
                    </div>
                  );
                }
                
                return (
                  <Button
                    key={status}
                    variant="secondary"
                    size="sm"
                    onClick={() => handleTransition(status)}
                    disabled={transitionMutation.isPending}
                  >
                    Mover a {statusLabels[status]}
                  </Button>
                );
              })}
            </div>
          }
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Main Column */}
        <div className="lg:col-span-8 space-y-8">
          
          <Card>
            <CardHeader className="flex flex-row items-center gap-2">
              <ClipboardList className="h-5 w-5 text-[var(--gray-400)]" />
              <CardTitle>Descripción del Problema</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <p className="text-[var(--gray-700)] text-[15px] leading-relaxed whitespace-pre-wrap">
                {ticket.descripcion_problema}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center gap-2">
              <History className="h-5 w-5 text-[var(--gray-400)]" />
              <CardTitle>Diagnóstico y Solución</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="p-4 bg-[var(--gray-50)] rounded-xl border border-[var(--gray-100)]">
                <h3 className="text-xs font-bold text-[var(--gray-400)] uppercase tracking-wider mb-2">Diagnóstico Técnico</h3>
                <p className="text-[var(--gray-800)] font-medium">
                  {ticket.diagnostico || <span className="italic text-[var(--gray-400)]">Pendiente de diagnóstico</span>}
                </p>
              </div>
              <div className="p-4 bg-[var(--gray-50)] rounded-xl border border-[var(--gray-100)]">
                <h3 className="text-xs font-bold text-[var(--gray-400)] uppercase tracking-wider mb-2">Solución Aplicada</h3>
                <p className="text-[var(--gray-800)] font-medium">
                  {ticket.solucion || <span className="italic text-[var(--gray-400)]">Pendiente de reparación</span>}
                </p>
              </div>
            </CardContent>
          </Card>

          {ticket.evidences && ticket.evidences.length > 0 && (
            <Card>
              <CardHeader className="flex flex-row items-center gap-2">
                <Camera className="h-5 w-5 text-[var(--gray-400)]" />
                <CardTitle>Evidencias Fotográficas</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {ticket.evidences.map((ev: any) => (
                    <a 
                      key={ev.id} 
                      href={ev.archivo} 
                      target="_blank" 
                      rel="noreferrer" 
                      className="group relative block aspect-square border border-[var(--gray-200)] rounded-xl overflow-hidden hover:border-[var(--color-brand-blue)] transition-all"
                    >
                      <img src={ev.archivo} alt={ev.nombre_archivo} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="text-white text-[10px] font-bold uppercase tracking-wider">Ver imagen</span>
                      </div>
                    </a>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {ticket.receipts && ticket.receipts.length > 0 && (
            <Card>
              <CardHeader className="flex flex-row items-center gap-2">
                <CreditCard className="h-5 w-5 text-[var(--gray-400)]" />
                <CardTitle>Pagos y Recibos</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead className="bg-[var(--gray-50)] text-[11px] font-bold text-[var(--gray-400)] uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-3 text-left">Fecha</th>
                      <th className="px-6 py-3 text-left">Método</th>
                      <th className="px-6 py-3 text-right">Monto</th>
                      <th className="px-6 py-3 text-center">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--gray-100)]">
                    {ticket.receipts.map((r: any) => (
                      <tr key={r.id}>
                        <td className="px-6 py-3">{new Date(r.created_at).toLocaleDateString()}</td>
                        <td className="px-6 py-3 font-medium">{r.method_display || r.method}</td>
                        <td className="px-6 py-3 text-right font-bold text-[var(--gray-800)]">S/ {parseFloat(r.amount).toFixed(2)}</td>
                        <td className="px-6 py-3 text-center">
                          <span className={cn(
                            "inline-block w-2 h-2 rounded-full mr-2",
                            r.estado === 'CONFIRMED' ? "bg-[var(--color-success)]" : "bg-[var(--color-warning)]"
                          )} />
                          <span className="text-[12px] font-medium text-[var(--gray-600)]">{r.estado}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar Column (Sticky) */}
        <div className="lg:col-span-4 space-y-8 sticky top-24">
          
          {/* Balance Card */}
          <div className="bg-white border border-[var(--gray-200)] rounded-2xl p-6 shadow-[var(--shadow-md)] relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--color-brand-blue)] opacity-[0.03] rounded-bl-full -mr-10 -mt-10"></div>
            
            <div className="flex justify-between items-start mb-6">
              <h3 className="text-[13px] font-bold text-[var(--gray-500)] uppercase tracking-wider">Estado de Cuenta</h3>
              {(isAdmin || isTech) && !['DELIVERED', 'CLOSED'].includes(ticket.estado) && (
                <Button variant="ghost" size="sm" className="h-7 text-[11px] font-bold" onClick={openAmountsModal}>
                  <Edit2 size={12} className="mr-1" /> EDITAR
                </Button>
              )}
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center text-sm">
                <span className="text-[var(--gray-500)] font-medium">Total Presupuestado</span>
                <span className="text-[var(--gray-800)] font-bold">S/ {total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-[var(--gray-500)] font-medium">Total Pagado</span>
                <span className="text-[var(--color-success)] font-bold">S/ {pagosConfirmados.toFixed(2)}</span>
              </div>
              <div className="pt-4 border-t border-[var(--gray-100)] flex justify-between items-center">
                <span className="text-[var(--gray-800)] font-extrabold text-[15px]">Saldo Pendiente</span>
                <span className={cn(
                  "text-[24px] font-black",
                  saldoPendiente > 0 ? "text-[var(--color-danger)]" : "text-[var(--color-success)]"
                )}>
                  S/ {saldoPendiente.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Customer & Device Info */}
          <Card>
            <CardHeader className="py-4">
              <CardTitle className="text-[13px] text-[var(--gray-400)] uppercase tracking-wider">Información del Cliente</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[var(--gray-50)] flex items-center justify-center text-[var(--color-brand-blue)] border border-[var(--gray-200)]">
                  <UserIcon size={20} />
                </div>
                <div className="flex flex-col min-w-0">
                  <Link to={`/customers/${ticket.customer?.id}`} className="text-[14px] font-bold text-[var(--gray-800)] hover:text-[var(--color-brand-blue)] truncate">
                    {ticket.customer?.nombre}
                  </Link>
                  <span className="text-[12px] text-[var(--gray-400)] font-medium">ID: {ticket.customer?.identificador}</span>
                </div>
              </div>
              
              <div className="pt-4 border-t border-[var(--gray-100)]">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[var(--gray-50)] flex items-center justify-center text-[var(--gray-400)] border border-[var(--gray-200)] shrink-0">
                    <Laptop size={20} />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[12px] font-bold text-[var(--gray-400)] uppercase">Equipo</span>
                    <span className="text-[14px] font-bold text-[var(--gray-800)] leading-tight">
                      {ticket.device ? `${ticket.device.marca} ${ticket.device.modelo}` : 'No registrado'}
                    </span>
                    {ticket.device?.numero_serie && (
                      <span className="text-[11px] text-[var(--gray-500)] mt-1 font-mono bg-[var(--gray-50)] px-1.5 py-0.5 rounded border border-[var(--gray-100)] w-fit">
                        S/N: {ticket.device.numero_serie}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {ticket.accessories && ticket.accessories.length > 0 && (
                <div className="pt-4 border-t border-[var(--gray-100)]">
                  <span className="text-[12px] font-bold text-[var(--gray-400)] uppercase block mb-2">Accesorios</span>
                  <div className="flex flex-wrap gap-1.5">
                    {ticket.accessories.map((acc: any) => (
                      <span key={acc.id} className="inline-flex items-center px-2 py-0.5 rounded-md bg-[var(--gray-50)] border border-[var(--gray-200)] text-[11px] font-medium text-[var(--gray-600)]">
                        {acc.nombre}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Redesigned Timeline */}
          <Card>
            <CardHeader className="py-4 flex flex-row items-center justify-between">
              <CardTitle className="text-[13px] text-[var(--gray-400)] uppercase tracking-wider">Historial / Timeline</CardTitle>
              <Clock size={16} className="text-[var(--gray-300)]" />
            </CardHeader>
            <CardContent className="pt-6 overflow-y-auto max-h-[400px] scrollbar-thin">
              <div className="space-y-0">
                {ticket.transitions?.slice().reverse().map((trans: any, index: number) => (
                  <div key={trans.id} className="flex gap-4 relative pb-6 group">
                    {/* Line */}
                    {index !== ticket.transitions.length - 1 && (
                      <div className="absolute left-[15px] top-[30px] bottom-0 w-[2px] bg-[var(--gray-100)]"></div>
                    )}
                    
                    {/* Dot */}
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 border-2",
                      index === 0 
                        ? "bg-[var(--color-info-bg)] border-[var(--color-brand-blue)] text-[var(--color-brand-blue)]" 
                        : "bg-white border-[var(--gray-200)] text-[var(--gray-300)]"
                    )}>
                      {index === 0 ? <Clock size={14} /> : <div className="w-1.5 h-1.5 rounded-full bg-current" />}
                    </div>

                    {/* Content */}
                    <div className="flex-1 pt-0.5">
                      <div className="flex justify-between items-start">
                        <span className={cn(
                          "text-[13px] font-bold",
                          index === 0 ? "text-[var(--gray-900)]" : "text-[var(--gray-600)]"
                        )}>
                          {statusLabels[trans.estado_nuevo] || trans.estado_nuevo}
                        </span>
                        <span className="text-[10px] text-[var(--gray-400)] font-medium">
                          {new Date(trans.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-[11px] text-[var(--gray-400)] mt-0.5 font-medium">
                        por {trans.cambiado_por?.nombre || 'Sistema'} — {new Date(trans.created_at).toLocaleDateString()}
                      </p>
                      {trans.motivo && (
                        <div className="mt-2 p-2 bg-[var(--gray-50)] rounded-lg border border-[var(--gray-100)] text-[11px] text-[var(--gray-600)] italic">
                          "{trans.motivo}"
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <PaymentModal 
          ticketId={ticket.id} 
          saldoPendiente={saldoPendiente} 
          onClose={() => {
            setShowPaymentModal(false);
            refetch();
          }} 
        />
      )}

      {/* Update Amounts Modal (Styled) */}
      {showAmountsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,22,35,0.45)] backdrop-blur-sm p-4">
          <Card className="w-full max-w-md shadow-[var(--shadow-modal)]">
            <CardHeader>
              <CardTitle>Actualizar Presupuesto</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="space-y-1.5">
                <Label>Monto Estimado (Opcional)</Label>
                <Input 
                  type="number" step="0.01"
                  value={montoEstimadoInput} onChange={e => setMontoEstimadoInput(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Total Final (S/)</Label>
                <Input 
                  type="number" step="0.01"
                  value={totalInput} onChange={e => setTotalInput(e.target.value)}
                  placeholder="0.00"
                />
                <p className="text-[11px] text-[var(--gray-400)] mt-1">Este es el monto total que el cliente debe pagar.</p>
              </div>
              <div className="mt-8 flex justify-end gap-3 pt-4 border-t border-[var(--gray-100)]">
                <Button variant="secondary" onClick={() => setShowAmountsModal(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleUpdateAmounts}
                  disabled={updateAmountsMutation.isPending}
                >
                  {updateAmountsMutation.isPending ? 'Guardando...' : 'Actualizar Montos'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default TicketDetailPage;
