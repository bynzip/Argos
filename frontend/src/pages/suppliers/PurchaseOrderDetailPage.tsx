import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  CircleX,
  Clock3,
  FilePenLine,
  FileText,
  Package,
  PackageCheck,
  Send,
  Tag,
  TrendingUp,
  Truck,
  Warehouse as WarehouseIcon,
  X,
} from 'lucide-react';

import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Label } from '../../components/ui/Label';
import { PageHeader } from '../../components/ui/PageHeader';
import { Textarea } from '../../components/ui/Textarea';
import { useWarehouses, Warehouse } from '../../hooks/useInventory';
import { PaginatedResponse, Product, useProducts } from '../../hooks/useProducts';
import {
  Supplier,
  PurchaseOrderItem,
  useCancelPurchaseOrder,
  usePurchaseOrder,
  useReceivePurchaseOrder,
  useSendPurchaseOrder,
  useSuppliers,
} from '../../hooks/useSuppliers';
import { getApiErrorMessage } from '../../lib/apiErrors';
import {
  PURCHASE_ORDER_STATUS_LABELS,
  clampIntegerInput,
  formatInteger,
  formatPurchaseDate,
} from './purchaseOrderUi';

type ReceiveLineDraft = {
  id: number;
  cantidad_recibida: string;
  serial_numbers: string;
};

type ReceiveDraftState = {
  notes: string;
  items: ReceiveLineDraft[];
};

const EMPTY_RECEIVE_DRAFT: ReceiveDraftState = {
  notes: '',
  items: [],
};

const STATUS_STYLES: Record<string, string> = {
  DRAFT: 'border-[var(--gray-200)] bg-[var(--gray-50)] text-[var(--gray-500)]',
  SENT: 'border-[var(--color-info-border)] bg-[var(--color-info-bg)] text-[var(--color-brand-blue)]',
  PARTIALLY_RECEIVED: 'border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] text-[var(--color-warning)]',
  RECEIVED: 'border-[var(--color-success-border)] bg-[var(--color-success-bg)] text-[var(--color-success)]',
  CLOSED_INCOMPLETE: 'border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] text-[var(--color-warning)]',
  CANCELLED: 'border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] text-[var(--color-danger)]',
};

