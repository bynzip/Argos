import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { ArrowLeft, BadgeDollarSign, Boxes, Info, Package, Save } from 'lucide-react';

import { useBrands, useCategories, useProduct, useUpdateProduct } from '../../hooks/useProducts';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Label } from '../../components/ui/Label';
import { PageHeader } from '../../components/ui/PageHeader';
import { Select } from '../../components/ui/Select';
import { Textarea } from '../../components/ui/Textarea';
import { getApiErrorMessage } from '../../lib/apiErrors';

const productSchema = z.object({
  nombre: z.string().min(2, 'El nombre es obligatorio'),
  codigo: z.string().min(2, 'El SKU es obligatorio'),
  descripcion: z.string().optional(),
  category: z.string().min(1, 'La categoría es obligatoria'),
  brand: z.string().min(1, 'La marca es obligatoria'),
  precio_costo: z.string().optional(),
  precio_venta: z.string().min(1, 'El precio de venta es obligatorio'),
  stock_minimo: z.number().int('Debe ser un número entero').min(0),
  unidad: z.string().min(1, 'La unidad es obligatoria'),
  is_serializable: z.boolean().default(false),
  activo: z.boolean().default(true),
});

type ProductForm = z.infer<typeof productSchema>;

export default function ProductEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: product, isLoading } = useProduct(id || null);
  const { data: categories } = useCategories();
  const { data: brands } = useBrands();
  const updateProduct = useUpdateProduct(id || '');
  const [skuError, setSkuError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ProductForm>({
    resolver: zodResolver(productSchema),
  });

  useEffect(() => {
    if (product) {
      reset({
        nombre: product.nombre,
        codigo: product.codigo,
        descripcion: product.descripcion || '',
        category: String(product.category),
        brand: String(product.brand),
        precio_costo: product.precio_costo || '',
        precio_venta: product.precio_venta,
        stock_minimo: product.stock_minimo,
        unidad: product.unidad || 'UNIDAD',
        is_serializable: Boolean(product.is_serializable),
        activo: product.activo,
      });
    }
  }, [product, reset]);

  const isSerializable = watch('is_serializable');
  const isActive = watch('activo');

  const onSubmit = async (data: ProductForm) => {
    try {
      setSkuError(null);
      setSubmitError(null);
      await updateProduct.mutateAsync({
        ...data,
        category: parseInt(data.category, 10),
        brand: parseInt(data.brand, 10),
        precio_costo: data.precio_costo || undefined,
      });
      navigate(`/inventory/${id}`);
    } catch (error: any) {
      if (error.response?.data?.codigo) {
        setSkuError(error.response.data.codigo[0]);
      } else {
        setSubmitError(getApiErrorMessage(error, 'No se pudo actualizar el producto.'));
      }
    }
  };

  if (isLoading) {
    return (
      <div className="p-20 flex justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-brand-blue)] border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-[1080px] mx-auto">
      <div className="mb-8">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(`/inventory/${id}`)}
          className="mb-4 text-[var(--gray-500)]"
        >
          <ArrowLeft size={16} className="mr-2" />
          Volver al producto
        </Button>
        <PageHeader
          title="Editar Producto"
          subtitle={`Actualiza la información técnica y comercial de ${product?.nombre || 'este producto'}.`}
        />
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {submitError && (
          <div className="rounded-xl border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] px-4 py-3 text-sm font-medium text-[var(--color-danger)]">
            {submitError}
          </div>
        )}

        <div className="form-card">
          <div className="form-section-title flex items-center gap-2">
            <Package size={16} /> Identificación del Producto
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-4 space-y-1.5">
              <Label required>Código Único (SKU)</Label>
              <Input
                type="text"
                placeholder="Ej. PANT-LED-001"
                error={!!(errors.codigo || skuError)}
                {...register('codigo', {
                  onChange: () => {
                    if (skuError) setSkuError(null);
                    if (submitError) setSubmitError(null);
                  },
                })}
              />
              {(errors.codigo || skuError) && <span className="form-error">{errors.codigo?.message || skuError}</span>}
            </div>

            <div className="lg:col-span-8 space-y-1.5">
              <Label required>Nombre del Producto / Repuesto</Label>
              <Input
                type="text"
                placeholder="Ej. Pantalla LED 15.6 30 pines"
                error={!!errors.nombre}
                {...register('nombre')}
              />
              {errors.nombre && <span className="form-error">{errors.nombre.message}</span>}
            </div>

            <div className="lg:col-span-4 space-y-1.5">
              <Label required>Categoría</Label>
              <Select {...register('category')} error={!!errors.category}>
                <option value="">Seleccione categoría...</option>
                {categories?.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.nombre}
                  </option>
                ))}
              </Select>
              {errors.category && <span className="form-error">{errors.category.message}</span>}
            </div>

            <div className="lg:col-span-4 space-y-1.5">
              <Label required>Marca</Label>
              <Select {...register('brand')} error={!!errors.brand}>
                <option value="">Seleccione marca...</option>
                {brands?.map((brand) => (
                  <option key={brand.id} value={brand.id}>
                    {brand.nombre}
                  </option>
                ))}
              </Select>
              {errors.brand && <span className="form-error">{errors.brand.message}</span>}
            </div>

            <div className="lg:col-span-4 space-y-1.5">
              <Label required>Unidad</Label>
              <Select {...register('unidad')} error={!!errors.unidad}>
                <option value="UNIDAD">Unidad</option>
                <option value="METRO">Metro</option>
                <option value="LITRO">Litro</option>
                <option value="PAR">Par</option>
                <option value="CAJA">Caja</option>
              </Select>
              {errors.unidad && <span className="form-error">{errors.unidad.message}</span>}
            </div>

            <div className="lg:col-span-6">
              <div className="rounded-2xl border border-[var(--gray-200)] bg-[var(--gray-50)] px-4 py-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-sm font-bold text-[var(--gray-800)]">Producto serializable</div>
                  <div className="text-xs text-[var(--gray-500)]">Mantiene el comportamiento especial de series en compras.</div>
                </div>
                <label htmlFor="is_serializable" className="inline-flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    id="is_serializable"
                    className="w-5 h-5 rounded border-[var(--gray-300)] text-[var(--color-brand-blue)]"
                    {...register('is_serializable')}
                  />
                  <span className="text-sm font-semibold text-[var(--gray-700)]">
                    {isSerializable ? 'Sí, requiere series' : 'No, manejo estándar'}
                  </span>
                </label>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="rounded-2xl border border-[var(--gray-200)] bg-[var(--gray-50)] px-4 py-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-sm font-bold text-[var(--gray-800)]">Disponibilidad</div>
                  <div className="text-xs text-[var(--gray-500)]">Controla si el producto sigue vigente para uso o venta.</div>
                </div>
                <label htmlFor="activo" className="inline-flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    id="activo"
                    className="w-5 h-5 rounded border-[var(--gray-300)] text-[var(--color-brand-blue)]"
                    {...register('activo')}
                  />
                  <span className="text-sm font-semibold text-[var(--gray-700)]">
                    {isActive ? 'Activo' : 'Inactivo'}
                  </span>
                </label>
              </div>
            </div>
          </div>

          <div className="form-section-title mt-12 flex items-center gap-2">
            <BadgeDollarSign size={16} /> Precios e Inventario
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
            <div className="md:col-span-5 space-y-1.5">
              <Label required>Precio Venta (S/)</Label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--gray-400)] font-bold">
                  S/
                </span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  className="pl-9 font-bold"
                  {...register('precio_venta')}
                />
              </div>
              {errors.precio_venta && <span className="form-error">{errors.precio_venta.message}</span>}
            </div>

            <div className="md:col-span-5 space-y-1.5">
              <Label>Precio Costo (S/)</Label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--gray-400)] font-bold">
                  S/
                </span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  className="pl-9"
                  {...register('precio_costo')}
                />
              </div>
            </div>

            <div className="md:col-span-2 space-y-1.5">
              <Label required>Stock Mínimo</Label>
              <Input
                type="number"
                step="1"
                min="0"
                {...register('stock_minimo', { valueAsNumber: true })}
              />
              {errors.stock_minimo && <span className="form-error">{errors.stock_minimo.message}</span>}
            </div>
          </div>

          <div className="form-section-title mt-12 flex items-center gap-2">
            <Info size={16} /> Detalles Adicionales
          </div>

          <div className="space-y-1.5">
            <Label>
              <div className="flex items-center gap-1.5">
                <Boxes size={14} className="text-[var(--gray-400)]" />
                Descripción técnica / Notas
              </div>
            </Label>
            <Textarea
              rows={4}
              placeholder="Especificaciones, compatibilidad o notas sobre el repuesto..."
              {...register('descripcion')}
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4">
          <Button
            type="button"
            variant="ghost"
            onClick={() => navigate(`/inventory/${id}`)}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
            variant="primary"
            className="px-10 h-11"
          >
            <Save size={18} className="mr-2" />
            {isSubmitting ? 'Guardando...' : 'Guardar Cambios'}
          </Button>
        </div>
      </form>
    </div>
  );
}
