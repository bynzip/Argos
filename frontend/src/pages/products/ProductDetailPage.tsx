import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Boxes,
  Clock3,
  Edit,
  History,
  Link2,
  MapPin,
  Tag,
  TrendingUp,
  Trash2,
  Truck,
  Warehouse,
  X,
} from 'lucide-react';

import { useAuthStore } from '../../store/authStore';
import { ProductSupplier, useDeleteProductSupplier, useProduct } from '../../hooks/useProducts';
import { PaginatedResponse, InventoryMovement, useProductKardex } from '../../hooks/useInventory';
import { Button } from '../../components/ui/Button';
import { Card, CardContent } from '../../components/ui/Card';
import ProductSupplierLinkModal from '../../components/products/ProductSupplierLinkModal';
import { cn } from '../../lib/utils';

const MOVEMENT_LABELS: Record<string, string> = {
  ENTRY: 'Entrada',
  EXIT: 'Salida',
  TRANSFER_OUT: 'Transferencia salida',
  TRANSFER_IN: 'Transferencia entrada',
  ADJUSTMENT_IN: 'Ajuste entrada',
  ADJUSTMENT_OUT: 'Ajuste salida',
  RETURN: 'Devolucion',
};

const MOVEMENT_BADGE_STYLES: Record<string, string> = {
  ENTRY: 'border-blue-100 bg-blue-50 text-blue-700',
  EXIT: 'border-red-100 bg-red-50 text-red-700',
  TRANSFER_OUT: 'border-slate-200 bg-slate-100 text-slate-700',
  TRANSFER_IN: 'border-indigo-100 bg-indigo-50 text-indigo-700',
  ADJUSTMENT_IN: 'border-emerald-100 bg-emerald-50 text-emerald-700',
  ADJUSTMENT_OUT: 'border-amber-100 bg-amber-50 text-amber-700',
  RETURN: 'border-violet-100 bg-violet-50 text-violet-700',
};

const formatInteger = (value: string | number | null | undefined) => {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed.toFixed(0) : '0';
};

