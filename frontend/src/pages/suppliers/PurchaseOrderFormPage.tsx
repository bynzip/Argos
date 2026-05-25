import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Plus, Trash2, X } from 'lucide-react';

import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Label } from '../../components/ui/Label';
import { Select } from '../../components/ui/Select';
import { Textarea } from '../../components/ui/Textarea';
import { useWarehouses } from '../../hooks/useInventory';
import { PaginatedResponse, Product, useProducts } from '../../hooks/useProducts';
import {
  PurchaseOrderItemPayload,
  Supplier,
  useCreatePurchaseOrder,
  usePurchaseOrder,
  usePurchaseSuggestions,
  useSuppliers,
  useUpdatePurchaseOrder,
} from '../../hooks/useSuppliers';
import { getApiErrorMessage } from '../../lib/apiErrors';
import { clampIntegerInput, formatInteger } from './purchaseOrderUi';

type DraftLine = {
  localId: string;
  id?: number;
  product: string;
  cantidad_pedida: string;
  precio_unitario: string;
};

const createEmptyLine = (): DraftLine => ({
  localId: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  product: '',
  cantidad_pedida: '1',
  precio_unitario: '0.00',
});

export default function PurchaseOrderFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const editingOrderId = id ? Number(id) : null;
  const isEditing = !!editingOrderId;

  const { data: existingOrder, isLoading: isLoadingOrder } = usePurchaseOrder(editingOrderId);
  const { data: suppliersData } = useSuppliers();
  const { data: warehousesData } = useWarehouses();
  const { data: productsData } = useProducts({ page_size: 200, activo: true });
  const { data: purchaseSuggestions = [] } = usePurchaseSuggestions();
  const createPurchaseOrder = useCreatePurchaseOrder();
  const updatePurchaseOrder = useUpdatePurchaseOrder();

  const suppliers = suppliersData || [];
  const warehouses = useMemo(
    () => (Array.isArray(warehousesData) ? warehousesData : warehousesData?.results || []),
    [warehousesData],
  );
  const products = useMemo(() => (
    productsData && !Array.isArray(productsData) && 'results' in productsData
      ? (productsData as PaginatedResponse<Product>).results
      : Array.isArray(productsData) ? productsData : []
  ), [productsData]);

  const [supplierId, setSupplierId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([createEmptyLine()]);
  const [formError, setFormError] = useState<string | null>(null);
  const [prefillApplied, setPrefillApplied] = useState(false);

  const findProduct = (productId: number | string) => (
    products.find((product) => product.id === Number(productId))
  );

  const getSuggestedPrice = (productId: number | string, supplierIdValue: string) => {
    const product = findProduct(productId);
    if (!product) return '0.00';

    const matchingSupplier = product.product_suppliers?.find(
      (supplier) => supplier.supplier === Number(supplierIdValue),
    );
    if (matchingSupplier?.supplier_price) {
      return Number(matchingSupplier.supplier_price).toFixed(2);
    }
    if (product.precio_costo) {
      return Number(product.precio_costo).toFixed(2);
    }
    return '0.00';
  };

  const syncLinePricesForSupplier = (nextSupplierId: string) => {
    setLines((prev) => prev.map((line) => (
      line.product
        ? { ...line, precio_unitario: getSuggestedPrice(line.product, nextSupplierId) }
        : line
    )));
  };

  useEffect(() => {
    if (!existingOrder || !isEditing) return;

    setSupplierId(String(existingOrder.supplier));
    setWarehouseId(String(existingOrder.destination_warehouse));
    setNotes(existingOrder.notes || '');
    setLines(existingOrder.items.map((item) => ({
      localId: `${existingOrder.id}-${item.id}`,
      id: item.id,
      product: String(item.product),
      cantidad_pedida: formatInteger(item.cantidad_pedida),
      precio_unitario: item.precio_unitario,
    })));
  }, [existingOrder, isEditing]);

  useEffect(() => {
    if (isEditing || prefillApplied || products.length === 0) return;

    const addProduct = searchParams.get('add_product');
    if (!addProduct) {
      setPrefillApplied(true);
      return;
    }

    const product = findProduct(addProduct);
    if (!product) return;

    const requestedQty = searchParams.get('qty');
    const quantity = String(Math.max(1, Math.floor(Number(requestedQty || 1))));
    const primarySupplier = product.product_suppliers?.find((item) => item.is_primary)?.supplier;

    if (primarySupplier && !supplierId) {
      setSupplierId(String(primarySupplier));
      setLines([{
        localId: `${Date.now()}-${product.id}`,
        product: String(product.id),
        cantidad_pedida: quantity,
        precio_unitario: getSuggestedPrice(product.id, String(primarySupplier)),
      }]);
    } else {
      setLines([{
        localId: `${Date.now()}-${product.id}`,
        product: String(product.id),
        cantidad_pedida: quantity,
        precio_unitario: getSuggestedPrice(product.id, supplierId),
      }]);
    }

    if (!warehouseId && warehouses.length === 1) {
      setWarehouseId(String(warehouses[0].id));
    }

    setPrefillApplied(true);
  }, [isEditing, prefillApplied, products, searchParams, supplierId, warehouseId, warehouses]);

  const handleLineChange = (localId: string, field: keyof DraftLine, value: string) => {
    setLines((prev) => prev.map((line) => {
      if (line.localId !== localId) return line;

      if (field === 'product') {
        return {
          ...line,
          product: value,
          precio_unitario: value ? getSuggestedPrice(value, supplierId) : '0.00',
        };
      }

      if (field === 'cantidad_pedida') {
        return { ...line, cantidad_pedida: clampIntegerInput(value, '1', 1) };
      }

      return { ...line, [field]: value };
    }));
    if (formError) setFormError(null);
  };

  const addLine = () => setLines((prev) => [...prev, createEmptyLine()]);

  const addSuggestedProduct = (productId: number, quantity: string) => {
    const normalizedQty = clampIntegerInput(quantity, '1', 1);
    const alreadyExists = lines.some((line) => Number(line.product) === productId);

    if (alreadyExists) {
      setLines((prev) => prev.map((line) => (
        Number(line.product) === productId
          ? { ...line, cantidad_pedida: normalizedQty }
          : line
      )));
      return;
    }

    setLines((prev) => ([
      ...prev,
      {
        localId: `${Date.now()}-${productId}`,
        product: String(productId),
        cantidad_pedida: normalizedQty,
        precio_unitario: getSuggestedPrice(productId, supplierId),
      },
    ]));
  };

  const removeLine = (localId: string) => {
    setLines((prev) => (prev.length === 1 ? prev : prev.filter((line) => line.localId !== localId)));
  };

  const buildPayload = (): PurchaseOrderItemPayload[] => (
    lines
      .filter((line) => line.product)
      .map((line) => ({
        ...(line.id ? { id: line.id } : {}),
        product: Number(line.product),
        cantidad_pedida: String(Math.max(1, Math.floor(Number(line.cantidad_pedida || 1)))),
        precio_unitario: line.precio_unitario,
      }))
  );

  const estimatedSubtotal = buildPayload().reduce(
    (acc, item) => acc + Number(item.cantidad_pedida) * Number(item.precio_unitario || 0),
    0,
  );

  const handleSaveOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const items = buildPayload();
    if (!supplierId || !warehouseId || items.length === 0) {
      setFormError('Proveedor, almacen destino e items son obligatorios.');
      return;
    }

    if (items.some((item) => !item.product || Number(item.cantidad_pedida) < 1)) {
      setFormError('Cada linea debe tener producto y una cantidad entera mayor a 0.');
      return;
    }

    try {
      if (isEditing && editingOrderId) {
        await updatePurchaseOrder.mutateAsync({
          id: editingOrderId,
          supplier: Number(supplierId),
          destination_warehouse: Number(warehouseId),
          items,
          notes,
        });
      } else {
        await createPurchaseOrder.mutateAsync({
          supplier: Number(supplierId),
          destination_warehouse: Number(warehouseId),
          items,
          notes,
        });
      }
      navigate('/suppliers/orders');
    } catch (error) {
      setFormError(getApiErrorMessage(error, 'No se pudo guardar la orden de compra.'));
    }
  };

  if (isEditing && isLoadingOrder) {
    return <div className="p-8 text-sm text-[var(--gray-500)]">Cargando orden...</div>;
  }

  if (isEditing && existingOrder && existingOrder.estado !== 'DRAFT') {
    return (
      <div className="mx-auto max-w-[760px] p-8">
        <div className="rounded-3xl border border-[var(--gray-200)] bg-white p-8 shadow-sm">
          <div className="text-lg font-bold text-[var(--gray-800)]">Solo se pueden editar borradores.</div>
          <div className="mt-2 text-sm text-[var(--gray-500)]">
            La orden {existingOrder.folio} ya no esta en estado borrador.
          </div>
          <div className="mt-6 flex gap-2">
            <Button variant="secondary" onClick={() => navigate(`/suppliers/orders/${existingOrder.id}`)}>
              Ver detalle
            </Button>
            <Button onClick={() => navigate('/suppliers/orders')}>
              Volver
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1320px] p-6 md:p-8">
      <div className="grid gap-6 xl:grid-cols-12">
        <div className="xl:col-span-8">
          <div className="rounded-[22px] border border-[var(--gray-200)] bg-white shadow-[0_18px_48px_rgba(15,23,42,0.08)]">
            <div className="flex items-start justify-between gap-4 border-b border-[var(--gray-200)] px-6 py-5">
              <div>
                <h1 className="text-xl font-black text-[var(--gray-900)]">
                  {isEditing ? 'Editar borrador de compra' : 'Nueva orden de compra'}
                </h1>
                <p className="mt-1 text-sm text-[var(--gray-500)]">
                  {isEditing ? 'Actualiza las lineas antes de enviar la orden.' : 'Complete los datos para crear un borrador.'}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => navigate('/suppliers/orders')}>
                <X size={18} />
              </Button>
            </div>

            <form onSubmit={handleSaveOrder} className="space-y-6">
              <div className="space-y-6 px-6 py-6">
                {formError && (
                  <div className="rounded-xl border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] px-4 py-3 text-sm font-medium text-[var(--color-danger)]">
                    {formError}
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <Label required>Proveedor</Label>
                    <Select
                      value={supplierId}
                      onChange={(e) => {
                        setSupplierId(e.target.value);
                        syncLinePricesForSupplier(e.target.value);
                        if (formError) setFormError(null);
                      }}
                    >
                      <option value="">Selecciona un proveedor</option>
                      {suppliers.map((supplier: Supplier) => (
                        <option key={supplier.id} value={supplier.id}>
                          {supplier.nombre}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div>
                    <Label required>Almacen destino</Label>
                    <Select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
                      <option value="">Selecciona un almacen</option>
                      {warehouses.map((warehouse: any) => (
                        <option key={warehouse.id} value={warehouse.id}>
                          {warehouse.nombre}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>

                <div className="overflow-hidden rounded-2xl border border-[var(--gray-200)]">
                  <div className="flex items-center justify-between border-b border-[var(--gray-200)] bg-[var(--gray-50)] px-4 py-3">
                    <div className="text-[11px] font-black uppercase tracking-[0.08em] text-[var(--gray-600)]">
                      Lineas de compra
                    </div>
                    <Button type="button" variant="secondary" size="sm" onClick={addLine}>
                      <Plus size={14} className="mr-1.5" />
                      Agregar linea
                    </Button>
                  </div>

                  <div className="divide-y divide-[var(--gray-200)]">
                    {lines.map((line, index) => (
                      <div key={line.localId} className="space-y-4 px-4 py-4">
                        <div className="text-[11px] font-black uppercase tracking-[0.08em] text-[var(--gray-400)]">
                          Linea {index + 1}
                        </div>
                        <div className="grid grid-cols-1 gap-3 xl:grid-cols-12">
                          <div className="xl:col-span-7">
                            <Label required>Producto</Label>
                            <Select
                              value={line.product}
                              onChange={(e) => handleLineChange(line.localId, 'product', e.target.value)}
                            >
                              <option value="">Selecciona un producto</option>
                              {products.map((product) => (
                                <option key={product.id} value={product.id}>
                                  {product.codigo} - {product.nombre}
                                </option>
                              ))}
                            </Select>
                          </div>
                          <div className="xl:col-span-2">
                            <Label required>Cantidad</Label>
                            <Input
                              type="number"
                              step="1"
                              min="1"
                              className="max-w-[120px]"
                              value={line.cantidad_pedida}
                              onChange={(e) => handleLineChange(line.localId, 'cantidad_pedida', e.target.value)}
                            />
                          </div>
                          <div className="xl:col-span-2">
                            <Label required>Costo unit.</Label>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              className="max-w-[150px]"
                              value={line.precio_unitario}
                              onChange={(e) => handleLineChange(line.localId, 'precio_unitario', e.target.value)}
                            />
                          </div>
                          <div className="flex items-end justify-center xl:col-span-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-10 w-10 text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)] hover:text-[var(--color-danger)]"
                              onClick={() => removeLine(line.localId)}
                              disabled={lines.length === 1}
                            >
                              <Trash2 size={16} />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-[var(--gray-200)] bg-[var(--gray-50)] px-4 py-3 text-right">
                    <span className="text-sm font-semibold text-[var(--gray-500)]">Subtotal estimado:</span>{' '}
                    <span className="text-lg font-black text-[var(--gray-900)]">S/ {estimatedSubtotal.toFixed(2)}</span>
                  </div>
                </div>

                <div>
                  <Label>Referencia o nota (opcional)</Label>
                  <Textarea
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Ej: Reposicion urgente, factura #1234..."
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-[var(--gray-200)] px-6 py-4">
                <Button type="button" variant="secondary" onClick={() => navigate('/suppliers/orders')}>
                  Cancelar
                </Button>
                <Button type="submit" variant="primary" disabled={createPurchaseOrder.isPending || updatePurchaseOrder.isPending}>
                  {isEditing ? 'Guardar borrador' : 'Crear borrador'}
                </Button>
              </div>
            </form>
          </div>
        </div>

        <aside className="xl:col-span-4">
          <div className="rounded-[22px] border border-[var(--gray-200)] bg-white p-5 shadow-[0_14px_32px_rgba(15,23,42,0.06)]">
            <div className="border-b border-[var(--gray-200)] pb-4">
              <div className="text-[11px] font-black uppercase tracking-[0.08em] text-[var(--gray-500)]">
                Stock critico
              </div>
              <h2 className="mt-2 text-lg font-black text-[var(--gray-900)]">
                Productos para reponer
              </h2>
              <p className="mt-1 text-sm text-[var(--gray-500)]">
                Referencia rapida para armar la orden sin perder de vista los faltantes.
              </p>
            </div>

            <div className="mt-4 space-y-3">
              {purchaseSuggestions.slice(0, 8).map((suggestion) => (
                <div
                  key={suggestion.product_id}
                  className="rounded-2xl border border-[var(--gray-200)] bg-[var(--gray-50)] px-4 py-3"
                >
                  <div>
                    <div className="text-[11px] font-black uppercase tracking-[0.06em] text-[var(--color-brand-blue)]">
                      {suggestion.product_code}
                    </div>
                    <button
                      type="button"
                      className="mt-1 cursor-pointer text-left text-sm font-semibold text-[var(--gray-800)] transition-colors hover:text-[var(--color-brand-blue)]"
                      onClick={() => addSuggestedProduct(suggestion.product_id, suggestion.suggested_quantity)}
                    >
                      {suggestion.product_name}
                    </button>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-[var(--gray-500)]">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-[0.06em] text-[var(--gray-400)]">
                        Disponible
                      </span>
                      <span className="font-semibold text-[var(--gray-700)]">{formatInteger(suggestion.available)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-[0.06em] text-[var(--gray-400)]">
                        Sugerido
                      </span>
                      <span className="font-semibold text-[var(--color-danger)]">{formatInteger(suggestion.suggested_quantity)}</span>
                    </div>
                  </div>
                </div>
              ))}

              {purchaseSuggestions.length === 0 && (
                <div className="rounded-2xl border border-dashed border-[var(--gray-200)] bg-[var(--gray-50)] px-4 py-6 text-center text-sm text-[var(--gray-500)]">
                  No hay productos en stock critico ahora mismo.
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
