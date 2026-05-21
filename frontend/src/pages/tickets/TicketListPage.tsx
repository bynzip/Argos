import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';

import { useTickets, Ticket, PaginatedResponse } from '../../hooks/useTickets';
import { useAuthStore } from '../../store/authStore';
import { DataTable } from '../../components/ui/DataTable';
import { TicketStatusBadge } from '../../components/ui/TicketStatusBadge';
import { PriorityBadge } from '../../components/ui/PriorityBadge';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';

const STATUS_OPTIONS = [
  { value: 'INTAKE', label: 'Ingreso' },
  { value: 'DIAGNOSTIC', label: 'Diagnostico' },
  { value: 'QUOTED', label: 'Cotizado' },
  { value: 'APPROVED', label: 'Aprobado' },
  { value: 'WAITING_PARTS', label: 'En espera repuesto' },
  { value: 'IN_REPAIR', label: 'En reparacion' },
  { value: 'IN_TESTING', label: 'En pruebas' },
  { value: 'READY', label: 'Listo' },
  { value: 'DELIVERED', label: 'Entregado' },
  { value: 'CLOSED', label: 'Cerrado' },
  { value: 'REJECTED', label: 'Rechazado' },
  { value: 'STORAGE', label: 'Cochera' },
];

const ROLE_DEFAULTS: Record<string, string[]> = {
  Recepcionista: ['INTAKE', 'QUOTED', 'READY', 'STORAGE', 'DELIVERED'],
  'Técnico': ['DIAGNOSTIC', 'APPROVED', 'WAITING_PARTS', 'IN_REPAIR', 'IN_TESTING'],
  Tecnico: ['DIAGNOSTIC', 'APPROVED', 'WAITING_PARTS', 'IN_REPAIR', 'IN_TESTING'],
  Almacenero: ['APPROVED', 'WAITING_PARTS', 'IN_REPAIR'],
};

const ALL_STATES = STATUS_OPTIONS.map((status) => status.value);