const formatDateTime = (value?: string | null) => {
  if (!value) return '-';
  return new Date(value).toLocaleString('es-PE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export default function PurchaseOrderDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const orderId = id ? Number(id) : null;

  const { data: order, isLoading } = usePurchaseOrder(orderId);
  const { data: productsData } = useProducts({ page_size: 200, activo: true });
  const { data: suppliersData = [] } = useSuppliers();
  const { data: warehousesData } = useWarehouses();
  const sendPurchaseOrder = useSendPurchaseOrder();
  const cancelPurchaseOrder = useCancelPurchaseOrder();
  const receivePurchaseOrder = useReceivePurchaseOrder();

  const products = useMemo(() => (
    productsData && !Array.isArray(productsData) && 'results' in productsData
      ? (productsData as PaginatedResponse<Product>).results
      : Array.isArray(productsData) ? productsData : []
  ), [productsData]);

  const warehouses = useMemo(() => (
    Array.isArray(warehousesData) ? warehousesData : warehousesData?.results || []
  ), [warehousesData]);

  const [receiveDraft, setReceiveDraft] = useState<ReceiveDraftState>(EMPTY_RECEIVE_DRAFT);
  const [receiveError, setReceiveError] = useState<string | null>(null);

  const receiveOpen = searchParams.get('receive') === '1';
  const canReceive = order?.estado === 'SENT' || order?.estado === 'PARTIALLY_RECEIVED';

  useEffect(() => {
    if (!order || !receiveOpen) return;
    setReceiveDraft({
      notes: '',
      items: order.items.map((item) => ({
        id: item.id,
        cantidad_recibida: '0',
        serial_numbers: '',
      })),
    });
  }, [order, receiveOpen]);

  const findProduct = (productId: number | string) => (
    products.find((product) => product.id === Number(productId))
  );

  const supplierDetail = useMemo(
    () => suppliersData.find((supplier: Supplier) => supplier.id === order?.supplier),
    [order?.supplier, suppliersData],
  );

  const warehouseDetail = useMemo(
    () => warehouses.find((warehouse: Warehouse) => warehouse.id === order?.destination_warehouse),
    [order?.destination_warehouse, warehouses],
  );

  const totalUnits = useMemo(
    () => order?.items.reduce((acc, item) => acc + Number(item.cantidad_pedida || 0), 0) || 0,
    [order?.items],
  );

  const orderedHistory = useMemo(
    () => [...(order?.status_history || [])].sort(
      (left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
    ),
    [order?.status_history],
  );

  const updateReceiveLine = (itemId: number, field: keyof ReceiveLineDraft, value: string) => {
    setReceiveDraft((prev) => ({
      ...prev,
      items: prev.items.map((item) => {
        if (item.id !== itemId) return item;
        if (field === 'cantidad_recibida') {
          return { ...item, cantidad_recibida: clampIntegerInput(value, '0', 0) };
        }
        return { ...item, [field]: value };
      }),
    }));
    if (receiveError) setReceiveError(null);
  };

  const autofillPending = (itemId: number, pending: number) => {
    updateReceiveLine(itemId, 'cantidad_recibida', String(Math.max(0, pending)));
  };

  const handleSendOrder = async () => {
    if (!order) return;
    try {
      await sendPurchaseOrder.mutateAsync({ id: order.id });
    } catch (error) {
      window.alert(getApiErrorMessage(error, 'No se pudo enviar la orden.'));
    }
  };

  const handleCancelOrder = async () => {
    if (!order) return;
    try {
      await cancelPurchaseOrder.mutateAsync({ id: order.id });
      navigate('/suppliers/orders');
    } catch (error) {
      window.alert(getApiErrorMessage(error, 'No se pudo cancelar la orden.'));
    }
  };

  const handleReceiveOrder = async (closeIncomplete = false) => {
    if (!order) return;
    setReceiveError(null);

    const items = receiveDraft.items
      .filter((item) => Number(item.cantidad_recibida) > 0)
      .map((item) => ({
        id: item.id,
        cantidad_recibida: String(Math.floor(Number(item.cantidad_recibida))),
        ...(item.serial_numbers.trim()
          ? {
              serial_numbers: item.serial_numbers
                .split(',')
                .map((serial) => serial.trim())
                .filter(Boolean),
            }
          : {}),
      }));

    if (items.length === 0) {
      setReceiveError('Debes ingresar al menos una cantidad recibida mayor a 0.');
      return;
    }

    try {
      await receivePurchaseOrder.mutateAsync({
        id: order.id,
        items,
        notes: receiveDraft.notes,
        close_incomplete: closeIncomplete,
      });
      closeReceive();
    } catch (error) {
      setReceiveError(getApiErrorMessage(error, 'No se pudo registrar la recepcion.'));
    }
  };

  const openReceive = () => {
    setSearchParams((prev) => {
      prev.set('receive', '1');
      return prev;
    });
  };

  const closeReceive = () => {
    setSearchParams((prev) => {
      prev.delete('receive');
      return prev;
    });
    setReceiveDraft(EMPTY_RECEIVE_DRAFT);
    setReceiveError(null);
  };

  if (isLoading) {
    return <div className="p-8 text-sm text-[var(--gray-500)]">Cargando detalle...</div>;
  }

  if (!order) {
    return <div className="p-8 text-sm text-[var(--color-danger)]">La orden no existe.</div>;
  }

  return (
    <div className="mx-auto max-w-[1420px] space-y-8 p-8">
      <Button variant="ghost" size="sm" onClick={() => navigate('/suppliers/orders')}>
        <ArrowLeft size={16} className="mr-2" />
        Volver a compras
      </Button>

      <PageHeader
        title={order.folio}
        subtitle={(
          <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--gray-500)]">
            <span>Creada el {formatPurchaseDate(order.created_at)}</span>
            <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.04em] ${STATUS_STYLES[order.estado] || STATUS_STYLES.DRAFT}`}>
              {PURCHASE_ORDER_STATUS_LABELS[order.estado] || order.estado}
            </span>
          </div>
        )}
        actions={(
          <div className="flex flex-wrap gap-2">
            {order.estado === 'DRAFT' && (
              <>
                <Link to={`/suppliers/orders/edit/${order.id}`}>
                  <Button variant="secondary">
                    <FilePenLine size={16} className="mr-2" />
                    Editar borrador
                  </Button>
                </Link>
                <Button onClick={handleSendOrder}>
                  <Send size={16} className="mr-2" />
                  Enviar
                </Button>
              </>
            )}
            {canReceive && (
              <Button variant="secondary" onClick={openReceive}>
                <PackageCheck size={16} className="mr-2" />
                Registrar recepcion
              </Button>
            )}
            {(order.estado === 'DRAFT' || order.estado === 'SENT' || order.estado === 'PARTIALLY_RECEIVED') && (
              <Button variant="danger" onClick={handleCancelOrder}>
                <CircleX size={16} className="mr-2" />
                Cancelar
              </Button>
            )}
          </div>
        )}
      />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="space-y-8 lg:col-span-8">
          <Card className="overflow-hidden border-[var(--gray-200)]">
            <CardHeader className="flex flex-row items-center justify-between gap-4 border-b border-[var(--gray-100)] bg-[var(--gray-50)]/70 px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                  <Package size={18} />
                </div>
                <div>
                  <CardTitle>Detalle de la orden</CardTitle>
                  <div className="mt-1 text-xs text-[var(--gray-400)]">
                    Lineas registradas para esta compra
                  </div>
                </div>
              </div>
              <span className="rounded-full border border-[var(--gray-200)] bg-white px-3 py-1 text-xs font-semibold text-[var(--gray-600)]">
                {order.items.length} productos · {formatInteger(totalUnits)} unidades
              </span>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-[var(--gray-100)] text-[11px] uppercase tracking-[0.06em] text-[var(--gray-400)]">
                    <tr>
                      <th className="py-3 pr-4 text-left">Producto</th>
                      <th className="py-3 px-3 text-center">Pedida</th>
                      <th className="py-3 px-3 text-center">Recibida</th>
                      <th className="py-3 px-3 text-center">Pendiente</th>
                      <th className="py-3 px-4 text-right">Costo unit.</th>
                      <th className="py-3 pl-4 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--gray-100)]">
                    {order.items.map((item: PurchaseOrderItem) => {
                      const pending = Math.max(
                        Number(item.cantidad_pedida) - Number(item.cantidad_recibida),
                        0,
                      );

                      return (
                        <tr key={item.id} className="hover:bg-[var(--gray-50)]/70">
                          <td className="py-4 pr-4">
                            <div className="font-semibold text-[var(--gray-800)]">{item.product_name}</div>
                            <div className="text-xs text-[var(--gray-400)]">{item.product_code}</div>
                          </td>
                          <td className="py-4 px-3 text-center font-medium text-[var(--gray-700)]">
                            {formatInteger(item.cantidad_pedida)}
                          </td>
                          <td className="py-4 px-3 text-center font-medium text-[var(--gray-700)]">
                            {formatInteger(item.cantidad_recibida)}
                          </td>
                          <td className="py-4 px-3 text-center">
                            <span className="inline-flex rounded-md bg-[var(--color-warning-bg)] px-2 py-0.5 text-xs font-semibold text-[var(--color-warning)]">
                              {pending.toFixed(0)}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-right text-[var(--gray-700)]">
                            S/ {Number(item.precio_unitario).toFixed(2)}
                          </td>
                          <td className="py-4 pl-4 text-right font-bold text-[var(--gray-900)]">
                            S/ {(Number(item.precio_unitario) * Number(item.cantidad_pedida)).toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card className="border-[var(--gray-200)]">
            <CardHeader className="flex flex-row items-center justify-between gap-4 px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                  <Clock3 size={18} />
                </div>
                <div>
                  <CardTitle>Historial de estado</CardTitle>
                  <div className="mt-1 text-xs text-[var(--gray-400)]">
                    Registro cronologico de cambios sobre la orden
                  </div>
                </div>
              </div>
              <span className="rounded-full border border-[var(--gray-200)] bg-[var(--gray-50)] px-3 py-1 text-xs font-semibold text-[var(--gray-500)]">
                {orderedHistory.length} eventos
              </span>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              {orderedHistory.map((entry) => {
                const previousStatus = entry.estado_anterior
                  ? PURCHASE_ORDER_STATUS_LABELS[entry.estado_anterior] || entry.estado_anterior
                  : 'Inicial';
                const nextStatus = PURCHASE_ORDER_STATUS_LABELS[entry.estado_nuevo] || entry.estado_nuevo;

                return (
                  <div
                    key={entry.id}
                    className="rounded-2xl border border-[var(--gray-200)] bg-[var(--gray-50)]/55 p-4"
                  >
                    <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                      <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-[var(--gray-800)]">
                        <span>{previousStatus}</span>
                        <span className="text-[var(--gray-300)]">→</span>
                        <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.04em] ${STATUS_STYLES[entry.estado_nuevo] || STATUS_STYLES.DRAFT}`}>
                          {nextStatus}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--gray-500)]">
                        <span>{entry.cambiado_por_nombre || 'Sistema'}</span>
                        <span className="text-[var(--gray-300)]">•</span>
                        <span>{formatDateTime(entry.created_at)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-8 lg:col-span-4">
          <Card className="overflow-hidden border-[var(--gray-200)]">
            <CardHeader className="border-b border-[var(--gray-100)] bg-[var(--gray-50)]/70 px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                  <FileText size={18} />
                </div>
                <div>
                  <CardTitle>Resumen general</CardTitle>
                  <div className="mt-1 text-xs text-[var(--gray-400)]">
                    Datos clave de proveedor, destino y cierre
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div className="rounded-2xl border border-[var(--gray-200)] bg-[var(--gray-50)] px-4 py-4">
                <div className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.06em] text-[var(--gray-400)]">
                  <Building2 size={13} className="text-[var(--gray-400)]" />
                  <span>Proveedor</span>
                </div>
                <div className="text-sm font-bold text-[var(--gray-800)]">{order.supplier_name}</div>
                <div className="mt-1 text-xs text-[var(--gray-500)]">
                  RUC: {supplierDetail?.ruc || 'No registrado'}
                </div>
                <div className="mt-1 text-xs text-[var(--gray-500)]">
                  {supplierDetail?.direccion || 'Sin direccion registrada'}
                </div>
              </div>

              <div className="rounded-2xl border border-[var(--gray-200)] bg-[var(--gray-50)] px-4 py-4">
                <div className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.06em] text-[var(--gray-400)]">
                  <WarehouseIcon size={13} className="text-[var(--gray-400)]" />
                  <span>Almacen destino</span>
                </div>
                <div className="text-sm font-bold text-[var(--gray-800)]">{order.destination_warehouse_name}</div>
                <div className="mt-1 text-xs text-[var(--gray-500)]">
                  {warehouseDetail?.ubicacion || 'Sin ubicacion especifica'}
                </div>
              </div>

              <div className="rounded-2xl border border-[var(--gray-200)] bg-white p-4">
                <div className="mb-3 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.06em] text-[var(--gray-400)]">
                  <Tag size={13} className="text-[var(--gray-400)]" />
                  <span>Resumen economico</span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-emerald-100/80 bg-emerald-50/40 p-4">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-bold uppercase text-emerald-800">Subtotal de Compra</span>
                    <span className="mt-1 text-xs font-medium text-emerald-700/85">
                      {order.items.length} lineas
                    </span>
                    <span className="text-xs font-medium text-emerald-700/85">
                      {formatInteger(totalUnits)} unidades
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[20px] font-black leading-none text-emerald-700">
                      S/ {Number(order.subtotal || 0).toFixed(2)}
                    </span>
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100/60 text-emerald-600">
                      <TrendingUp size={18} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-[var(--gray-200)] bg-white p-4">
                <div className="mb-3 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.06em] text-[var(--gray-400)]">
                  <Truck size={13} className="text-[var(--gray-400)]" />
                  <span>Seguimiento</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-[var(--gray-100)] bg-[var(--gray-50)] px-3 py-3">
                    <div className="text-[10px] font-black uppercase tracking-[0.06em] text-[var(--gray-400)]">
                      Enviada
                    </div>
                    <div className="mt-1 text-sm font-semibold text-[var(--gray-700)]">
                      {formatPurchaseDate(order.sent_at)}
                    </div>
                  </div>
                  <div className="rounded-xl border border-[var(--gray-100)] bg-[var(--gray-50)] px-3 py-3">
                    <div className="text-[10px] font-black uppercase tracking-[0.06em] text-[var(--gray-400)]">
                      Cierre
                    </div>
                    <div className="mt-1 text-sm font-semibold text-[var(--gray-700)]">
                      {formatPurchaseDate(order.received_at)}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {receiveOpen && canReceive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,22,35,0.45)] p-4 backdrop-blur-sm">
          <Card className="w-full max-w-5xl overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-[var(--gray-100)] bg-[var(--gray-50)]/70 px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                  <PackageCheck size={18} />
                </div>
                <div>
                  <CardTitle>Registrar recepcion</CardTitle>
                  <div className="mt-1 text-xs text-[var(--gray-400)]">
                    Registra lo recibido o cierra la orden como incompleta
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={closeReceive}
                className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-[var(--gray-200)] text-[var(--gray-400)] transition-colors hover:border-[var(--gray-300)] hover:text-[var(--gray-700)]"
              >
                <X size={18} />
              </button>
            </CardHeader>
            <CardContent className="space-y-5 pt-6">
              {receiveError && (
                <div className="rounded-xl border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] px-4 py-3 text-sm font-medium text-[var(--color-danger)]">
                  {receiveError}
                </div>
              )}

              <div className="space-y-4">
                {order.items.map((item) => {
                  const draftLine = receiveDraft.items.find((draft) => draft.id === item.id);
                  const pending = Math.max(Number(item.cantidad_pedida) - Number(item.cantidad_recibida), 0);
                  const product = findProduct(item.product);
                  const isSerializableProduct = Boolean(product?.is_serializable);

                  return (
                    <div key={item.id} className="grid grid-cols-1 gap-3 rounded-2xl border border-[var(--gray-200)] bg-[var(--gray-50)]/60 p-4 lg:grid-cols-12">
                      <div className="lg:col-span-5">
                        <div className="font-semibold text-[var(--gray-800)]">{item.product_name}</div>
                        <div className="text-xs text-[var(--gray-500)]">
                          Pendiente: {pending.toFixed(0)} · Costo: S/ {Number(item.precio_unitario).toFixed(2)}
                        </div>
                        {isSerializableProduct && (
                          <div className="mt-1 text-xs font-semibold text-[var(--color-brand-blue)]">
                            Requiere una serie por cada unidad recibida.
                          </div>
                        )}
                      </div>
                      <div className="lg:col-span-2">
                        <Label>Cantidad recibida</Label>
                        <Input
                          type="number"
                          step="1"
                          min="0"
                          value={draftLine?.cantidad_recibida || '0'}
                          onChange={(e) => updateReceiveLine(item.id, 'cantidad_recibida', e.target.value)}
                        />
                        <button
                          type="button"
                          className="mt-2 text-xs font-semibold text-[var(--color-brand-blue)] hover:underline"
                          onClick={() => autofillPending(item.id, pending)}
                        >
                          Completar pendiente
                        </button>
                      </div>
                      <div className="lg:col-span-5">
                        <Label>Series</Label>
                        <Input
                          value={draftLine?.serial_numbers || ''}
                          onChange={(e) => updateReceiveLine(item.id, 'serial_numbers', e.target.value)}
                          placeholder={isSerializableProduct ? 'SN-001, SN-002' : 'No aplica para este producto'}
                          disabled={!isSerializableProduct}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div>
                <Label>Nota de recepcion (opcional)</Label>
                <Textarea
                  rows={3}
                  value={receiveDraft.notes}
                  onChange={(e) => setReceiveDraft((prev) => ({ ...prev, notes: e.target.value }))}
                />
              </div>

              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="secondary" onClick={closeReceive}>
                  Cancelar
                </Button>
                <Button variant="secondary" onClick={() => handleReceiveOrder(true)} disabled={receivePurchaseOrder.isPending}>
                  Registrar y cerrar incompleta
                </Button>
                <Button onClick={() => handleReceiveOrder()} disabled={receivePurchaseOrder.isPending}>
                  Confirmar recepcion
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
