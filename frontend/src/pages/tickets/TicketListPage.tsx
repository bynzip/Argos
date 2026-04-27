import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useTickets, Ticket } from '../../hooks/useTickets';
import { DataTable } from '../../components/ui/DataTable';
import { TicketStatusBadge } from '../../components/ui/TicketStatusBadge';
import { PriorityBadge } from '../../components/ui/PriorityBadge';

const TicketListPage = () => {
  const [searchParams] = useSearchParams();
  const initialSearch = searchParams.get('search') || '';
  const [search, setSearch] = useState(initialSearch);
  
  // Update state if URL search param changes
  useEffect(() => {
    if (searchParams.get('search')) {
      setSearch(searchParams.get('search') || '');
    }
  }, [searchParams]);

  const { data: tickets, isLoading } = useTickets({ search });

  const columns = [
    {
      header: 'Folio',
      cell: (ticket: Ticket) => (
        <Link to={`/tickets/${ticket.id}`} className="text-blue-600 hover:text-blue-900 font-medium">
          {ticket.folio}
        </Link>
      ),
    },
    {
      header: 'Cliente',
      cell: (ticket: Ticket) => ticket.customer?.nombre || '-',
    },
    {
      header: 'Dispositivo',
      cell: (ticket: Ticket) => ticket.device ? `${ticket.device.marca} ${ticket.device.modelo}` : '-',
    },
    {
      header: 'Técnico',
      cell: (ticket: Ticket) => ticket.assigned_to?.nombre || 'Sin asignar',
    },
    {
      header: 'Prioridad',
      cell: (ticket: Ticket) => <PriorityBadge priority={ticket.prioridad} />,
    },
    {
      header: 'Estado',
      cell: (ticket: Ticket) => <TicketStatusBadge status={ticket.estado} />,
    },
    {
      header: 'Fecha',
      cell: (ticket: Ticket) => new Date(ticket.created_at).toLocaleDateString(),
    },
  ];

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tickets de Reparación</h1>
          <p className="mt-1 text-sm text-gray-500">
            Gestión de equipos ingresados al taller
          </p>
        </div>
        <Link
          to="/tickets/new"
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 cursor-pointer"
        >
          <Plus className="-ml-1 mr-2 h-5 w-5" />
          Nuevo Ticket
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow">
        <DataTable
          columns={columns}
          data={tickets || []}
          keyExtractor={(ticket) => ticket.id}
          isLoading={isLoading}
          onSearch={setSearch}
          searchPlaceholder="Buscar por folio, cliente o dispositivo..."
          initialSearchValue={initialSearch}
        />
      </div>
    </div>
  );
};

export default TicketListPage;
