import React from 'react';
import { Link } from 'react-router-dom';
import { useTickets, Ticket, useTicketTransition } from '../../hooks/useTickets';
import { useAuthStore } from '../../store/authStore';
import { TicketStatusBadge } from '../../components/ui/TicketStatusBadge';
import { PriorityBadge } from '../../components/ui/PriorityBadge';
import { Clock, AlertCircle } from 'lucide-react';

const TechnicianQueuePage = () => {
  const { user } = useAuthStore();
  const { data: tickets, isLoading } = useTickets({ assigned_to: user?.id, ordering: '-prioridad,created_at' });
  const transitionMutation = useTicketTransition();

  if (isLoading) return <div className="p-6">Cargando cola de trabajo...</div>;

  // Filter only active technical tickets
  const activeTickets = tickets?.filter((t: Ticket) => 
    !['DELIVERED', 'CLOSED', 'STORAGE', 'REJECTED', 'INTAKE'].includes(t.estado)
  ) || [];

  const handleQuickTransition = (id: string, currentStatus: string) => {
    let newStatus = '';
    if (currentStatus === 'DIAGNOSTIC') newStatus = 'IN_REPAIR'; 
    else if (currentStatus === 'WAITING_PARTS') newStatus = 'IN_REPAIR';
    else if (currentStatus === 'IN_REPAIR') newStatus = 'IN_TESTING';
    else if (currentStatus === 'IN_TESTING') newStatus = 'READY';
    else return;

    if (newStatus) {
      transitionMutation.mutate({ id, newStatus, motivo: 'Transición rápida' });
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Mi Cola de Trabajo</h1>
        <p className="text-sm text-gray-500">Tickets asignados pendientes de resolución</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {activeTickets.map((ticket: Ticket) => (
          <div key={ticket.id} className="bg-white rounded-lg shadow border border-gray-200 p-5 flex flex-col h-full relative">
            {ticket.estado === 'WAITING_PARTS' && (
              <div className="absolute -top-2 -right-2">
                <span className="flex h-5 w-5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-5 w-5 bg-orange-500 text-white items-center justify-center">
                    <AlertCircle size={12} />
                  </span>
                </span>
              </div>
            )}
            
            <div className="flex justify-between items-start mb-3">
              <Link to={`/tickets/${ticket.id}`} className="text-lg font-bold text-blue-600 hover:underline">
                {ticket.folio}
              </Link>
              <PriorityBadge priority={ticket.prioridad} />
            </div>

            <div className="mb-4">
              <h3 className="text-sm font-medium text-gray-900">
                {ticket.device ? `${ticket.device.marca} ${ticket.device.modelo}` : 'Equipo sin registrar'}
              </h3>
              <p className="text-sm text-gray-500 line-clamp-2 mt-1">{ticket.descripcion_problema}</p>
            </div>

            <div className="mt-auto pt-4 border-t border-gray-100">
              <div className="flex justify-between items-center mb-3">
                <TicketStatusBadge status={ticket.estado} />
                <span className="text-xs text-gray-500 flex items-center">
                  <Clock size={12} className="mr-1" />
                  {new Date(ticket.created_at).toLocaleDateString()}
                </span>
              </div>

              {['DIAGNOSTIC', 'IN_REPAIR', 'IN_TESTING', 'WAITING_PARTS'].includes(ticket.estado) && (
                <button
                  onClick={() => handleQuickTransition(ticket.id, ticket.estado)}
                  disabled={transitionMutation.isPending}
                  className="w-full py-2 bg-blue-50 text-blue-700 rounded text-sm font-medium hover:bg-blue-100 disabled:opacity-50"
                >
                  {ticket.estado === 'DIAGNOSTIC' && 'Pasar a En Reparación'}
                  {ticket.estado === 'WAITING_PARTS' && 'Retomar Reparación'}
                  {ticket.estado === 'IN_REPAIR' && 'Pasar a Pruebas'}
                  {ticket.estado === 'IN_TESTING' && 'Marcar como Listo'}
                </button>
              )}
            </div>
          </div>
        ))}

        {activeTickets.length === 0 && (
          <div className="col-span-full py-12 text-center bg-white rounded-lg border border-dashed border-gray-300">
            <p className="text-gray-500">No tienes tickets activos en tu cola en este momento.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TechnicianQueuePage;
