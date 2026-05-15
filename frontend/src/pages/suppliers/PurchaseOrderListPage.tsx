import { useMemo, useState } from 'react';

import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Label } from '../../components/ui/Label';
import { PageHeader } from '../../components/ui/PageHeader';
import { Select } from '../../components/ui/Select';
import { useWarehouses } from '../../hooks/useInventory';
import { useCreatePurchaseOrder, usePurchaseOrders, usePurchaseSuggestions, useSendPurchaseOrder, useSuppliers } from '../../hooks/useSuppliers';

export default function PurchaseOrderListPage() {
  const { data: suppliers } = useSuppliers();
  const { data: warehousesData } = useWarehouses();
  const { data: orders, isLoading } = usePurchaseOrders();
  const { data: suggestions } = usePurchaseSuggestions();
  const createPurchaseOrder = useCreatePurchaseOrder();
  const sendPurchaseOrder = useSendPurchaseOrder();

  const warehouses = useMemo(
    () => (Array.isArray(warehousesData) ? warehousesData : warehousesData?.results || []),
    [warehousesData],
  );

  const [supplierId, setSupplierId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [cantidad, setCantidad] = useState('1');
  const [precio, setPrecio] = useState('0.00');

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId || !warehouseId || !selectedProductId) return;

    createPurchaseOrder.mutate({
      supplier: Number(supplierId),
      destination_warehouse: Number(warehouseId),
      items: [
        {
          product: Number(selectedProductId),
          cantidad_pedida: cantidad,
          precio_unitario: precio,
        },
      ],
    });
  };

  return (
    <div className="p-8 max-w-[1280px] mx-auto space-y-8">
      <PageHeader title="Órdenes de compra" subtitle="Compras, recepción y abastecimiento guiado por faltantes." />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Nueva orden rápida</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <Label required>Proveedor</Label>
                <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                  <option value="">Selecciona</option>
                  {(suppliers || []).map((supplier: any) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.nombre}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label required>Almacén destino</Label>
                <Select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
                  <option value="">Selecciona</option>
                  {warehouses.map((warehouse: any) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.nombre}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label required>Producto sugerido</Label>
                <Select value={selectedProductId} onChange={(e) => setSelectedProductId(e.target.value)}>
                  <option value="">Selecciona</option>
                  {(suggestions || []).map((item: any) => (
                    <option key={item.product_id} value={item.product_id}>
                      {item.product_code} - {item.product_name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Cantidad</Label>
                  <Input value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
                </div>
                <div>
                  <Label>Precio unitario</Label>
                  <Input value={precio} onChange={(e) => setPrecio(e.target.value)} />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={createPurchaseOrder.isPending}>
                {createPurchaseOrder.isPending ? 'Creando...' : 'Crear orden'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Faltantes sugeridos</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(suggestions || []).slice(0, 8).map((item: any) => (
                <button
                  key={item.product_id}
                  type="button"
                  onClick={() => {
                    setSelectedProductId(String(item.product_id));
                    setCantidad(String(item.suggested_quantity));
                  }}
                  className="text-left p-4 rounded-xl border border-[var(--gray-200)] hover:border-[var(--color-brand-blue)] hover:bg-[var(--color-info-bg)] transition-all"
                >
                  <div className="font-bold text-[var(--gray-800)]">{item.product_name}</div>
                  <div className="text-[12px] text-[var(--gray-500)]">{item.product_code}</div>
                  <div className="mt-2 text-[12px] text-[var(--color-danger)] font-semibold">
                    Disponible: {item.available} | Sugerido: {item.suggested_quantity}
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Órdenes registradas</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {isLoading ? (
            <div className="p-8 text-center text-[var(--gray-500)]">Cargando órdenes...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-[11px] uppercase text-[var(--gray-400)]">
                  <tr>
                    <th className="text-left py-3">Folio</th>
                    <th className="text-left py-3">Proveedor</th>
                    <th className="text-left py-3">Estado</th>
                    <th className="text-right py-3">Subtotal</th>
                    <th className="text-right py-3">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--gray-100)]">
                  {(orders || []).map((order: any) => (
                    <tr key={order.id}>
                      <td className="py-3 font-bold text-[var(--color-brand-blue)]">{order.folio}</td>
                      <td className="py-3">{order.supplier?.nombre || '-'}</td>
                      <td className="py-3">{order.estado}</td>
                      <td className="py-3 text-right">S/ {parseFloat(order.subtotal || 0).toFixed(2)}</td>
                      <td className="py-3 text-right">
                        {order.estado === 'DRAFT' && (
                          <Button size="sm" variant="secondary" onClick={() => sendPurchaseOrder.mutate(order.id)}>
                            Enviar
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
