import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Eye, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTickets, Ticket, PaginatedResponse } from '../../hooks/useTickets';
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
  const initialPage = parseInt(searchParams.get('page') || '1');
  
  const [search, setSearch] = useState(initialSearch);
  const [estadoFilter, setEstadoFilter] = useState(initialState);
  const [page, setPage] = useState(initialPage);
  
  // Update state if URL search param changes
  useEffect(() => {
    if (searchParams.has('search')) {
      setSearch(searchParams.get('search') || '');
    }
    if (searchParams.has('estado')) {
      setEstadoFilter(searchParams.get('estado') || '');
    }
    const p = parseInt(searchParams.get('page') || '1');
    setPage(p);
  }, [searchParams]);

  const { data, isLoading } = useTickets({ 
    search, 
    estado: estadoFilter,
    page: page
  });

  // Determinar si la data es paginada o un array simple
  const isPaginated = data && typeof data === 'object' && !Array.isArray(data);
  const tickets = isPaginated 
    ? (data as PaginatedResponse<Ticket>).results || [] 
    : (Array.isArray(data) ? data : []);
  
  const totalCount = isPaginated 
    ? (data as PaginatedResponse<Ticket>).count || 0 
    : tickets.length;
    
  const hasNext = isPaginated ? !!(data as PaginatedResponse<Ticket>).next : false;
  const hasPrev = isPaginated ? !!(data as PaginatedResponse<Ticket>).previous : false;

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    setSearchParams(prev => {
      prev.set('page', newPage.toString());
      return prev;
    });
  };

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
        subtitle={`Gestión de equipos ingresados al taller (${totalCount} en total)`}
        actions={
          <Link to="/tickets/new">
            <Button variant="primary">
              <Plus size={18} />
              Nuevo Ticket
            </Button>
          </Link>
        }
      />

      <div className="space-y-4">
        <DataTable
          columns={columns}
          data={tickets || []}
          keyExtractor={(ticket) => ticket.id}
          isLoading={isLoading}
          onSearch={(val) => {
            setSearch(val);
            setPage(1); // Reset to page 1 on search
            setSearchParams(prev => {
              if (val) prev.set('search', val);
              else prev.delete('search');
              prev.set('page', '1');
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
                  const val = e.target.value;
                  setEstadoFilter(val);
                  setPage(1); // Reset to page 1 on filter
                  setSearchParams(prev => {
                    if (val) prev.set('estado', val);
                    else prev.delete('estado');
                    prev.set('page', '1');
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

        {/* Pagination Footer */}
        {isPaginated && (
          <div className="flex items-center justify-between px-4 py-3 bg-white border border-[var(--gray-200)] rounded-xl shadow-sm">
            <div className="flex flex-1 justify-between sm:hidden">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handlePageChange(page - 1)}
                disabled={!hasPrev || isLoading}
              >
                Anterior
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handlePageChange(page + 1)}
                disabled={!hasNext || isLoading}
              >
                Siguiente
              </Button>
            </div>
            <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-[var(--gray-500)]">
                  Mostrando <span className="font-bold text-[var(--gray-800)]">{tickets.length}</span> de <span className="font-bold text-[var(--gray-800)]">{totalCount}</span> tickets
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handlePageChange(page - 1)}
                  disabled={!hasPrev || isLoading}
                  className="h-8 w-8 p-0"
                >
                  <ChevronLeft size={18} />
                </Button>
                
                <div className="flex items-center justify-center h-8 min-w-[32px] px-2 rounded-lg bg-[var(--color-info-bg)] text-[var(--color-brand-blue)] text-xs font-bold border border-[var(--color-info-border)]">
                  Página {page}
                </div>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handlePageChange(page + 1)}
                  disabled={!hasNext || isLoading}
                  className="h-8 w-8 p-0"
                >
                  <ChevronRight size={18} />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TicketListPage;

