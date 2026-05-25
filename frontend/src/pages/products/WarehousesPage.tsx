import { useMemo, useState } from 'react';
import {
  ArrowRightLeft,
  Ban,
  Download,
  History,
  MapPin,
  Package,
  PencilLine,
  Plus,
  SlidersHorizontal,
  Trash2,
  Warehouse,
  X,
} from 'lucide-react';

import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Label } from '../../components/ui/Label';
import { PageHeader } from '../../components/ui/PageHeader';
import { Select } from '../../components/ui/Select';
import { Textarea } from '../../components/ui/Textarea';
import {
  InventoryMovement,
  PaginatedResponse,
  StockItem,
  Warehouse as WarehouseType,
  useAdjustStock,
  useCreateWarehouse,
  useDeleteWarehouse,
  useHardDeleteWarehouse,
  useMovements,
  useRestoreWarehouse,
  useStockItems,
  useTransferStock,
  useUpdateWarehouse,
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
  RETURN: 'Devolucion',
};

const formatInteger = (value: string | number | null | undefined) => {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed.toFixed(0) : '0';
};

const formatMovementDate = (value?: string | null) => {
  if (!value) return '-';
  return new Date(value).toLocaleString('es-PE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

type WarehouseFormState = {
  nombre: string;
  ubicacion: string;
};

type AdjustFormState = {
  warehouse: string;
  stock_item: string;
  movement_type: string;
  quantity: string;
  notes: string;
};

type TransferFormState = {
  source_warehouse: string;
  source_stock_item: string;
  destination_warehouse: string;
  quantity: string;
  notes: string;
};

const EMPTY_WAREHOUSE_FORM: WarehouseFormState = {
  nombre: '',
  ubicacion: '',
};

const EMPTY_ADJUST_FORM: AdjustFormState = {
  warehouse: '',
  stock_item: '',
  movement_type: 'ADJUSTMENT_IN',
  quantity: '1',
  notes: '',
};

const EMPTY_TRANSFER_FORM: TransferFormState = {
  source_warehouse: '',
  source_stock_item: '',
  destination_warehouse: '',
  quantity: '1',
  notes: '',
};

export default function WarehousesPage() {
  const { data: warehouseResponse, isLoading } = useWarehouses({ include_inactive: 'true' });
  const { data: stockResponse } = useStockItems({ page_size: 300 });
  const { data: movementResponse, isLoading: isLoadingMovements } = useMovements({ page_size: 200 });
  const createWarehouse = useCreateWarehouse();
  const updateWarehouse = useUpdateWarehouse();
  const deleteWarehouse = useDeleteWarehouse();
  const hardDeleteWarehouse = useHardDeleteWarehouse();
  const restoreWarehouse = useRestoreWarehouse();
  const adjustStock = useAdjustStock();
  const transferStock = useTransferStock();

  const warehouses = useMemo(() => {
    const raw = warehouseResponse && !Array.isArray(warehouseResponse) && 'results' in warehouseResponse
      ? (warehouseResponse as PaginatedResponse<WarehouseType>).results
      : Array.isArray(warehouseResponse) ? warehouseResponse : [];

    return [...raw].sort((left, right) => {
      const leftInactive = Boolean(left.deleted_at);
      const rightInactive = Boolean(right.deleted_at);
      if (leftInactive !== rightInactive) {
        return leftInactive ? 1 : -1;
      }
      return left.nombre.localeCompare(right.nombre);
    });
  }, [warehouseResponse]);

  const stockItems = useMemo(() => (
    stockResponse && !Array.isArray(stockResponse) && 'results' in stockResponse
      ? stockResponse.results
      : Array.isArray(stockResponse) ? stockResponse : []
  ), [stockResponse]);

  const movements = useMemo(() => {
    const raw = movementResponse && !Array.isArray(movementResponse) && 'results' in movementResponse
      ? (movementResponse as PaginatedResponse<InventoryMovement>).results
      : Array.isArray(movementResponse) ? movementResponse : [];

    return [...raw].sort(
      (left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
    );
  }, [movementResponse]);

  const recentMovements = movements.slice(0, 10);
  const activeWarehouses = useMemo(
    () => warehouses.filter((warehouse) => !warehouse.deleted_at),
    [warehouses],
  );

  const [editingWarehouseId, setEditingWarehouseId] = useState<number | null>(null);
  const [warehouseModalOpen, setWarehouseModalOpen] = useState(false);
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [movementsModalOpen, setMovementsModalOpen] = useState(false);
  const [productsWarehouse, setProductsWarehouse] = useState<WarehouseType | null>(null);
  const [warehouseForm, setWarehouseForm] = useState<WarehouseFormState>(EMPTY_WAREHOUSE_FORM);
  const [adjustForm, setAdjustForm] = useState<AdjustFormState>(EMPTY_ADJUST_FORM);
  const [transferForm, setTransferForm] = useState<TransferFormState>(EMPTY_TRANSFER_FORM);
  const [warehouseError, setWarehouseError] = useState<string | null>(null);
  const [adjustError, setAdjustError] = useState<string | null>(null);
  const [transferError, setTransferError] = useState<string | null>(null);

  const adjustStockItems = useMemo(
    () => stockItems.filter((item) => !adjustForm.warehouse || String(item.warehouse) === adjustForm.warehouse),
    [stockItems, adjustForm.warehouse],
  );

  const transferStockItems = useMemo(
    () => stockItems.filter((item) => !transferForm.source_warehouse || String(item.warehouse) === transferForm.source_warehouse),
    [stockItems, transferForm.source_warehouse],
  );

  const selectedWarehouseProducts = useMemo(() => {
    if (!productsWarehouse) return [];
    return stockItems
      .filter((item) => item.warehouse === productsWarehouse.id)
      .sort((left, right) => left.product_name.localeCompare(right.product_name));
  }, [productsWarehouse, stockItems]);

  const openCreateWarehouseModal = () => {
    setEditingWarehouseId(null);
    setWarehouseForm(EMPTY_WAREHOUSE_FORM);
    setWarehouseError(null);
    setWarehouseModalOpen(true);
  };

  const openEditWarehouseModal = (warehouse: WarehouseType) => {
    setEditingWarehouseId(warehouse.id);
    setWarehouseForm({
      nombre: warehouse.nombre,
      ubicacion: warehouse.ubicacion || '',
    });
    setWarehouseError(null);
    setWarehouseModalOpen(true);
  };

  const closeWarehouseModal = () => {
    setWarehouseModalOpen(false);
    setEditingWarehouseId(null);
    setWarehouseForm(EMPTY_WAREHOUSE_FORM);
    setWarehouseError(null);
  };

  const closeAdjustModal = () => {
    setAdjustModalOpen(false);
    setAdjustForm(EMPTY_ADJUST_FORM);
    setAdjustError(null);
  };

  const closeTransferModal = () => {
    setTransferModalOpen(false);
    setTransferForm(EMPTY_TRANSFER_FORM);
    setTransferError(null);
  };

  const handleWarehouseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setWarehouseError(null);

    if (!warehouseForm.nombre.trim()) {
      setWarehouseError('El nombre del almacen es obligatorio.');
      return;
    }

    try {
      if (editingWarehouseId) {
        await updateWarehouse.mutateAsync({
          id: editingWarehouseId,
          nombre: warehouseForm.nombre.trim(),
          ubicacion: warehouseForm.ubicacion.trim(),
        });
      } else {
        await createWarehouse.mutateAsync({
          nombre: warehouseForm.nombre.trim(),
          ubicacion: warehouseForm.ubicacion.trim(),
        });
      }
      closeWarehouseModal();
    } catch (error) {
      setWarehouseError(getApiErrorMessage(error, 'No se pudo guardar el almacen.'));
    }
  };

  const handleWarehouseStatusToggle = async (warehouse: WarehouseType) => {
    const isInactive = Boolean(warehouse.deleted_at);
    const actionLabel = isInactive ? 'reactivar' : 'desactivar';
    if (!window.confirm(`Deseas ${actionLabel} ${warehouse.nombre}?`)) return;

    try {
      if (isInactive) {
        await restoreWarehouse.mutateAsync({ id: warehouse.id });
      } else {
        await deleteWarehouse.mutateAsync({ id: warehouse.id });
      }
    } catch (error) {
      window.alert(getApiErrorMessage(error, `No se pudo ${actionLabel} el almacen.`));
    }
  };

  const handleWarehouseHardDelete = async (warehouse: WarehouseType) => {
    const warehouseItems = stockItems.filter((item) => item.warehouse === warehouse.id);
    if (warehouseItems.length > 0) {
      window.alert('Vacía el almacén antes de eliminarlo.');
      return;
    }
    if (!window.confirm(`Deseas eliminar definitivamente ${warehouse.nombre}?`)) return;

    try {
      await hardDeleteWarehouse.mutateAsync({ id: warehouse.id });
    } catch (error) {
      window.alert(getApiErrorMessage(error, 'No se pudo eliminar el almacen.'));
    }
  };

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdjustError(null);

    if (!adjustForm.warehouse || !adjustForm.stock_item || Number(adjustForm.quantity) < 1) {
      setAdjustError('Selecciona almacen, producto y una cantidad valida.');
      return;
    }

    try {
      await adjustStock.mutateAsync({
        stock_item: parseInt(adjustForm.stock_item, 10),
        movement_type: adjustForm.movement_type,
        quantity: String(Math.max(1, Math.floor(Number(adjustForm.quantity)))),
        notes: adjustForm.notes,
      });
      closeAdjustModal();
    } catch (error) {
      setAdjustError(getApiErrorMessage(error, 'No se pudo registrar el ajuste.'));
    }
  };

  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTransferError(null);

    if (!transferForm.source_stock_item || !transferForm.destination_warehouse || Number(transferForm.quantity) < 1) {
      setTransferError('Completa origen, producto, destino y una cantidad valida.');
      return;
    }

    try {
      await transferStock.mutateAsync({
        source_stock_item: parseInt(transferForm.source_stock_item, 10),
        destination_warehouse: parseInt(transferForm.destination_warehouse, 10),
        quantity: String(Math.max(1, Math.floor(Number(transferForm.quantity)))),
        notes: transferForm.notes,
      });
      closeTransferModal();
    } catch (error) {
      setTransferError(getApiErrorMessage(error, 'No se pudo transferir el stock.'));
    }
  };

  const renderMovementsTable = (rows: InventoryMovement[]) => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b border-[var(--gray-100)] bg-[var(--gray-50)] text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--gray-400)]">
          <tr>
            <th className="px-5 py-3 text-left">Fecha</th>
            <th className="px-5 py-3 text-left">Producto</th>
            <th className="px-5 py-3 text-left">Tipo</th>
            <th className="px-5 py-3 text-left">Almacen</th>
            <th className="px-5 py-3 text-right">Cantidad</th>
            <th className="px-5 py-3 text-left">Referencia</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--gray-100)]">
          {rows.map((movement) => (
            <tr key={movement.id} className="hover:bg-[var(--gray-50)]/70">
              <td className="px-5 py-4 text-[var(--gray-600)]">{formatMovementDate(movement.created_at)}</td>
              <td className="px-5 py-4">
                <div className="font-semibold text-[var(--gray-800)]">{movement.product_name}</div>
                <div className="text-xs text-[var(--gray-400)]">{movement.product_code}</div>
              </td>
              <td className="px-5 py-4 text-[var(--gray-700)]">
                {MOVEMENT_LABELS[movement.movement_type] || movement.movement_type}
              </td>
              <td className="px-5 py-4 text-[var(--gray-600)]">
                {movement.warehouse_name}
                {movement.destination_warehouse_name ? ` -> ${movement.destination_warehouse_name}` : ''}
              </td>
              <td className="px-5 py-4 text-right font-bold text-[var(--gray-800)]">
                {formatInteger(movement.quantity)}
              </td>
              <td className="px-5 py-4 text-xs text-[var(--gray-500)]">
                {movement.reference_type || '-'} {movement.reference_id || ''}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td className="px-5 py-8 text-center text-[var(--gray-400)]" colSpan={6}>
                No hay movimientos registrados todavia.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="mx-auto max-w-[1500px] space-y-8 p-8">
      <PageHeader
        title="Almacenes"
        subtitle="Controla los almacenes, sus existencias y los movimientos mas recientes."
        actions={(
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setAdjustModalOpen(true)}>
              <SlidersHorizontal size={16} className="mr-2" />
              Ajuste manual
            </Button>
            <Button variant="secondary" onClick={() => setTransferModalOpen(true)}>
              <ArrowRightLeft size={16} className="mr-2" />
              Transferencia
            </Button>
            <Button onClick={openCreateWarehouseModal}>
              <Plus size={16} className="mr-2" />
              Crear almacen
            </Button>
          </div>
        )}
      />

      {isLoading ? (
        <div className="rounded-2xl border border-[var(--gray-200)] bg-white p-12 text-center text-[var(--gray-500)]">
          Cargando almacenes...
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {warehouses.map((warehouse) => {
            const isInactive = Boolean(warehouse.deleted_at);
            const items = stockItems.filter((item) => item.warehouse === warehouse.id);
            const fisico = items.reduce((acc, item) => acc + Number(item.cantidad || 0), 0);
            const reservado = items.reduce((acc, item) => acc + Number(item.reservado || 0), 0);
            const disponible = items.reduce((acc, item) => acc + Number(item.disponible || 0), 0);

            return (
              <Card
                key={warehouse.id}
                className={`overflow-hidden border-[var(--gray-200)] ${isInactive ? 'opacity-65' : ''}`}
              >
                <CardHeader className={`border-b border-[var(--gray-100)] px-5 py-5 ${isInactive ? 'bg-[var(--gray-50)]' : 'bg-[var(--gray-50)]/70'}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${isInactive ? 'bg-[var(--gray-100)] text-[var(--gray-500)]' : 'bg-[var(--color-info-bg)] text-[var(--color-brand-blue)]'}`}>
                        <Warehouse size={18} />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <CardTitle>{warehouse.nombre}</CardTitle>
                          {isInactive && (
                            <span className="inline-flex rounded-full border border-[var(--gray-200)] bg-white px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.04em] text-[var(--gray-500)]">
                              Inactivo
                            </span>
                          )}
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-xs text-[var(--gray-500)]">
                          <MapPin size={12} />
                          <span>{warehouse.ubicacion || 'Sin ubicacion detallada'}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {!isInactive && (
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="text-[var(--gray-700)] hover:bg-[var(--gray-100)] hover:text-[var(--gray-800)]"
                          onClick={() => openEditWarehouseModal(warehouse)}
                          title="Editar almacen"
                        >
                          <PencilLine size={16} />
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className={isInactive
                          ? 'text-[var(--color-success)] hover:bg-[var(--color-success-bg)] hover:text-[var(--color-success)]'
                          : 'text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)] hover:text-[var(--color-danger)]'}
                        onClick={() => handleWarehouseStatusToggle(warehouse)}
                        title={isInactive ? 'Reactivar almacen' : 'Desactivar almacen'}
                      >
                        <Ban size={16} />
                      </Button>
                      {isInactive && (
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)] hover:text-[var(--color-danger)]"
                          onClick={() => handleWarehouseHardDelete(warehouse)}
                          title="Eliminar almacen"
                        >
                          <Trash2 size={16} />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 pt-5">
                  <div className="grid grid-cols-3 gap-3">
                    <div className={`rounded-xl border p-3 text-center ${isInactive ? 'border-[var(--gray-200)] bg-[var(--gray-50)]' : 'border-[var(--color-info-border)] bg-[#f4f9ff]'}`}>
                      <div className={`text-[10px] font-black uppercase tracking-[0.06em] ${isInactive ? 'text-[var(--gray-500)]' : 'text-[var(--color-brand-blue)]'}`}>Fisico</div>
                      <div className={`mt-1 text-2xl font-black ${isInactive ? 'text-[var(--gray-700)]' : 'text-[var(--color-brand-blue)]'}`}>{formatInteger(fisico)}</div>
                    </div>
                    <div className={`rounded-xl border p-3 text-center ${isInactive ? 'border-[var(--gray-200)] bg-[var(--gray-50)]' : 'border-[var(--color-warning-border)] bg-[#fffaf3]'}`}>
                      <div className={`text-[10px] font-black uppercase tracking-[0.06em] ${isInactive ? 'text-[var(--gray-500)]' : 'text-[var(--color-warning)]'}`}>Reservado</div>
                      <div className={`mt-1 text-2xl font-black ${isInactive ? 'text-[var(--gray-700)]' : 'text-[var(--color-warning)]'}`}>{formatInteger(reservado)}</div>
                    </div>
                    <div className={`rounded-xl border p-3 text-center ${isInactive ? 'border-[var(--gray-200)] bg-[var(--gray-50)]' : 'border-[var(--color-success-border)] bg-[#f5fcf7]'}`}>
                      <div className={`text-[10px] font-black uppercase tracking-[0.06em] ${isInactive ? 'text-[var(--gray-500)]' : 'text-[var(--color-success)]'}`}>Disponible</div>
                      <div className={`mt-1 text-2xl font-black ${isInactive ? 'text-[var(--gray-700)]' : 'text-[var(--color-success)]'}`}>{formatInteger(disponible)}</div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[var(--gray-200)] bg-white p-4">
                    <div className="mb-3 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.06em] text-[var(--gray-500)]">
                      <Package size={13} className="text-[var(--gray-400)]" />
                      <span>Resumen rapido</span>
                    </div>
                    <div className="space-y-2">
                      {items.slice(0, 3).map((item: StockItem) => (
                        <div key={item.id} className="flex items-center justify-between rounded-xl border border-[var(--gray-100)] bg-[var(--gray-50)] px-3 py-2">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-[var(--gray-800)]">{item.product_name}</div>
                            <div className="text-[11px] text-[var(--gray-400)]">{item.product_code}</div>
                          </div>
                          <div className="text-sm font-bold text-[var(--gray-700)]">
                            {formatInteger(item.disponible)}
                          </div>
                        </div>
                      ))}
                      {items.length === 0 && (
                        <div className="rounded-xl border border-dashed border-[var(--gray-200)] bg-[var(--gray-50)] px-3 py-4 text-sm text-[var(--gray-400)]">
                          Sin stock registrado en este almacen.
                        </div>
                      )}
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full"
                    onClick={() => setProductsWarehouse(warehouse)}
                  >
                    Ver todos los productos del almacen
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Card className="overflow-hidden border-[var(--gray-200)]">
        <CardHeader className="flex flex-row items-center justify-between gap-4 border-b border-[var(--gray-100)] bg-[var(--gray-50)]/70 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
              <History size={18} />
            </div>
            <div>
              <CardTitle>Ultimos movimientos</CardTitle>
              <div className="mt-1 text-xs text-[var(--gray-400)]">
                Vista rapida de los 10 movimientos mas recientes
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setMovementsModalOpen(true)}>
              Ver todos los movimientos
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoadingMovements ? (
            <div className="p-10 text-center text-[var(--gray-500)]">Cargando movimientos...</div>
          ) : renderMovementsTable(recentMovements)}
        </CardContent>
      </Card>

      {warehouseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,22,35,0.45)] p-4 backdrop-blur-sm">
          <Card className="w-full max-w-xl overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-[var(--gray-100)] bg-[var(--gray-50)]/70 px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                  <Warehouse size={18} />
                </div>
                <div>
                  <CardTitle>{editingWarehouseId ? 'Editar almacen' : 'Crear almacen'}</CardTitle>
                  <div className="mt-1 text-xs text-[var(--gray-400)]">
                    {editingWarehouseId ? 'Actualiza los datos del almacen seleccionado.' : 'Registra un nuevo almacen para distribuir el inventario.'}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={closeWarehouseModal}
                className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-[var(--gray-200)] text-[var(--gray-400)] transition-colors hover:border-[var(--gray-300)] hover:text-[var(--gray-700)]"
              >
                <X size={18} />
              </button>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleWarehouseSubmit} className="space-y-5">
                {warehouseError && (
                  <div className="rounded-xl border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] px-4 py-3 text-sm font-medium text-[var(--color-danger)]">
                    {warehouseError}
                  </div>
                )}

                <div>
                  <Label required>Nombre</Label>
                  <Input
                    value={warehouseForm.nombre}
                    onChange={(e) => setWarehouseForm((prev) => ({ ...prev, nombre: e.target.value }))}
                    placeholder="Almacen Principal"
                  />
                </div>

                <div>
                  <Label>Ubicacion</Label>
                  <Input
                    value={warehouseForm.ubicacion}
                    onChange={(e) => setWarehouseForm((prev) => ({ ...prev, ubicacion: e.target.value }))}
                    placeholder="Sede Central / Piso 1"
                  />
                </div>

                <div className="flex justify-end">
                  <Button type="submit" disabled={createWarehouse.isPending || updateWarehouse.isPending}>
                    {editingWarehouseId ? 'Guardar cambios' : 'Crear almacen'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {adjustModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,22,35,0.45)] p-4 backdrop-blur-sm">
          <Card className="w-full max-w-2xl overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-[var(--gray-100)] bg-[var(--gray-50)]/70 px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                  <SlidersHorizontal size={18} />
                </div>
                <div>
                  <CardTitle>Ajuste manual</CardTitle>
                  <div className="mt-1 text-xs text-[var(--gray-400)]">
                    Corrige entradas o salidas manuales sin salir de almacenes.
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={closeAdjustModal}
                className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-[var(--gray-200)] text-[var(--gray-400)] transition-colors hover:border-[var(--gray-300)] hover:text-[var(--gray-700)]"
              >
                <X size={18} />
              </button>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleAdjustSubmit} className="space-y-5">
                {adjustError && (
                  <div className="rounded-xl border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] px-4 py-3 text-sm font-medium text-[var(--color-danger)]">
                    {adjustError}
                  </div>
                )}

                <div>
                  <Label>Almacen</Label>
                  <Select
                    value={adjustForm.warehouse}
                    onChange={(e) => setAdjustForm((prev) => ({ ...prev, warehouse: e.target.value, stock_item: '' }))}
                  >
                    <option value="">Selecciona almacen...</option>
                    {activeWarehouses.map((warehouse) => (
                      <option key={warehouse.id} value={warehouse.id}>{warehouse.nombre}</option>
                    ))}
                  </Select>
                </div>

                <div>
                  <Label>Producto</Label>
                  <Select
                    value={adjustForm.stock_item}
                    onChange={(e) => setAdjustForm((prev) => ({ ...prev, stock_item: e.target.value }))}
                  >
                    <option value="">Selecciona producto...</option>
                    {adjustStockItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.product_name} - Disp. {formatInteger(item.disponible)}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_160px]">
                  <div>
                    <Label>Tipo</Label>
                    <Select
                      value={adjustForm.movement_type}
                      onChange={(e) => setAdjustForm((prev) => ({ ...prev, movement_type: e.target.value }))}
                    >
                      <option value="ADJUSTMENT_IN">Entrada</option>
                      <option value="ADJUSTMENT_OUT">Salida</option>
                    </Select>
                  </div>
                  <div>
                    <Label>Cantidad</Label>
                    <Input
                      type="number"
                      step="1"
                      min="1"
                      value={adjustForm.quantity}
                      onChange={(e) => setAdjustForm((prev) => ({ ...prev, quantity: e.target.value }))}
                    />
                  </div>
                </div>

                <div>
                  <Label>Notas</Label>
                  <Textarea
                    rows={3}
                    value={adjustForm.notes}
                    onChange={(e) => setAdjustForm((prev) => ({ ...prev, notes: e.target.value }))}
                    placeholder="Motivo del ajuste manual"
                  />
                </div>

                <div className="flex justify-end">
                  <Button type="submit" disabled={adjustStock.isPending}>
                    Registrar ajuste
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {transferModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,22,35,0.45)] p-4 backdrop-blur-sm">
          <Card className="w-full max-w-2xl overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-[var(--gray-100)] bg-[var(--gray-50)]/70 px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                  <ArrowRightLeft size={18} />
                </div>
                <div>
                  <CardTitle>Transferencia entre almacenes</CardTitle>
                  <div className="mt-1 text-xs text-[var(--gray-400)]">
                    Mueve stock entre almacenes desde esta misma pantalla.
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={closeTransferModal}
                className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-[var(--gray-200)] text-[var(--gray-400)] transition-colors hover:border-[var(--gray-300)] hover:text-[var(--gray-700)]"
              >
                <X size={18} />
              </button>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleTransferSubmit} className="space-y-5">
                {transferError && (
                  <div className="rounded-xl border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] px-4 py-3 text-sm font-medium text-[var(--color-danger)]">
                    {transferError}
                  </div>
                )}

                <div>
                  <Label>Almacen origen</Label>
                  <Select
                    value={transferForm.source_warehouse}
                    onChange={(e) => setTransferForm((prev) => ({
                      ...prev,
                      source_warehouse: e.target.value,
                      source_stock_item: '',
                      destination_warehouse: '',
                    }))}
                  >
                    <option value="">Selecciona origen...</option>
                    {activeWarehouses.map((warehouse) => (
                      <option key={warehouse.id} value={warehouse.id}>{warehouse.nombre}</option>
                    ))}
                  </Select>
                </div>

                <div>
                  <Label>Producto</Label>
                  <Select
                    value={transferForm.source_stock_item}
                    onChange={(e) => setTransferForm((prev) => ({ ...prev, source_stock_item: e.target.value }))}
                  >
                    <option value="">Selecciona producto...</option>
                    {transferStockItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.product_name} - Disp. {formatInteger(item.disponible)}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_160px]">
                  <div>
                    <Label>Almacen destino</Label>
                    <Select
                      value={transferForm.destination_warehouse}
                      onChange={(e) => setTransferForm((prev) => ({ ...prev, destination_warehouse: e.target.value }))}
                    >
                      <option value="">Selecciona destino...</option>
                      {activeWarehouses
                        .filter((warehouse) => String(warehouse.id) !== transferForm.source_warehouse)
                        .map((warehouse) => (
                          <option key={warehouse.id} value={warehouse.id}>{warehouse.nombre}</option>
                        ))}
                    </Select>
                  </div>
                  <div>
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
                  <Textarea
                    rows={3}
                    value={transferForm.notes}
                    onChange={(e) => setTransferForm((prev) => ({ ...prev, notes: e.target.value }))}
                    placeholder="Motivo de la transferencia"
                  />
                </div>

                <div className="flex justify-end">
                  <Button type="submit" disabled={transferStock.isPending}>
                    Transferir stock
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {movementsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,22,35,0.45)] p-4 backdrop-blur-sm">
          <Card className="w-full max-w-6xl overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-[var(--gray-100)] bg-[var(--gray-50)]/70 px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                  <History size={18} />
                </div>
                <div>
                  <CardTitle>Todos los movimientos</CardTitle>
                  <div className="mt-1 text-xs text-[var(--gray-400)]">
                    Historial completo de movimientos del inventario
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="secondary" disabled>
                  <Download size={16} className="mr-2" />
                  Exportar
                </Button>
                <button
                  type="button"
                  onClick={() => setMovementsModalOpen(false)}
                  className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-[var(--gray-200)] text-[var(--gray-400)] transition-colors hover:border-[var(--gray-300)] hover:text-[var(--gray-700)]"
                >
                  <X size={18} />
                </button>
              </div>
            </CardHeader>
            <CardContent className="max-h-[70vh] overflow-y-auto p-0">
              {renderMovementsTable(movements)}
            </CardContent>
          </Card>
        </div>
      )}

      {productsWarehouse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,22,35,0.45)] p-4 backdrop-blur-sm">
          <Card className="w-full max-w-5xl overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-[var(--gray-100)] bg-[var(--gray-50)]/70 px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                  <Package size={18} />
                </div>
                <div>
                  <CardTitle>Productos del almacen</CardTitle>
                  <div className="mt-1 text-xs text-[var(--gray-400)]">
                    {productsWarehouse.nombre} - {selectedWarehouseProducts.length} productos registrados
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setProductsWarehouse(null)}
                className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-[var(--gray-200)] text-[var(--gray-400)] transition-colors hover:border-[var(--gray-300)] hover:text-[var(--gray-700)]"
              >
                <X size={18} />
              </button>
            </CardHeader>
            <CardContent className="max-h-[70vh] overflow-y-auto p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-[var(--gray-100)] bg-[var(--gray-50)] text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--gray-400)]">
                    <tr>
                      <th className="px-5 py-3 text-left">Producto</th>
                      <th className="px-5 py-3 text-left">Codigo</th>
                      <th className="px-5 py-3 text-center">Fisico</th>
                      <th className="px-5 py-3 text-center">Reservado</th>
                      <th className="px-5 py-3 text-center">Disponible</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--gray-100)]">
                    {selectedWarehouseProducts.map((item) => (
                      <tr key={item.id} className="hover:bg-[var(--gray-50)]/70">
                        <td className="px-5 py-4 font-semibold text-[var(--gray-800)]">{item.product_name}</td>
                        <td className="px-5 py-4 text-[var(--gray-500)]">{item.product_code}</td>
                        <td className="px-5 py-4 text-center font-bold text-[var(--color-brand-blue)]">{formatInteger(item.cantidad)}</td>
                        <td className="px-5 py-4 text-center font-bold text-[var(--color-warning)]">{formatInteger(item.reservado)}</td>
                        <td className="px-5 py-4 text-center font-bold text-[var(--color-success)]">{formatInteger(item.disponible)}</td>
                      </tr>
                    ))}
                    {selectedWarehouseProducts.length === 0 && (
                      <tr>
                        <td className="px-5 py-10 text-center text-[var(--gray-400)]" colSpan={5}>
                          No hay productos registrados en este almacen.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
