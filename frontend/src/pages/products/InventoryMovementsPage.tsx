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
import { getApiErrorMessage } from '../../lib/apiErrors';

const MOVEMENT_LABELS: Record<string, string> = {
  ENTRY: 'Entrada',
  EXIT: 'Salida',
  TRANSFER_OUT: 'Transferencia salida',
  TRANSFER_IN: 'Transferencia entrada',
  ADJUSTMENT_IN: 'Ajuste entrada',
  ADJUSTMENT_OUT: 'Ajuste salida',
  RETURN: 'Devolución',
};

const formatInteger = (value: string | number | null | undefined) => {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed.toFixed(0) : '0';
};

export default function InventoryMovementsPage() {
  const { data: movementResponse, isLoading } = useMovements({ page_size: 100 });
  const { data: stockItemsResponse } = useStockItems({ page_size: 200 });
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
    warehouse: '',
    stock_item: '',
    movement_type: 'ADJUSTMENT_IN',
    quantity: '1',
    notes: '',
  });
  const [transferForm, setTransferForm] = useState({
    source_warehouse: '',
    source_stock_item: '',
    destination_warehouse: '',
    quantity: '1',
    notes: '',
  });

  const adjustStockItems = useMemo(
    () => stockItems.filter((item) => !adjustForm.warehouse || String(item.warehouse) === adjustForm.warehouse),
    [stockItems, adjustForm.warehouse],
  );
  const transferStockItems = useMemo(
    () => stockItems.filter((item) => !transferForm.source_warehouse || String(item.warehouse) === transferForm.source_warehouse),
    [stockItems, transferForm.source_warehouse],
  );

  const handleAdjustSubmit = async () => {
    try {
      await adjustStock.mutateAsync({
        stock_item: parseInt(adjustForm.stock_item, 10),
        movement_type: adjustForm.movement_type,
        quantity: adjustForm.quantity,
        notes: adjustForm.notes,
      });
      setAdjustForm({
        warehouse: '',
        stock_item: '',
        movement_type: 'ADJUSTMENT_IN',
        quantity: '1',
        notes: '',
      });
    } catch (error) {
      alert(getApiErrorMessage(error, 'No se pudo registrar el ajuste.'));
    }
  };

  const handleTransferSubmit = async () => {
    try {
      await transferStock.mutateAsync({
        source_stock_item: parseInt(transferForm.source_stock_item, 10),
        destination_warehouse: parseInt(transferForm.destination_warehouse, 10),
        quantity: transferForm.quantity,
        notes: transferForm.notes,
      });
      setTransferForm({
        source_warehouse: '',
        source_stock_item: '',
        destination_warehouse: '',
        quantity: '1',
        notes: '',
      });
    } catch (error) {
      alert(getApiErrorMessage(error, 'No se pudo transferir el stock.'));
    }
  };

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
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <div className="md:col-span-4">
                <Label>Almacén</Label>
                <Select
                  value={adjustForm.warehouse}
                  onChange={(e) => setAdjustForm((prev) => ({
                    ...prev,
                    warehouse: e.target.value,
                    stock_item: '',
                  }))}
                >
                  <option value="">Selecciona almacén...</option>
                  {warehouses.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>{warehouse.nombre}</option>
                  ))}
                </Select>
              </div>
              <div className="md:col-span-5">
                <Label>Producto</Label>
                <Select
                  value={adjustForm.stock_item}
                  onChange={(e) => setAdjustForm((prev) => ({ ...prev, stock_item: e.target.value }))}
                >
                  <option value="">Selecciona producto...</option>
                  {adjustStockItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.product_name} · Disp. {formatInteger(item.disponible)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="md:col-span-3">
                <Label>Tipo</Label>
                <Select
                  value={adjustForm.movement_type}
                  onChange={(e) => setAdjustForm((prev) => ({ ...prev, movement_type: e.target.value }))}
                >
                  <option value="ADJUSTMENT_IN">Entrada</option>
                  <option value="ADJUSTMENT_OUT">Salida</option>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <div className="md:col-span-3">
                <Label>Cantidad</Label>
                <Input
                  type="number"
                  step="1"
                  min="1"
                  value={adjustForm.quantity}
                  onChange={(e) => setAdjustForm((prev) => ({ ...prev, quantity: e.target.value }))}
                />
              </div>
              <div className="md:col-span-9">
                <Label>Notas</Label>
                <Input
                  value={adjustForm.notes}
                  onChange={(e) => setAdjustForm((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="Motivo del ajuste"
                />
              </div>
            </div>

            <Button
              onClick={handleAdjustSubmit}
              disabled={!adjustForm.warehouse || !adjustForm.stock_item || adjustStock.isPending}
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
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <div className="md:col-span-4">
                <Label>Almacén origen</Label>
                <Select
                  value={transferForm.source_warehouse}
                  onChange={(e) => setTransferForm((prev) => ({
                    ...prev,
                    source_warehouse: e.target.value,
                    source_stock_item: '',
                  }))}
                >
                  <option value="">Selecciona origen...</option>
                  {warehouses.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>{warehouse.nombre}</option>
                  ))}
                </Select>
              </div>
              <div className="md:col-span-8">
                <Label>Producto</Label>
                <Select
                  value={transferForm.source_stock_item}
                  onChange={(e) => setTransferForm((prev) => ({ ...prev, source_stock_item: e.target.value }))}
                >
                  <option value="">Selecciona producto...</option>
                  {transferStockItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.product_name} · Disp. {formatInteger(item.disponible)}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <div className="md:col-span-8">
                <Label>Almacén destino</Label>
                <Select
                  value={transferForm.destination_warehouse}
                  onChange={(e) => setTransferForm((prev) => ({ ...prev, destination_warehouse: e.target.value }))}
                >
                  <option value="">Selecciona destino...</option>
                  {warehouses
                    .filter((warehouse) => String(warehouse.id) !== transferForm.source_warehouse)
                    .map((warehouse) => (
                      <option key={warehouse.id} value={warehouse.id}>{warehouse.nombre}</option>
                    ))}
                </Select>
              </div>
              <div className="md:col-span-4">
                <Label>Cantidad</Label>
                <Input
                  type="number"
                  step="1"
                  min="1"
                  value={transferForm.quantity}
                  onChange={(e) => setTransferForm((prev) => ({ ...prev, quantity: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <Label>Notas</Label>
              <Input
                value={transferForm.notes}
                onChange={(e) => setTransferForm((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="Motivo de la transferencia"
              />
            </div>

            <Button
              onClick={handleTransferSubmit}
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
                    <td className="px-6 py-4">{MOVEMENT_LABELS[movement.movement_type] || movement.movement_type}</td>
                    <td className="px-6 py-4">
                      {movement.warehouse_name}
                      {movement.destination_warehouse_name ? ` → ${movement.destination_warehouse_name}` : ''}
                    </td>
                    <td className="px-6 py-4 text-right font-bold">{formatInteger(movement.quantity)}</td>
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
