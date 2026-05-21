import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { FileText, ListChecks, Plus } from 'lucide-react';

import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { Select } from '../../components/ui/Select';
import { useQuotes, Quote, PaginatedResponse } from '../../hooks/useQuotes';

export default function QuoteListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const estado = searchParams.get('estado') || '';
  const { data, isLoading } = useQuotes({ estado: estado || undefined });

  const isPaginated = data && !Array.isArray(data) && 'results' in data;
  const allQuotes = isPaginated ? (data as PaginatedResponse<Quote>).results : Array.isArray(data) ? data : [];
  const quotes = allQuotes.filter((quote) => quote.is_active_version);

  return (
    <div className="p-8 max-w-[1400px] mx-auto">
      <PageHeader
        title="Cotizaciones"
        subtitle="Presupuestos formales del taller, con versiones y estados de aprobación."
        actions={(
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => navigate('/quotes/services')}>
              <ListChecks size={16} className="mr-2" />
              Servicios
            </Button>
            <Button onClick={() => navigate('/quotes/new')}>
              <Plus size={16} className="mr-2" />
              Nueva cotización
            </Button>
          </div>
        )}
      />

      <Card className="mt-8">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>Lista de cotizaciones</CardTitle>
          <div className="w-[220px]">
            <Select
              value={estado}
              onChange={(e) => {
                const next = new URLSearchParams(searchParams);
                if (e.target.value) next.set('estado', e.target.value);
                else next.delete('estado');
                setSearchParams(next);
              }}
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
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-[var(--gray-500)]">Cargando cotizaciones...</div>
          ) : quotes.length === 0 ? (
            <div className="p-12 text-center text-[var(--gray-500)]">
              No hay cotizaciones registradas con este filtro.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-[var(--gray-50)] text-[11px] font-bold text-[var(--gray-400)] uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3 text-left">Folio</th>
                  <th className="px-6 py-3 text-left">Cliente</th>
                  <th className="px-6 py-3 text-left">Origen</th>
                  <th className="px-6 py-3 text-center">Estado</th>
                  <th className="px-6 py-3 text-center">Versión</th>
                  <th className="px-6 py-3 text-right">Total</th>
                  <th className="px-6 py-3 text-right">Válido hasta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--gray-100)]">
                {quotes.map((quote) => (
                  <tr key={quote.id} className="hover:bg-[var(--gray-50)]">
                    <td className="px-6 py-3">
                      <Link to={`/quotes/${quote.id}`} className="font-bold text-[var(--color-brand-blue)] hover:underline">
                        {quote.folio}
                      </Link>
                    </td>
                    <td className="px-6 py-3">{quote.customer.nombre}</td>
                    <td className="px-6 py-3">
                      {quote.source_ticket ? (
                        <span className="text-[12px] font-medium text-[var(--gray-600)]">{quote.source_ticket.folio}</span>
                      ) : (
                        <span className="text-[12px] font-medium text-[var(--gray-400)]">Directa</span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-center">
                      <span className="inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold bg-[var(--gray-50)] border border-[var(--gray-200)]">
                        {quote.estado}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-center">v{quote.version}</td>
                    <td className="px-6 py-3 text-right font-bold">S/ {parseFloat(quote.total).toFixed(2)}</td>
                    <td className="px-6 py-3 text-right">{quote.valido_hasta || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <div className="mt-6 text-[12px] text-[var(--gray-400)] flex items-center gap-2">
        <FileText size={14} />
        Las cotizaciones enviadas o aprobadas no se editan; si cambian, se crea una nueva versión.
      </div>
    </div>
  );
}
