import { useMemo, useState } from 'react';

import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Label } from '../../components/ui/Label';
import { PageHeader } from '../../components/ui/PageHeader';
import { Select } from '../../components/ui/Select';
import {
  PaginatedResponse,
  InventoryMovement,
  useAdjustStock,
  useMovements,
  useStockItems,
  useTransferStock,
  useWarehouses,
} from '../../hooks/useInventory';

export default function InventoryMovementsPage() {
  const { data: movementResponse, isLoading } = useMovements({ page_size: 100 });
  const { data: stockItemsResponse } = useStockItems({ page_size: 100 });
  const { data: warehousesResponse } = useWarehouses();
  const adjustStock = useAdjustStock();
  const transferStock = useTransferStock();

  const movements = useMemo(() => (
    movementResponse && !Array.isArray(movementResponse) && 'results' in movementResponse
      ? (movementResponse as PaginatedResponse<InventoryMovement>).results
      : Array.isArray(movementResponse) ? movementResponse : []
  ), [movementResponse]);

  const stockItems = stockItemsResponse && !Array.isArray(stockItemsResponse) && 'results' in stockItemsResponse
    ? stockItemsResponse.results
    : Array.isArray(stockItemsResponse) ? stockItemsResponse : [];
  const warehouses = warehousesResponse && !Array.isArray(warehousesResponse) && 'results' in warehousesResponse
    ? warehousesResponse.results
    : Array.isArray(warehousesResponse) ? warehousesResponse : [];

  const [adjustForm, setAdjustForm] = useState({
    stock_item: '',
    movement_type: 'ADJUSTMENT_IN',
    quantity: '1.000',
    notes: '',
    unit_cost: '',
  });
  const [transferForm, setTransferForm] = useState({
    source_stock_item: '',
    destination_warehouse: '',
    quantity: '1.000',
    notes: '',
  });

  return (
    <div className="p-8 max-w-[1500px] mx-auto space-y-6">
      <PageHeader
        title="Movimientos y Kardex"
        subtitle="Ajustes, transferencias y trazabilidad del inventario real."
      />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Ajuste manual</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Stock item</Label>
              <Select value={adjustForm.stock_item} onChange={(e) => setAdjustForm((prev) => ({ ...prev, stock_item: e.target.value }))}>
                <option value="">Selecciona stock...</option>
                {stockItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.product_name} · {item.warehouse_name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tipo</Label>
                <Select value={adjustForm.movement_type} onChange={(e) => setAdjustForm((prev) => ({ ...prev, movement_type: e.target.value }))}>
                  <option value="ADJUSTMENT_IN">Ajuste entrada</option>
                  <option value="ADJUSTMENT_OUT">Ajuste salida</option>
                </Select>
              </div>
              <div>
                <Label>Cantidad</Label>
                <Input type="number" step="0.001" value={adjustForm.quantity} onChange={(e) => setAdjustForm((prev) => ({ ...prev, quantity: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Costo unitario (opcional)</Label>
              <Input type="number" step="0.0001" value={adjustForm.unit_cost} onChange={(e) => setAdjustForm((prev) => ({ ...prev, unit_cost: e.target.value }))} />
            </div>
            <div>
              <Label>Notas</Label>
              <Input value={adjustForm.notes} onChange={(e) => setAdjustForm((prev) => ({ ...prev, notes: e.target.value }))} />
            </div>
            <Button
              onClick={() => adjustStock.mutate({
                ...adjustForm,
                stock_item: parseInt(adjustForm.stock_item),
                unit_cost: adjustForm.unit_cost || undefined,
              })}
              disabled={!adjustForm.stock_item || !adjustForm.notes || adjustStock.isPending}
            >
              Registrar ajuste
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Transferencia entre almacenes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Stock origen</Label>
              <Select value={transferForm.source_stock_item} onChange={(e) => setTransferForm((prev) => ({ ...prev, source_stock_item: e.target.value }))}>
                <option value="">Selecciona origen...</option>
                {stockItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.product_name} · {item.warehouse_name} · Disp. {item.disponible}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Almacén destino</Label>
              <Select value={transferForm.destination_warehouse} onChange={(e) => setTransferForm((prev) => ({ ...prev, destination_warehouse: e.target.value }))}>
                <option value="">Selecciona destino...</option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>{warehouse.nombre}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Cantidad</Label>
              <Input type="number" step="0.001" value={transferForm.quantity} onChange={(e) => setTransferForm((prev) => ({ ...prev, quantity: e.target.value }))} />
            </div>
            <div>
              <Label>Notas</Label>
              <Input value={transferForm.notes} onChange={(e) => setTransferForm((prev) => ({ ...prev, notes: e.target.value }))} />
            </div>
            <Button
              onClick={() => transferStock.mutate({
                source_stock_item: parseInt(transferForm.source_stock_item),
                destination_warehouse: parseInt(transferForm.destination_warehouse),
                quantity: transferForm.quantity,
                notes: transferForm.notes,
              })}
              disabled={!transferForm.source_stock_item || !transferForm.destination_warehouse || transferStock.isPending}
            >
              Transferir stock
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Historial de movimientos</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center">Cargando movimientos...</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-[var(--gray-50)] text-[11px] font-bold text-[var(--gray-400)] uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3 text-left">Fecha</th>
                  <th className="px-6 py-3 text-left">Producto</th>
                  <th className="px-6 py-3 text-left">Tipo</th>
                  <th className="px-6 py-3 text-left">Almacén</th>
                  <th className="px-6 py-3 text-right">Cantidad</th>
                  <th className="px-6 py-3 text-left">Referencia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--gray-100)]">
                {movements.map((movement) => (
                  <tr key={movement.id}>
                    <td className="px-6 py-4">{new Date(movement.created_at).toLocaleString()}</td>
                    <td className="px-6 py-4">
                      <div className="font-bold">{movement.product_name}</div>
                      <div className="text-xs text-[var(--gray-400)]">{movement.product_code}</div>
                    </td>
                    <td className="px-6 py-4">{movement.movement_type}</td>
                    <td className="px-6 py-4">
                      {movement.warehouse_name}
                      {movement.destination_warehouse_name ? ` → ${movement.destination_warehouse_name}` : ''}
                    </td>
                    <td className="px-6 py-4 text-right font-bold">{movement.quantity}</td>
                    <td className="px-6 py-4 text-xs text-[var(--gray-500)]">
                      {movement.reference_type || '—'} {movement.reference_id || ''}
                    </td>
                  </tr>
                ))}
                {movements.length === 0 && (
                  <tr>
                    <td className="px-6 py-8 text-center text-[var(--gray-400)]" colSpan={6}>
                      No hay movimientos registrados todavía.
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
