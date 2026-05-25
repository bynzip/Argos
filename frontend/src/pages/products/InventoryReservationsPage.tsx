import { useMemo, useState } from 'react';

import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { Select } from '../../components/ui/Select';
import {
  PaginatedResponse,
  StockReservation,
  useConsumeReservation,
  useDeliverReservation,
  useReleaseReservation,
  useReservations,
} from '../../hooks/useInventory';

export default function InventoryReservationsPage() {
  const [statusFilter, setStatusFilter] = useState('');
  const { data, isLoading } = useReservations({ estado: statusFilter || undefined, page_size: 100 });
  const releaseReservation = useReleaseReservation();
  const deliverReservation = useDeliverReservation();
  const consumeReservation = useConsumeReservation();

  const reservations = useMemo(() => (
    data && !Array.isArray(data) && 'results' in data
      ? (data as PaginatedResponse<StockReservation>).results
      : Array.isArray(data) ? data : []
  ), [data]);

  return (
    <div className="p-8 max-w-[1500px] mx-auto space-y-6">
      <PageHeader
        title="Reservas de Inventario"
        subtitle="Controla reservas activas, entregas físicas, consumos y liberaciones por ticket."
        actions={(
          <div className="w-[220px]">
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">Todos los estados</option>
              <option value="ACTIVE">Activas</option>
              <option value="CONSUMED">Consumidas</option>
              <option value="RELEASED">Liberadas</option>
            </Select>
          </div>
        )}
      />

      <Card>
        <CardHeader>
          <CardTitle>Historial</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center">Cargando reservas...</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-[var(--gray-50)] text-[11px] font-bold text-[var(--gray-400)] uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3 text-left">Ticket</th>
                  <th className="px-6 py-3 text-left">Producto</th>
                  <th className="px-6 py-3 text-left">Almacén</th>
                  <th className="px-6 py-3 text-right">Cantidad</th>
                  <th className="px-6 py-3 text-center">Estado</th>
                  <th className="px-6 py-3 text-center">Entrega física</th>
                  <th className="px-6 py-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--gray-100)]">
                {reservations.map((reservation) => (
                  <tr key={reservation.id}>
                    <td className="px-6 py-4 font-bold">{reservation.ticket.folio}</td>
                    <td className="px-6 py-4">
                      <div className="font-medium">{reservation.stock_item.product_name}</div>
                      <div className="text-xs text-[var(--gray-400)]">{reservation.stock_item.product_code}</div>
                    </td>
                    <td className="px-6 py-4">{reservation.stock_item.warehouse_name}</td>
                    <td className="px-6 py-4 text-right font-bold">{reservation.cantidad}</td>
                    <td className="px-6 py-4 text-center">{reservation.estado}</td>
                    <td className="px-6 py-4 text-center">
                      {reservation.entregado_el
                        ? new Date(reservation.entregado_el).toLocaleString()
                        : 'Pendiente'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        {reservation.estado === 'ACTIVE' && !reservation.entregado_el && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => deliverReservation.mutate({ id: reservation.id, notas: 'Entrega física confirmada al técnico.' })}
                          >
                            Confirmar entrega
                          </Button>
                        )}
                        {reservation.estado === 'ACTIVE' && (
                          <>
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => consumeReservation.mutate({ id: reservation.id })}
                            >
                              Consumir
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => releaseReservation.mutate({ id: reservation.id })}
                            >
                              Liberar
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {reservations.length === 0 && (
                  <tr>
                    <td className="px-6 py-8 text-center text-[var(--gray-400)]" colSpan={7}>
                      No hay reservas para mostrar.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
