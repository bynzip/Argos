import { Link } from 'react-router-dom';
import { useTickets, Ticket, useTicketTransition } from '../../hooks/useTickets';
import { TicketStatusBadge } from '../../components/ui/TicketStatusBadge';
import { PriorityBadge } from '../../components/ui/PriorityBadge';
import { AlertCircle, Inbox, Zap } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader } from '../../components/ui/Card';

const TECHNICAL_STATES = 'DIAGNOSTIC,APPROVED,WAITING_PARTS,IN_REPAIR,IN_TESTING';

const TechnicianQueuePage = () => {
  const { data: tickets, isLoading } = useTickets({ estado: TECHNICAL_STATES, ordering: '-prioridad,created_at' });
  const transitionMutation = useTicketTransition();
  const ticketList = Array.isArray(tickets) ? tickets : tickets?.results ?? [];

  if (isLoading) return <div className="p-12 text-center text-[var(--gray-500)]">Cargando cola de trabajo...</div>;

  const handleQuickTransition = (id: string, currentStatus: string) => {
    let newStatus = '';
    if (currentStatus === 'DIAGNOSTIC') newStatus = 'IN_REPAIR';
    else if (currentStatus === 'WAITING_PARTS') newStatus = 'IN_REPAIR';
    else if (currentStatus === 'IN_REPAIR') newStatus = 'IN_TESTING';
    else if (currentStatus === 'IN_TESTING') newStatus = 'READY';
    else return;

    transitionMutation.mutate({ id, newStatus, motivo: 'Transicion rapida desde cola tecnica' });
  };

  return (
    <div className="p-8 max-w-[1400px] mx-auto">
      <PageHeader title="Cola Tecnica por Area" subtitle="Vista operativa compartida basada en estados tecnicos." />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {ticketList.map((ticket: Ticket) => (
          <Card key={ticket.id} className="group relative flex h-full flex-col transition-all hover:border-[var(--color-brand-blue)]">
            {ticket.estado === 'WAITING_PARTS' && (
              <div className="absolute -right-2 -top-2 z-10">
                <span className="relative flex h-6 w-6">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--color-brand-orange)] opacity-20"></span>
                  <span className="relative inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-brand-orange)] text-white shadow-md">
                    <AlertCircle size={14} />
                  </span>
                </span>
              </div>
            )}

            <CardHeader className="border-b border-[var(--gray-50)] py-4">
              <div className="flex items-start justify-between">
                <Link to={`/tickets/${ticket.id}`} className="text-lg font-black tracking-tight text-[var(--color-brand-blue)] hover:underline">
                  {ticket.folio}
                </Link>
                <PriorityBadge priority={ticket.prioridad} />
              </div>
            </CardHeader>

            <CardContent className="flex flex-1 flex-col pt-5">
              <div className="mb-6">
                <h3 className="mb-1 text-[15px] font-bold leading-tight text-[var(--gray-800)]">
                  {ticket.device ? `${ticket.device.marca} ${ticket.device.modelo}` : 'Equipo sin registrar'}
                </h3>
                <p className="line-clamp-2 text-[13px] leading-relaxed text-[var(--gray-500)]">{ticket.descripcion_problema}</p>
              </div>

              <div className="mt-auto space-y-4">
                <div className="flex items-center justify-between border-t border-[var(--gray-50)] py-3">
                  <TicketStatusBadge status={ticket.estado} />
                  <span className="rounded-md bg-[var(--gray-50)] px-2 py-1 text-[11px] font-bold text-[var(--gray-400)]">
                    {new Date(ticket.created_at).toLocaleDateString()}
                  </span>
                </div>

                {['DIAGNOSTIC', 'IN_REPAIR', 'IN_TESTING', 'WAITING_PARTS'].includes(ticket.estado) && (
                  <Button
                    onClick={() => handleQuickTransition(ticket.id, ticket.estado)}
                    disabled={transitionMutation.isPending}
                    variant="secondary"
                    className="w-full border-[var(--color-info-border)] bg-[var(--color-info-bg)] font-bold text-[var(--color-brand-blue)] hover:bg-[var(--color-brand-blue)] hover:text-white"
                  >
                    <Zap size={16} className="mr-2" />
                    {ticket.estado === 'DIAGNOSTIC' && 'Pasar a Reparacion'}
                    {ticket.estado === 'WAITING_PARTS' && 'Retomar Reparacion'}
                    {ticket.estado === 'IN_REPAIR' && 'Pasar a Pruebas'}
                    {ticket.estado === 'IN_TESTING' && 'Marcar como Listo'}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}

        {ticketList.length === 0 && (
          <div className="col-span-full rounded-2xl border-2 border-dashed border-[var(--gray-200)] bg-white py-20 text-center">
            <Inbox size={48} className="mx-auto mb-4 text-[var(--gray-200)]" />
            <h3 className="text-lg font-bold text-[var(--gray-800)]">Todo al dia</h3>
            <p className="mt-1 text-sm text-[var(--gray-400)]">No hay tickets tecnicos activos en este momento.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TechnicianQueuePage;