const TicketListPage = () => {
  const { user } = useAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSearch = searchParams.get('search') || '';
  const initialPage = parseInt(searchParams.get('page') || '1');
  const initialStates = searchParams.get('estado');
  const sessionKey = `ticket-filters:${user?.role || 'all'}`;
  const filterMenuRef = useRef<HTMLDivElement | null>(null);

  const [search, setSearch] = useState(initialSearch);
  const [page, setPage] = useState(initialPage);
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const [selectedStates, setSelectedStates] = useState<string[]>(() => {
    if (initialStates) return initialStates.split(',').filter(Boolean);
    const persisted = typeof window !== 'undefined' ? window.sessionStorage.getItem(sessionKey) : null;
    if (persisted) return JSON.parse(persisted);
    return ROLE_DEFAULTS[user?.role || ''] || ALL_STATES;
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(sessionKey, JSON.stringify(selectedStates));
    }
  }, [selectedStates, sessionKey]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!filterMenuRef.current?.contains(event.target as Node)) {
        setIsFilterMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const { data, isLoading } = useTickets({
    search,
    estado: selectedStates.join(','),
    page,
  });

  const isPaginated = data && typeof data === 'object' && !Array.isArray(data);
  const tickets = isPaginated ? (data as PaginatedResponse<Ticket>).results || [] : (Array.isArray(data) ? data : []);
  const totalCount = isPaginated ? (data as PaginatedResponse<Ticket>).count || 0 : tickets.length;
  const hasNext = isPaginated ? !!(data as PaginatedResponse<Ticket>).next : false;
  const hasPrev = isPaginated ? !!(data as PaginatedResponse<Ticket>).previous : false;

  const subtitle = useMemo(() => {
    if (!selectedStates.length) return `Gestion de equipos ingresados al taller (${totalCount} en total)`;
    return `Vista operativa filtrada por ${selectedStates.length} estado(s) (${totalCount} resultados)`;
  }, [selectedStates.length, totalCount]);

  const selectedStateLabels = useMemo(
    () => STATUS_OPTIONS.filter((status) => selectedStates.includes(status.value)).map((status) => status.label),
    [selectedStates],
  );

  const filterButtonLabel = useMemo(() => {
    if (selectedStates.length === STATUS_OPTIONS.length) return 'Estados: todos';
    if (!selectedStates.length) return 'Estados: ninguno';
    if (selectedStates.length === 1) return `Estado: ${selectedStateLabels[0]}`;
    return `Estados: ${selectedStates.length} seleccionados`;
  }, [selectedStateLabels, selectedStates.length]);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    setSearchParams((prev) => {
      prev.set('page', newPage.toString());
      if (selectedStates.length) prev.set('estado', selectedStates.join(','));
      else prev.delete('estado');
      return prev;
    });
  };

  const toggleState = (value: string) => {
    setPage(1);
    setSelectedStates((prev) => {
      const next = prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value];
      setSearchParams((params) => {
        if (next.length) params.set('estado', next.join(','));
        else params.delete('estado');
        params.set('page', '1');
        return params;
      });
      return next;
    });
  };

  const columns = [
    {
      header: 'Folio',
      cell: (ticket: Ticket) => (
        <Link to={`/tickets/${ticket.id}`} className="font-bold text-[var(--color-brand-blue)] hover:underline">
          {ticket.folio}
        </Link>
      ),
      className: 'w-[180px]',
    },
    {
      header: 'Cliente',
      cell: (ticket: Ticket) => (
        <div className="flex flex-col">
          <span className="font-semibold text-[var(--gray-800)]">{ticket.customer?.nombre || '-'}</span>
          <span className="text-[12px] text-[var(--gray-400)]">{ticket.customer?.identificador || ''}</span>
        </div>
      ),
      className: 'w-[190px]',
    },
    {
      header: 'Dispositivo',
      cell: (ticket: Ticket) => (
        <div className="flex flex-col">
          <span className="font-medium text-[var(--gray-700)]">{ticket.device ? `${ticket.device.marca} ${ticket.device.modelo}` : '-'}</span>
          <span className="text-[11px] text-[var(--gray-400)]">{ticket.device?.numero_serie || ''}</span>
        </div>
      ),
    },
    { header: 'Estado', cell: (ticket: Ticket) => <TicketStatusBadge status={ticket.estado} />, className: 'w-[130px]' },
    { header: 'Prioridad', cell: (ticket: Ticket) => <PriorityBadge priority={ticket.prioridad} /> },
    {
      header: 'Tecnico',
      cell: (ticket: Ticket) => <span className="font-medium text-[var(--gray-600)]">{ticket.assigned_to?.nombre || 'Sin asignar'}</span>,
    },
    {
      header: 'Fecha',
      cell: (ticket: Ticket) => <span className="text-[13px] text-[var(--gray-500)]">{new Date(ticket.created_at).toLocaleDateString()}</span>,
    },
  ];

  return (
    <div className="p-8 max-w-[1600px] mx-auto">
      <PageHeader
        title="Tickets de Reparacion"
        subtitle={subtitle}
        actions={(
          <div className="flex flex-wrap gap-3">
            <Link to="/tickets/new?mode=warranty">
              <Button variant="secondary">
                Garantia
              </Button>
            </Link>
            <Link to="/tickets/new">
              <Button variant="primary">
                <Plus size={18} />
                Nuevo Ticket
              </Button>
            </Link>
          </div>
        )}
      />

      <div className="space-y-4">
        <DataTable
          columns={columns}
          data={tickets || []}
          keyExtractor={(ticket) => ticket.id}
          isLoading={isLoading}
          onSearch={(val) => {
            setSearch(val);
            setPage(1);
            setSearchParams((prev) => {
              if (val) prev.set('search', val);
              else prev.delete('search');
              if (selectedStates.length) prev.set('estado', selectedStates.join(','));
              else prev.delete('estado');
              prev.set('page', '1');
              return prev;
            });
          }}
          searchPlaceholder="Buscar por folio, cliente o dispositivo..."
          initialSearchValue={initialSearch}
          filters={(
            <div ref={filterMenuRef} className="relative min-w-[260px]">
              <button
                type="button"
                onClick={() => setIsFilterMenuOpen((prev) => !prev)}
                className="flex h-10 w-full items-center justify-between rounded-lg border-2 border-[var(--gray-300)] bg-white px-3.5 text-left text-sm text-[var(--gray-800)] transition-all hover:border-[var(--gray-400)]"
              >
                <span className="truncate font-medium">{filterButtonLabel}</span>
                <ChevronDown size={16} className={`text-[var(--gray-400)] transition-transform ${isFilterMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {isFilterMenuOpen && (
                <div className="absolute right-0 z-20 mt-2 w-full rounded-xl border border-[var(--gray-200)] bg-white p-2 shadow-lg">
                  <div className="max-h-72 space-y-1 overflow-y-auto">
                    {STATUS_OPTIONS.map((status) => {
                      const active = selectedStates.includes(status.value);
                      return (
                        <label
                          key={status.value}
                          className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm text-[var(--gray-700)] transition-colors hover:bg-[var(--gray-50)]"
                        >
                          <input
                            type="checkbox"
                            checked={active}
                            onChange={() => toggleState(status.value)}
                            className="h-4 w-4 rounded border-[var(--gray-300)] text-[var(--color-brand-blue)] focus:ring-[var(--color-brand-blue)]"
                          />
                          <span>{status.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        />

        {isPaginated && (
          <div className="flex items-center justify-between rounded-xl border border-[var(--gray-200)] bg-white px-4 py-3 shadow-sm">
            <div>
              <p className="text-sm text-[var(--gray-500)]">
                Mostrando <span className="font-bold text-[var(--gray-800)]">{tickets.length}</span> de <span className="font-bold text-[var(--gray-800)]">{totalCount}</span> tickets
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => handlePageChange(page - 1)} disabled={!hasPrev || isLoading} className="h-8 w-8 p-0">
                <ChevronLeft size={18} />
              </Button>
              <div className="flex h-8 min-w-[32px] items-center justify-center rounded-lg border border-[var(--color-info-border)] bg-[var(--color-info-bg)] px-2 text-xs font-bold text-[var(--color-brand-blue)]">
                Pagina {page}
              </div>
              <Button variant="secondary" size="sm" onClick={() => handlePageChange(page + 1)} disabled={!hasNext || isLoading} className="h-8 w-8 p-0">
                <ChevronRight size={18} />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TicketListPage;
