import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Eye } from 'lucide-react';
import { useTickets, Ticket } from '../../hooks/useTickets';
import { DataTable } from '../../components/ui/DataTable';
import { TicketStatusBadge } from '../../components/ui/TicketStatusBadge';
import { PriorityBadge } from '../../components/ui/PriorityBadge';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';

const TicketListPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSearch = searchParams.get('search') || '';
  const initialState = searchParams.get('estado') || '';
  const [search, setSearch] = useState(initialSearch);
  const [estadoFilter, setEstadoFilter] = useState(initialState);
  
  // Update state if URL search param changes
  useEffect(() => {
    if (searchParams.has('search')) {
      setSearch(searchParams.get('search') || '');
    }
    if (searchParams.has('estado')) {
      setEstadoFilter(searchParams.get('estado') || '');
    }
  }, [searchParams]);

  const { data: tickets, isLoading } = useTickets({ search, estado: estadoFilter });

  const columns = [
    {
      header: 'Folio',
      cell: (ticket: Ticket) => (
        <Link to={`/tickets/${ticket.id}`} className="text-[var(--color-brand-blue)] hover:underline font-bold">
          {ticket.folio}
        </Link>
      ),
      className: "w-[140px]"
    },
    {
      header: 'Cliente',
      cell: (ticket: Ticket) => (
        <div className="flex flex-col">
          <span className="font-semibold text-[var(--gray-800)]">{ticket.customer?.nombre || '-'}</span>
          <span className="text-[12px] text-[var(--gray-400)]">{ticket.customer?.identificador || ''}</span>
        </div>
      ),
    },
    {
      header: 'Dispositivo',
      cell: (ticket: Ticket) => (
        <div className="flex flex-col">
          <span className="font-medium text-[var(--gray-700)]">
            {ticket.device ? `${ticket.device.marca} ${ticket.device.modelo}` : '-'}
          </span>
          <span className="text-[11px] text-[var(--gray-400)]">{ticket.device?.numero_serie || ''}</span>
        </div>
      ),
    },
    {
      header: 'Estado',
      cell: (ticket: Ticket) => <TicketStatusBadge status={ticket.estado} />,
    },
    {
      header: 'Prioridad',
      cell: (ticket: Ticket) => <PriorityBadge priority={ticket.prioridad} />,
    },
    {
      header: 'Técnico',
      cell: (ticket: Ticket) => (
        <span className="text-[var(--gray-600)] font-medium">
          {ticket.assigned_to?.nombre || 'Sin asignar'}
        </span>
      ),
    },
    {
      header: 'Fecha',
      cell: (ticket: Ticket) => (
        <span className="text-[var(--gray-500)] text-[13px]">
          {new Date(ticket.created_at).toLocaleDateString()}
        </span>
      ),
    },
    {
      header: '',
      cell: (ticket: Ticket) => (
        <div className="flex justify-end">
          <Link to={`/tickets/${ticket.id}`}>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-[var(--gray-400)] hover:text-[var(--color-brand-blue)]">
              <Eye size={16} />
            </Button>
          </Link>
        </div>
      ),
      className: "w-[50px]"
    }
  ];

  return (
    <div className="p-8 max-w-[1600px] mx-auto">
      <PageHeader 
        title="Tickets de Reparación"
        subtitle="Gestión de equipos ingresados al taller"
        actions={
          <Link to="/tickets/new">
            <Button variant="primary">
              <Plus size={18} />
              Nuevo Ticket
            </Button>
          </Link>
        }
      />

      <DataTable
        columns={columns}
        data={tickets || []}
        keyExtractor={(ticket) => ticket.id}
        isLoading={isLoading}
        onSearch={(val) => {
          setSearch(val);
          setSearchParams(prev => {
            if (val) prev.set('search', val);
            else prev.delete('search');
            return prev;
          });
        }}
        searchPlaceholder="Buscar por folio, cliente o dispositivo..."
        initialSearchValue={initialSearch}
        filters={
          <div className="w-[180px]">
            <Select
              value={estadoFilter}
              onChange={(e) => {
                setEstadoFilter(e.target.value);
                setSearchParams(prev => {
                  if (e.target.value) prev.set('estado', e.target.value);
                  else prev.delete('estado');
                  return prev;
                });
              }}
              className="h-9 text-[13px]"
            >
              <option value="">Todos los Estados</option>
              <option value="INTAKE">Ingreso</option>
              <option value="DIAGNOSTIC">Diagnóstico</option>
              <option value="QUOTED">Cotizado</option>
              <option value="APPROVED">Aprobado</option>
              <option value="WAITING_PARTS">En espera repuesto</option>
              <option value="IN_REPAIR">En reparación</option>
              <option value="IN_TESTING">En pruebas</option>
              <option value="READY">Listo</option>
              <option value="DELIVERED">Entregado</option>
              <option value="CLOSED">Cerrado</option>
              <option value="REJECTED">Rechazado</option>
              <option value="STORAGE">Cochera</option>
            </Select>
          </div>
        }
      />
    </div>
  );
};

export default TicketListPage;