const formatShortDateTime = (value: string) => (
  `${new Date(value).toLocaleDateString('es-PE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })} - ${new Date(value).toLocaleTimeString('es-PE', {
    hour: '2-digit',
    minute: '2-digit',
  })}`
);

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: product, isLoading } = useProduct(id || null);
  const { data: kardexResponse } = useProductKardex(id || null);
  const { user } = useAuthStore();
  const deleteProductSupplier = useDeleteProductSupplier();

  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [isKardexModalOpen, setIsKardexModalOpen] = useState(false);
  const [editingSupplierLink, setEditingSupplierLink] = useState<ProductSupplier | null>(null);

  const canViewCost = user?.role === 'Administrador' || user?.role === 'Almacenero' || user?.is_superuser;
  const canManageSuppliers = canViewCost;
  const kardex = kardexResponse && !Array.isArray(kardexResponse) && 'results' in kardexResponse
    ? (kardexResponse as PaginatedResponse<InventoryMovement>).results
    : Array.isArray(kardexResponse) ? kardexResponse : [];

  const supplierLinks = useMemo(() => product?.product_suppliers || [], [product]);

  const openCreateSupplierLink = () => {
    setEditingSupplierLink(null);
    setIsSupplierModalOpen(true);
  };

  const openEditSupplierLink = (supplierLink: ProductSupplier) => {
    setEditingSupplierLink(supplierLink);
    setIsSupplierModalOpen(true);
  };

  const closeSupplierModal = () => {
    setEditingSupplierLink(null);
    setIsSupplierModalOpen(false);
  };

  const handleDeleteSupplierLink = async (supplierLinkId: number) => {
    if (!product) return;
    await deleteProductSupplier.mutateAsync({ id: supplierLinkId, product: product.id });
    if (editingSupplierLink?.id === supplierLinkId) {
      closeSupplierModal();
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-900 border-t-transparent"></div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="p-20 text-center text-lg font-bold text-[var(--color-danger)]">
        El producto no existe o fue eliminado.
      </div>
    );
  }

  const available = parseFloat(product.total_stock_disponible || product.total_stock || '0');
  const isLowStock = available <= product.stock_minimo;

  return (
    <>
      <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
        <div className="space-y-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/inventory')} className="text-slate-500 hover:text-slate-800">
            <ArrowLeft size={16} className="mr-2" />
            Volver al inventario
          </Button>

          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <h1 className="text-3xl font-black tracking-tight text-slate-900">{product.nombre}</h1>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] font-bold uppercase tracking-[0.14em] text-slate-700">
                  {product.codigo}
                </span>
                <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                  {product.category_name}
                </span>
                <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                  {product.brand_name}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setIsKardexModalOpen(true)}>
                <Clock3 size={16} className="mr-2" />
                Kardex
              </Button>
              {isLowStock && (
                  <Link to={`/suppliers/orders/new?add_product=${product.id}&qty=1`}>
                  <Button variant="outline" className="border-slate-300 text-slate-700 hover:border-slate-900 hover:text-slate-900">
                    <Truck size={16} className="mr-2" />
                    Reponer
                  </Button>
                </Link>
              )}
              {canViewCost && (
                <Link to={`/inventory/edit/${product.id}`}>
                  <Button variant="primary">
                    <Edit size={16} className="mr-2" />
                    Editar Producto
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <section className="flex flex-col gap-6 lg:col-span-4">
            <Card className="group relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm">
              <div className="absolute bottom-0 left-0 top-0 w-[5px] bg-slate-900"></div>
              <CardContent className="space-y-6 p-6">
                <div className="flex items-center gap-2 text-[12px] font-black uppercase tracking-[0.08em] text-slate-800">
                  <Boxes size={14} className="text-slate-900" />
                  <span>Datos del Producto</span>
                </div>

                <div className="relative flex items-center justify-center gap-6 overflow-hidden rounded-xl border border-slate-100 bg-slate-50/60 p-6">
                  <div className="text-center">
                    <span className="mb-0.5 block text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">Disponible</span>
                    <span className="text-6xl font-extrabold leading-none tracking-tight text-slate-900">
                      {formatInteger(product.total_stock_disponible || product.total_stock)}
                    </span>
                  </div>

                  <div className="h-12 w-px bg-slate-200"></div>

                  <div className="flex flex-col gap-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Unidad:</span>
                      <span className="rounded-md bg-slate-200/70 px-2 py-0.5 text-xs font-bold text-slate-700">
                        {product.unidad}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Serial:</span>
                      <span className={cn(
                        'flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-bold',
                        product.is_serializable
                          ? 'border-emerald-100/60 bg-emerald-50 text-emerald-700'
                          : 'border-slate-200 bg-white text-slate-600',
                      )}>
                        <span className={cn('h-1.5 w-1.5 rounded-full', product.is_serializable ? 'bg-emerald-500' : 'bg-slate-400')}></span>
                        {product.is_serializable ? 'Si' : 'No'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                  <span className="mb-3 block text-center text-[11px] font-extrabold uppercase tracking-[0.08em] text-slate-600">
                    Detalle de Existencias
                  </span>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg border border-slate-100 bg-white py-2 shadow-sm">
                      <span className="block text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400">Fisico</span>
                      <span className="text-sm font-extrabold text-slate-800">{formatInteger(product.total_stock_fisico)}</span>
                    </div>
                    <div className="rounded-lg border border-slate-100 bg-white py-2 shadow-sm">
                      <span className="block text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400">Reservado</span>
                      <span className="text-sm font-extrabold text-slate-800">{formatInteger(product.total_stock_reservado)}</span>
                    </div>
                    <div className="rounded-lg border border-slate-100 bg-white py-2 shadow-sm">
                      <span className="block text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400">Disponible</span>
                      <span className={cn('text-sm font-extrabold', isLowStock ? 'text-amber-600' : 'text-emerald-600')}>
                        {formatInteger(product.total_stock_disponible || product.total_stock)}
                      </span>
                    </div>
                  </div>
                </div>

                {isLowStock && (
                  <div className="flex items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-700">
                    <AlertTriangle size={18} />
                    <span className="text-xs font-bold uppercase tracking-tight">
                      Stock critico (Min: {formatInteger(product.stock_minimo)})
                    </span>
                  </div>
                )}

                <div className="border-t border-slate-100 pt-5">
                  <span className="mb-3 block text-[11px] font-black uppercase tracking-[0.08em] text-slate-700">
                    Estructura de Precios
                  </span>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between rounded-xl border border-emerald-100/80 bg-emerald-50/40 p-3">
                      <div className="flex flex-col">
                        <span className="text-[9px] font-bold uppercase text-emerald-800">Precio de Venta</span>
                        <span className="mt-0.5 text-base font-bold text-emerald-700">
                          S/ {parseFloat(product.precio_venta).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100/50 text-emerald-600">
                        <TrendingUp size={16} />
                      </div>
                    </div>

                    {canViewCost && product.precio_costo && (
                      <div className="flex items-center justify-between rounded-xl border border-amber-100/80 bg-amber-50/40 p-3">
                        <div className="flex flex-col">
                          <span className="text-[9px] font-bold uppercase text-amber-800">Precio de Costo</span>
                          <span className="mt-0.5 text-base font-bold text-amber-700">
                            S/ {parseFloat(product.precio_costo).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100/50 text-amber-600">
                          <Tag size={16} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          <section className="flex flex-col gap-6 lg:col-span-8">
            <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-2 text-[12px] font-black uppercase tracking-[0.08em] text-slate-800">
                <Warehouse size={14} className="text-slate-800" />
                <span>Distribucion por Almacen</span>
              </div>

              {product.stocks?.length ? (
                <div className="space-y-4">
                  {product.stocks.map((stock) => (
                    <div key={stock.id} className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50/60 p-5 md:flex-row md:items-center">
                      <div className="flex items-start gap-3">
                        <div className="rounded-lg border border-blue-100 bg-blue-50 p-2.5 text-blue-600">
                          <MapPin size={18} />
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-slate-800">{stock.warehouse_name}</h4>
                          <p className="mt-0.5 text-xs font-medium text-slate-400">
                            {stock.ubicacion_especifica || 'Sin ubicacion especifica asignada'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-6 self-start rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm shadow-sm md:self-auto">
                        <div className="text-center">
                          <span className="block text-[10px] font-bold uppercase text-slate-400">Fisico</span>
                          <span className="font-bold text-slate-800">{formatInteger(stock.cantidad)}</span>
                        </div>
                        <div className="h-6 w-px bg-slate-200"></div>
                        <div className="text-center">
                          <span className="block text-[10px] font-bold uppercase text-slate-400">Reservado</span>
                          <span className="font-bold text-slate-800">{formatInteger(stock.reservado)}</span>
                        </div>
                        <div className="h-6 w-px bg-slate-200"></div>
                        <div className="text-center">
                          <span className="block text-[10px] font-bold uppercase text-slate-400">Disponible</span>
                          <span className="font-bold text-slate-900">{formatInteger(stock.disponible)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-slate-400">Sin stock distribuido por almacen.</div>
              )}
            </div>

            {canManageSuppliers && (
              <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm">
                <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2 text-[12px] font-black uppercase tracking-[0.08em] text-slate-800">
                    <Truck size={14} className="text-slate-800" />
                    <span>Proveedores del Producto</span>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="hover:border-[var(--gray-300)]"
                    onClick={openCreateSupplierLink}
                  >
                    <Link2 size={14} className="mr-1.5" />
                    Vincular proveedor
                  </Button>
                </div>

                <div className="overflow-hidden rounded-xl border border-slate-100">
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50">
                          <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">Proveedor</th>
                          <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">Dias de entrega</th>
                          <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-slate-500">Accion</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-sm">
                        {supplierLinks.map((supplierLink) => (
                          <tr key={supplierLink.id} className="transition-colors hover:bg-slate-50/50">
                            <td className="px-4 py-3.5 font-medium text-slate-700">{supplierLink.supplier_name}</td>
                            <td className="px-4 py-3.5 font-medium text-slate-500">
                              {supplierLink.lead_time_days ? `${supplierLink.lead_time_days} dias habiles` : '-'}
                            </td>
                            <td className="px-4 py-3.5 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={() => openEditSupplierLink(supplierLink)}
                                  className="cursor-pointer rounded-md p-1.5 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
                                  title="Editar"
                                >
                                  <Edit size={16} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteSupplierLink(supplierLink.id)}
                                  className="cursor-pointer rounded-md p-1.5 text-red-500 transition-colors hover:bg-red-50 hover:text-red-700"
                                  title="Quitar"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {supplierLinks.length === 0 && (
                          <tr>
                            <td className="px-4 py-6 text-center text-sm text-slate-400" colSpan={3}>
                              No hay proveedores asociados a este producto.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

          </section>
        </div>
      </div>

      <ProductSupplierLinkModal
        open={isSupplierModalOpen}
        onClose={closeSupplierModal}
        initialProductId={product.id}
        editingLink={editingSupplierLink}
      />

      {isKardexModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,23,42,0.38)] p-4">
          <div className="flex max-h-[85vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.18)]">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <div className="flex items-center gap-2 text-[12px] font-black uppercase tracking-[0.08em] text-slate-800">
                <History size={14} className="text-slate-800" />
                <span>Kardex</span>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setIsKardexModalOpen(false)}>
                <X size={18} />
              </Button>
            </div>

            <div className="overflow-auto p-6">
              <div className="overflow-hidden rounded-xl border border-slate-100">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">Fecha</th>
                        <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">Tipo</th>
                        <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">Almacen</th>
                        <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-slate-500">Cantidad</th>
                        <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">Referencia</th>
                        <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">Series</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {kardex.map((movement) => (
                        <tr key={movement.id} className="transition-colors hover:bg-slate-50/50">
                          <td className="px-4 py-3.5 text-xs font-medium text-slate-500">
                            {formatShortDateTime(movement.created_at)}
                          </td>
                          <td className="px-4 py-3.5">
                            <span className={cn(
                              'rounded-md border px-2 py-0.5 text-xs font-bold',
                              MOVEMENT_BADGE_STYLES[movement.movement_type] || 'border-slate-200 bg-slate-100 text-slate-700',
                            )}>
                              {MOVEMENT_LABELS[movement.movement_type] || movement.movement_type}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 font-medium text-slate-600">
                            {movement.warehouse_name}
                            {movement.destination_warehouse_name ? ` → ${movement.destination_warehouse_name}` : ''}
                          </td>
                          <td className="px-4 py-3.5 text-center font-bold text-slate-800">
                            {formatInteger(movement.quantity)}
                          </td>
                          <td className="px-4 py-3.5 font-medium text-slate-600">
                            {movement.reference_type || '—'} {movement.reference_id || ''}
                          </td>
                          <td className="px-4 py-3.5 font-medium text-slate-400">
                            {Array.isArray(movement.serial_numbers) && movement.serial_numbers.length > 0
                              ? movement.serial_numbers.join(', ')
                              : '—'}
                          </td>
                        </tr>
                      ))}
                      {kardex.length === 0 && (
                        <tr>
                          <td className="px-4 py-6 text-center text-sm text-slate-400" colSpan={6}>
                            Sin movimientos todavia.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
