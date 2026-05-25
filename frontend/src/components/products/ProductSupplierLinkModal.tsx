import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';

import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { Select } from '../ui/Select';
import { PaginatedResponse, Product, ProductSupplier, useCreateProductSupplier, useProducts, useUpdateProductSupplier } from '../../hooks/useProducts';
import { Supplier, useSuppliers } from '../../hooks/useSuppliers';
import { getApiErrorMessage } from '../../lib/apiErrors';

type ProductSupplierLinkModalProps = {
  open: boolean;
  onClose: () => void;
  initialProductId?: number | null;
  initialSupplierId?: number | null;
  editingLink?: ProductSupplier | null;
};

const EMPTY_FORM = {
  product: '',
  supplier: '',
  lead_time_days: '',
};

export default function ProductSupplierLinkModal({
  open,
  onClose,
  initialProductId = null,
  initialSupplierId = null,
  editingLink = null,
}: ProductSupplierLinkModalProps) {
  const { data: suppliersData = [] } = useSuppliers();
  const { data: productsData } = useProducts({ page_size: 200, activo: true });
  const createProductSupplier = useCreateProductSupplier();
  const updateProductSupplier = useUpdateProductSupplier();

  const suppliers = suppliersData || [];
  const products = useMemo(() => (
    productsData && !Array.isArray(productsData) && 'results' in productsData
      ? (productsData as PaginatedResponse<Product>).results
      : Array.isArray(productsData) ? productsData : []
  ), [productsData]);

  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    if (editingLink) {
      setForm({
        product: String(editingLink.product),
        supplier: String(editingLink.supplier ?? ''),
        lead_time_days: editingLink.lead_time_days ? String(editingLink.lead_time_days) : '',
      });
      setError(null);
      return;
    }

    setForm({
      product: initialProductId ? String(initialProductId) : '',
      supplier: initialSupplierId ? String(initialSupplierId) : '',
      lead_time_days: '',
    });
    setError(null);
  }, [open, editingLink, initialProductId, initialSupplierId]);

  if (!open) return null;

  const handleSave = async () => {
    if (!form.product || !form.supplier) {
      setError('Debes seleccionar un producto y un proveedor.');
      return;
    }

    const payload = {
      product: Number(form.product),
      supplier: Number(form.supplier),
      supplier_price: null,
      lead_time_days: form.lead_time_days ? Number(form.lead_time_days) : null,
      is_primary: false,
    };

    try {
      setError(null);
      if (editingLink) {
        await updateProductSupplier.mutateAsync({
          id: editingLink.id,
          ...payload,
        });
      } else {
        await createProductSupplier.mutateAsync(payload);
      }
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudo guardar la relacion.'));
    }
  };

  const isPending = createProductSupplier.isPending || updateProductSupplier.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,23,42,0.38)] p-4">
      <div className="w-full max-w-[620px] rounded-3xl border border-[var(--gray-200)] bg-white shadow-[0_24px_60px_rgba(15,23,42,0.18)]">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--gray-100)] px-6 py-5">
          <div>
            <h3 className="text-lg font-black text-[var(--gray-900)]">
              {editingLink ? 'Editar relacion proveedor-producto' : 'Relacionar proveedor con producto'}
            </h3>
            <p className="mt-1 text-sm text-[var(--gray-500)]">
              Define el proveedor del producto y el tiempo estimado de entrega.
            </p>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} className="shrink-0">
            <X size={18} />
          </Button>
        </div>

        <div className="space-y-5 px-6 py-6">
          {error && (
            <div className="rounded-xl border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] px-4 py-3 text-sm font-medium text-[var(--color-danger)]">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label required>Producto</Label>
              <Select
                value={form.product}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, product: e.target.value }));
                  if (error) setError(null);
                }}
              >
                <option value="">Selecciona producto</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.codigo} - {product.nombre}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <Label required>Proveedor</Label>
              <Select
                value={form.supplier}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, supplier: e.target.value }));
                  if (error) setError(null);
                }}
              >
                <option value="">Selecciona proveedor</option>
                {suppliers.map((supplier: Supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.nombre}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div>
            <Label>Dias de entrega</Label>
            <Input
              type="number"
              step="1"
              min="0"
              value={form.lead_time_days}
              onChange={(e) => {
                setForm((prev) => ({ ...prev, lead_time_days: e.target.value }));
                if (error) setError(null);
              }}
              placeholder="Ej. 3"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleSave} disabled={isPending}>
              {editingLink ? 'Guardar relacion' : 'Guardar relacion'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
