import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { FileText, ListChecks, Plus } from 'lucide-react';

import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { PageHeader } from '../../components/ui/PageHeader';
import { Select } from '../../components/ui/Select';
import { PaginatedResponse, Quote, useQuotes } from '../../hooks/useQuotes';

const STATUS_STYLES: Record<string, string> = {
  DRAFT: 'border-[var(--gray-200)] bg-[var(--gray-50)] text-[var(--gray-500)]',
  SENT: 'border-[var(--color-info-border)] bg-[var(--color-info-bg)] text-[var(--color-brand-blue)]',
  APPROVED: 'border-[var(--color-success-border)] bg-[var(--color-success-bg)] text-[var(--color-success)]',
  REJECTED: 'border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] text-[var(--color-danger)]',
  EXPIRED: 'border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] text-[var(--color-warning)]',
  CONVERTED: 'border-[var(--color-brand-accent-border)] bg-[var(--color-brand-accent-bg)] text-[var(--color-brand-orange)]',
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Borrador',
  SENT: 'Enviada',
  APPROVED: 'Aprobada',
  REJECTED: 'Rechazada',
  EXPIRED: 'Vencida',
  CONVERTED: 'Convertida',
};

export default function QuoteListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const estado = searchParams.get('estado') || '';
  const [searchTerm, setSearchTerm] = useState('');
  const { data, isLoading } = useQuotes({ estado: estado || undefined });

  const isPaginated = data && !Array.isArray(data) && 'results' in data;
  const allQuotes = isPaginated ? (data as PaginatedResponse<Quote>).results : Array.isArray(data) ? data : [];

  const quotes = useMemo(() => {
    const normalizedTerm = searchTerm.trim().toLowerCase();

    return allQuotes
      .filter((quote) => quote.is_active_version)
      .filter((quote) => {
        if (!normalizedTerm) return true;
        return [
          quote.folio,
          quote.customer?.nombre,
          quote.customer?.identificador,
          quote.source_ticket?.folio,
          STATUS_LABELS[quote.estado] || quote.estado,
        ].some((value) => value?.toLowerCase().includes(normalizedTerm));
      });
  }, [allQuotes, searchTerm]);

  const columns = [
    {
      header: 'Cotizacion',
      className: 'w-[20%]',
      cell: (quote: Quote) => (
        <div className="flex flex-col">
          <Link to={`/quotes/${quote.id}`} className="font-bold text-[var(--color-brand-blue)] transition-colors hover:text-[var(--color-brand-orange)] hover:underline">
            {quote.folio}
          </Link>
          <span className="text-[11px] font-bold uppercase tracking-[0.05em] text-[var(--gray-400)]">
            Version {quote.version}
          </span>
        </div>
      ),
    },
    {
      header: 'Cliente',
      className: 'w-[22%]',
      cell: (quote: Quote) => (
        <div className="flex flex-col">
          <span className="font-semibold text-[var(--gray-800)]">{quote.customer.nombre}</span>
          <span className="text-[12px] text-[var(--gray-400)]">{quote.customer.identificador}</span>
        </div>
      ),
    },
    {
      header: 'Origen',
      className: 'w-[18%]',
      cell: (quote: Quote) => (
        quote.source_ticket ? (
          <span className="text-[12px] font-semibold text-[var(--gray-600)]">{quote.source_ticket.folio}</span>
        ) : (
          <span className="text-[12px] font-medium text-[var(--gray-400)]">Directa</span>
        )
      ),
    },
    {
      header: 'Estado',
      className: 'w-[14%]',
      cell: (quote: Quote) => (
        <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.04em] ${STATUS_STYLES[quote.estado] || STATUS_STYLES.DRAFT}`}>
          {STATUS_LABELS[quote.estado] || quote.estado}
        </span>
      ),
    },
    {
      header: 'Valido hasta',
      className: 'w-[12%]',
      cell: (quote: Quote) => (
        <span className="text-[13px] text-[var(--gray-500)]">{quote.valido_hasta || '-'}</span>
      ),
    },
    {
      header: 'Total',
      className: 'w-[14%]',
      cell: (quote: Quote) => (
        <span className="whitespace-nowrap font-bold text-[var(--gray-800)]">
          S/ {parseFloat(quote.total).toFixed(2)}
        </span>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-[1600px] p-8">
      <PageHeader
        title="Cotizaciones"
        subtitle={`Presupuestos formales del taller (${quotes.length} visibles).`}
        actions={(
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => navigate('/quotes/services')}>
              <ListChecks size={16} className="mr-2" />
              Servicios
            </Button>
            <Button onClick={() => navigate('/quotes/new')}>
              <Plus size={16} className="mr-2" />
              Nueva cotizacion
            </Button>
          </div>
        )}
      />

      <div className="space-y-4">
        <DataTable
          data={quotes}
          columns={columns}
          keyExtractor={(item) => item.id}
          isLoading={isLoading}
          onSearch={setSearchTerm}
          searchPlaceholder="Buscar por folio, cliente, ticket o estado..."
          filters={(
            <div className="w-[180px]">
              <Select
                value={estado}
                onChange={(e) => {
                  const next = new URLSearchParams(searchParams);
                  if (e.target.value) next.set('estado', e.target.value);
                  else next.delete('estado');
                  setSearchParams(next);
                }}
                className="h-10 text-[13px]"
              >
                <option value="">Todos los estados</option>
                <option value="DRAFT">Borrador</option>
                <option value="SENT">Enviada</option>
                <option value="APPROVED">Aprobada</option>
                <option value="REJECTED">Rechazada</option>
                <option value="EXPIRED">Vencida</option>
                <option value="CONVERTED">Convertida</option>
              </Select>
            </div>
          )}
        />

        <div className="flex items-center gap-2 text-[12px] text-[var(--gray-400)]">
          <FileText size={14} />
          Las cotizaciones enviadas o aprobadas no se editan; si cambian, se crea una nueva version.
        </div>
      </div>
    </div>
  );
}
