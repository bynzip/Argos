import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTicket, useTicketTransition } from '../../hooks/useTickets';
import { useAuthStore } from '../../store/authStore';
import { TicketStatusBadge } from '../../components/ui/TicketStatusBadge';
import { PriorityBadge } from '../../components/ui/PriorityBadge';
import { PaymentModal } from '../../components/finance/PaymentModal';

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
  const { data: ticket, isLoading, refetch } = useTicket(id || '');
  const transitionMutation = useTicketTransition();
  const { user } = useAuthStore();
  const [motivo, setMotivo] = useState('');
  const [showMotivoInput, setShowMotivoInput] = useState<string | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // Poll for real-time balance updates if we are on this page
  useEffect(() => {
    const interval = setInterval(() => refetch(), 10000);
    return () => clearInterval(interval);
  }, [refetch]);

  if (isLoading) return <div className="p-6">Cargando ticket...</div>;
  if (!ticket) return <div className="p-6">Ticket no encontrado</div>;

  const allowedNextStatuses = VALID_TRANSITIONS[ticket.estado] || [];
  
  const isRecep = user?.role === 'Recepcionista' || user?.is_superuser;
  const isTech = user?.role === 'Técnico' || user?.is_superuser;
  
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

  // Derive balance
  // Since we haven't exposed `saldo_pendiente` as a top-level field in TicketDetailSerializer,
  // we compute it summing up receipts we got (we'd need to include it in the serializer or compute here).
  // Assuming total and payments logic:
  const pagosConfirmados = ticket.receipts ? 
    ticket.receipts.filter((r: any) => r.estado === 'CONFIRMED').reduce((acc: number, curr: any) => acc + parseFloat(curr.amount), 0) : 0;
  
  const total = parseFloat(ticket.total);
  const saldoPendiente = total - pagosConfirmados;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Cabecera */}
      <div className="bg-white shadow rounded-lg p-6 flex flex-col md:flex-row justify-between items-start md:items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            {ticket.folio}
            <TicketStatusBadge status={ticket.estado} />
            <PriorityBadge priority={ticket.prioridad} />
          </h1>
          <p className="text-sm text-gray-500 mt-1">Creado el {new Date(ticket.created_at).toLocaleString()} por {ticket.created_by?.nombre || '-'}</p>
        </div>
        
        {/* Acciones de Transición */}
        <div className="mt-4 md:mt-0 flex flex-wrap gap-2">
          {isRecep && saldoPendiente > 0 && !['DELIVERED', 'CLOSED'].includes(ticket.estado) && (
            <button
              onClick={() => setShowPaymentModal(true)}
              className="px-4 py-2 bg-amber-100 text-amber-800 border border-amber-300 rounded-md text-sm font-medium hover:bg-amber-200"
            >
              Registrar Cobro
            </button>
          )}
          
          {allowedNextStatuses.map(status => {
            if (!canTransition(status)) return null;
            
            // RN-01: No mostrar botón "Entregar" si hay saldo
            if (status === 'DELIVERED' && saldoPendiente > 0) return null;
            
            if (showMotivoInput === status) {
              return (
                <div key={status} className="flex gap-2 items-center">
                  <input 
                    type="text" 
                    value={motivo} 
                    onChange={e => setMotivo(e.target.value)} 
                    placeholder="Motivo..."
                    className="border rounded px-2 py-1 text-sm"
                  />
                  <button 
                    onClick={() => handleTransition(status)}
                    className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                  >
                    Confirmar
                  </button>
                  <button 
                    onClick={() => setShowMotivoInput(null)}
                    className="px-3 py-1 bg-gray-200 text-gray-800 rounded text-sm hover:bg-gray-300"
                  >
                    Cancelar
                  </button>
                </div>
              );
            }
            
            return (
              <button
                key={status}
                onClick={() => handleTransition(status)}
                disabled={transitionMutation.isPending}
                className="px-4 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-md text-sm font-medium hover:bg-blue-100"
              >
                Mover a {statusLabels[status]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna Principal */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium border-b pb-2 mb-4">Descripción del Problema</h2>
            <p className="text-gray-700 whitespace-pre-wrap">{ticket.descripcion_problema}</p>
          </div>

          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium border-b pb-2 mb-4">Diagnóstico y Solución</h2>
            <div className="space-y-4">
              <div>
                <h3 className="font-medium text-sm text-gray-500">Diagnóstico Técnico:</h3>
                <p className="mt-1 text-gray-900">{ticket.diagnostico || <span className="italic text-gray-400">Aún no registrado</span>}</p>
              </div>
              <div>
                <h3 className="font-medium text-sm text-gray-500">Solución Aplicada:</h3>
                <p className="mt-1 text-gray-900">{ticket.solucion || <span className="italic text-gray-400">Aún no registrada</span>}</p>
              </div>
            </div>
          </div>

          {ticket.evidences && ticket.evidences.length > 0 && (
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-medium border-b pb-2 mb-4">Evidencias Fotográficas</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {ticket.evidences.map((ev: any) => (
                  <a key={ev.id} href={ev.archivo} target="_blank" rel="noreferrer" className="block border rounded p-1 hover:border-blue-500 transition-colors">
                    <img src={ev.archivo} alt={ev.nombre_archivo} className="w-full h-24 object-cover rounded" />
                    <p className="text-xs text-center mt-1 truncate px-1 text-gray-500">{ev.nombre_archivo}</p>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Columna Lateral */}
        <div className="space-y-6">
          {/* Info Financiera Básica */}
          <div className="bg-amber-50 shadow rounded-lg p-6 border border-amber-200">
            <h2 className="text-lg font-medium text-amber-900 border-b border-amber-200 pb-2 mb-4">Saldo del Ticket</h2>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-amber-800">Total a pagar:</span>
                <span className="font-medium text-amber-900">S/ {total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-amber-800">Pagado:</span>
                <span className="font-medium text-green-700">S/ {pagosConfirmados.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-base font-bold pt-2 border-t border-amber-200">
                <span className="text-amber-900">Saldo Pendiente:</span>
                <span className={saldoPendiente > 0 ? "text-red-600" : "text-green-600"}>
                  S/ {saldoPendiente.toFixed(2)}
                </span>
              </div>
              {saldoPendiente > 0 && (
                <p className="text-xs text-amber-700 mt-2 text-center bg-amber-100 py-1 rounded">
                  No se puede entregar si hay saldo.
                </p>
              )}
            </div>
          </div>

          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium border-b pb-2 mb-4">Cliente y Equipo</h2>
            <div className="space-y-3">
              <div>
                <span className="text-xs text-gray-500 block">Cliente:</span>
                <Link to={`/customers/${ticket.customer?.id}`} className="text-blue-600 hover:underline">{ticket.customer?.nombre}</Link>
              </div>
              <div>
                <span className="text-xs text-gray-500 block">Identificador:</span>
                <span className="text-sm font-medium">{ticket.customer?.identificador}</span>
              </div>
              {ticket.device && (
                <div>
                  <span className="text-xs text-gray-500 block">Dispositivo:</span>
                  <span className="text-sm font-medium">{ticket.device.marca} {ticket.device.modelo}</span>
                  {ticket.device.numero_serie && <span className="text-xs text-gray-500 block">SN: {ticket.device.numero_serie}</span>}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium border-b pb-2 mb-4">Asignación</h2>
            <div className="space-y-3">
              <div>
                <span className="text-xs text-gray-500 block">Técnico Asignado:</span>
                <span className="text-sm font-medium">{ticket.assigned_to?.nombre || 'Sin asignar'}</span>
              </div>
            </div>
          </div>
          
          {ticket.accessories && ticket.accessories.length > 0 && (
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-medium border-b pb-2 mb-4">Accesorios</h2>
              <ul className="space-y-2 text-sm">
                {ticket.accessories.map((acc: any) => (
                  <li key={acc.id} className="bg-gray-50 p-2 rounded">
                    <span className="font-medium">{acc.nombre}</span>
                    {acc.condicion && <span className="text-gray-500 ml-2">({acc.condicion})</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium border-b pb-2 mb-4">Timeline</h2>
            <div className="space-y-4 relative before:absolute before:inset-0 before:ml-2 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 before:to-transparent">
              {ticket.transitions?.map((trans: any) => (
                <div key={trans.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                  <div className="flex items-center justify-center w-5 h-5 rounded-full border border-white bg-slate-300 text-slate-500 group-[.is-active]:bg-blue-500 group-[.is-active]:text-blue-50 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                  </div>
                  <div className="w-[calc(100%-2.5rem)] md:w-[calc(50%-1.25rem)] p-3 rounded border border-slate-200 bg-white shadow-sm">
                    <div className="flex justify-between items-center mb-1">
                      <div className="font-semibold text-slate-700 text-xs">{statusLabels[trans.estado_nuevo] || trans.estado_nuevo}</div>
                      <time className="text-[10px] text-slate-500 font-medium">{new Date(trans.created_at).toLocaleTimeString()}</time>
                    </div>
                    <div className="text-slate-500 text-xs">por {trans.cambiado_por?.nombre || 'Sistema'}</div>
                    {trans.motivo && <div className="text-slate-600 text-xs mt-1 italic">"{trans.motivo}"</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

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
    </div>
  );
};

export default TicketDetailPage;
