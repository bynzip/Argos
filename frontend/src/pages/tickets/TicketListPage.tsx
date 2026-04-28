import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useTickets, Ticket } from '../../hooks/useTickets';
import { DataTable } from '../../components/ui/DataTable';
import { TicketStatusBadge } from '../../components/ui/TicketStatusBadge';
import { PriorityBadge } from '../../components/ui/PriorityBadge';

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
          actions={
            <select
              value={estadoFilter}
              onChange={(e) => {
                setEstadoFilter(e.target.value);
                setSearchParams(prev => {
                  if (e.target.value) prev.set('estado', e.target.value);
                  else prev.delete('estado');
                  return prev;
                });
              }}
              className="field-input text-sm py-2"
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
            </select>
          }
        />
      </div>
    </div>
  );
};

export default TicketListPage;
