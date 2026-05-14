import { Link } from 'react-router-dom';
import { useTickets, Ticket, useTicketTransition } from '../../hooks/useTickets';
import { useAuthStore } from '../../store/authStore';
import { TicketStatusBadge } from '../../components/ui/TicketStatusBadge';
import { PriorityBadge } from '../../components/ui/PriorityBadge';
import { Clock, AlertCircle, Inbox, Zap } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Card, CardHeader, CardContent } from '../../components/ui/Card';
// import { cn } from '../../lib/utils';

const TechnicianQueuePage = () => {
  const { user } = useAuthStore();
  const { data: tickets, isLoading } = useTickets({ assigned_to: user?.id, ordering: '-prioridad,created_at' });
  const transitionMutation = useTicketTransition();
  const ticketList = Array.isArray(tickets) ? tickets : tickets?.results ?? [];

  if (isLoading) return <div className="p-12 text-center text-[var(--gray-500)]">Cargando cola de trabajo...</div>;

  // Filter only active technical tickets
  const activeTickets = ticketList.filter((t: Ticket) => 
    !['DELIVERED', 'CLOSED', 'STORAGE', 'REJECTED', 'INTAKE'].includes(t.estado)
  );

  const handleQuickTransition = (id: string, currentStatus: string) => {
    let newStatus = '';
    if (currentStatus === 'DIAGNOSTIC') newStatus = 'IN_REPAIR'; 
    else if (currentStatus === 'WAITING_PARTS') newStatus = 'IN_REPAIR';
    else if (currentStatus === 'IN_REPAIR') newStatus = 'IN_TESTING';
    else if (currentStatus === 'IN_TESTING') newStatus = 'READY';
    else return;

    if (newStatus) {
      transitionMutation.mutate({ id, newStatus, motivo: 'Transición rápida desde cola' });
    }
  };

  return (
    <div className="p-8 max-w-[1400px] mx-auto">
      <PageHeader 
        title="Mi Cola de Trabajo"
        subtitle="Tickets asignados pendientes de resolución técnica"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {activeTickets.map((ticket: Ticket) => (
          <Card key={ticket.id} className="flex flex-col h-full relative group hover:border-[var(--color-brand-blue)] transition-all">
            {ticket.estado === 'WAITING_PARTS' && (
              <div className="absolute -top-2 -right-2 z-10">
                <span className="flex h-6 w-6 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--color-brand-orange)] opacity-20"></span>
                  <span className="relative inline-flex rounded-full h-6 w-6 bg-[var(--color-brand-orange)] text-white items-center justify-center shadow-md">
                    <AlertCircle size={14} />
                  </span>
                </span>
              </div>
            )}
            
            <CardHeader className="py-4 border-b border-[var(--gray-50)]">
              <div className="flex justify-between items-start">
                <Link to={`/tickets/${ticket.id}`} className="text-lg font-black text-[var(--color-brand-blue)] hover:underline tracking-tight">
                  {ticket.folio}
                </Link>
                <PriorityBadge priority={ticket.prioridad} />
              </div>
            </CardHeader>

            <CardContent className="pt-5 flex-1 flex flex-col">
              <div className="mb-6">
                <h3 className="text-[15px] font-bold text-[var(--gray-800)] leading-tight mb-1">
                  {ticket.device ? `${ticket.device.marca} ${ticket.device.modelo}` : 'Equipo sin registrar'}
                </h3>
                <p className="text-[13px] text-[var(--gray-500)] line-clamp-2 leading-relaxed">
                  {ticket.descripcion_problema}
                </p>
              </div>

              <div className="mt-auto space-y-4">
                <div className="flex justify-between items-center py-3 border-t border-[var(--gray-50)]">
                  <TicketStatusBadge status={ticket.estado} />
                  <span className="text-[11px] font-bold text-[var(--gray-400)] flex items-center bg-[var(--gray-50)] px-2 py-1 rounded-md">
                    <Clock size={12} className="mr-1.5" />
                    {new Date(ticket.created_at).toLocaleDateString()}
                  </span>
                </div>

                {['DIAGNOSTIC', 'IN_REPAIR', 'IN_TESTING', 'WAITING_PARTS'].includes(ticket.estado) && (
                  <Button
                    onClick={() => handleQuickTransition(ticket.id, ticket.estado)}
                    disabled={transitionMutation.isPending}
                    variant="secondary"
                    className="w-full bg-[var(--color-info-bg)] text-[var(--color-brand-blue)] border-[var(--color-info-border)] hover:bg-[var(--color-brand-blue)] hover:text-white font-bold"
                  >
                    <Zap size={16} className="mr-2" />
                    {ticket.estado === 'DIAGNOSTIC' && 'Pasar a Reparación'}
                    {ticket.estado === 'WAITING_PARTS' && 'Retomar Reparación'}
                    {ticket.estado === 'IN_REPAIR' && 'Pasar a Pruebas'}
                    {ticket.estado === 'IN_TESTING' && 'Marcar como Listo'}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}

        {activeTickets.length === 0 && (
          <div className="col-span-full py-20 text-center bg-white rounded-2xl border-2 border-dashed border-[var(--gray-200)]">
            <Inbox size={48} className="mx-auto text-[var(--gray-200)] mb-4" />
            <h3 className="text-lg font-bold text-[var(--gray-800)]">¡Todo al día!</h3>
            <p className="text-sm text-[var(--gray-400)] mt-1">No tienes tickets técnicos activos en este momento.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TechnicianQueuePage;
