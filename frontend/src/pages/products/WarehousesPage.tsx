import { useMemo } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { PaginatedResponse, useStockItems, useWarehouses, Warehouse } from '../../hooks/useInventory';

export default function WarehousesPage() {
  const { data: warehouseResponse, isLoading } = useWarehouses();
  const { data: stockResponse } = useStockItems({ page_size: 200 });

  const warehouses = useMemo(() => (
    warehouseResponse && !Array.isArray(warehouseResponse) && 'results' in warehouseResponse
      ? (warehouseResponse as PaginatedResponse<Warehouse>).results
      : Array.isArray(warehouseResponse) ? warehouseResponse : []
  ), [warehouseResponse]);
  const stockItems = stockResponse && !Array.isArray(stockResponse) && 'results' in stockResponse
    ? stockResponse.results
    : Array.isArray(stockResponse) ? stockResponse : [];

  return (
    <div className="p-8 max-w-[1400px] mx-auto space-y-6">
      <PageHeader
        title="Almacenes"
        subtitle="Vista rápida del inventario distribuido por almacén."
      />

      {isLoading ? (
        <div className="p-8 text-center">Cargando almacenes...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {warehouses.map((warehouse) => {
            const items = stockItems.filter((item) => item.warehouse === warehouse.id);
            const fisico = items.reduce((acc, item) => acc + parseFloat(item.cantidad), 0);
            const reservado = items.reduce((acc, item) => acc + parseFloat(item.reservado), 0);
            const disponible = items.reduce((acc, item) => acc + parseFloat(item.disponible), 0);

            return (
              <Card key={warehouse.id}>
                <CardHeader>
                  <CardTitle>{warehouse.nombre}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-sm text-[var(--gray-500)]">{warehouse.ubicacion || 'Sin ubicación detallada'}</div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-xl border border-[var(--gray-200)] bg-[var(--gray-50)] p-3">
                      <div className="text-[11px] text-[var(--gray-400)] uppercase font-bold">Físico</div>
                      <div className="text-xl font-black">{fisico.toFixed(3)}</div>
                    </div>
                    <div className="rounded-xl border border-[var(--gray-200)] bg-[var(--gray-50)] p-3">
                      <div className="text-[11px] text-[var(--gray-400)] uppercase font-bold">Reservado</div>
                      <div className="text-xl font-black">{reservado.toFixed(3)}</div>
                    </div>
                    <div className="rounded-xl border border-[var(--gray-200)] bg-[var(--gray-50)] p-3">
                      <div className="text-[11px] text-[var(--gray-400)] uppercase font-bold">Disponible</div>
                      <div className="text-xl font-black">{disponible.toFixed(3)}</div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {items.slice(0, 5).map((item) => (
                      <div key={item.id} className="flex justify-between text-sm border-b border-[var(--gray-100)] pb-2">
                        <span className="font-medium">{item.product_name}</span>
                        <span className="text-[var(--gray-500)]">Disp. {item.disponible}</span>
                      </div>
                    ))}
                    {items.length === 0 && (
                      <div className="text-sm text-[var(--gray-400)]">Sin stock registrado.</div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
