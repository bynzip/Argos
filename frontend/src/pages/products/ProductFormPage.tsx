import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { ArrowLeft, BadgeDollarSign, Boxes, Info, Package, Save } from 'lucide-react';

import { useBrands, useCategories, useCreateProduct } from '../../hooks/useProducts';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Label } from '../../components/ui/Label';
import { PageHeader } from '../../components/ui/PageHeader';
import { Select } from '../../components/ui/Select';
import { Textarea } from '../../components/ui/Textarea';
import { getApiErrorMessage } from '../../lib/apiErrors';

const productSchema = z.object({
  codigo: z.string().min(2, 'El SKU es obligatorio'),
  nombre: z.string().min(2, 'El nombre es obligatorio'),
  descripcion: z.string().optional(),
  category: z.string().min(1, 'La categoría es obligatoria'),
  brand: z.string().min(1, 'La marca es obligatoria'),
  precio_costo: z.string().min(1, 'El precio de costo es obligatorio'),
  precio_venta: z.string().min(1, 'El precio de venta es obligatorio'),
  stock_minimo: z.number().int('Debe ser un número entero').min(0, 'Debe ser 0 o más'),
  initial_stock: z.number().int('Debe ser un número entero').min(0, 'Debe ser 0 o más'),
  unidad: z.string().min(1, 'La unidad es obligatoria'),
  is_serializable: z.boolean().default(false),
  activo: z.boolean(),
});

type ProductForm = z.infer<typeof productSchema>;

export default function ProductFormPage() {
  const navigate = useNavigate();
  const createProduct = useCreateProduct();
  const { data: categories = [] } = useCategories();
  const { data: brands = [] } = useBrands();
  const [skuError, setSkuError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ProductForm>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      codigo: '',
      stock_minimo: 5,
      initial_stock: 0,
      unidad: 'UNIDAD',
      is_serializable: false,
      activo: true,
    },
  });

  const isSerializable = watch('is_serializable');

  const onSubmit = async (data: ProductForm) => {
    try {
      setSkuError(null);
      setSubmitError(null);
      await createProduct.mutateAsync({
        ...data,
        codigo: data.codigo.trim(),
        category: parseInt(data.category, 10),
        brand: parseInt(data.brand, 10),
        precio_costo: parseFloat(data.precio_costo),
        precio_venta: parseFloat(data.precio_venta),
        initial_stock: data.initial_stock,
      });
      navigate('/inventory');
    } catch (error: any) {
      if (error.response?.data?.codigo) {
        setSkuError(error.response.data.codigo[0]);
      } else {
        setSubmitError(getApiErrorMessage(error, 'No se pudo crear el producto.'));
      }
    }
  };

  return (
    <div className="p-8 max-w-[1080px] mx-auto">
      <div className="mb-8">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/inventory')}
          className="mb-4 text-[var(--gray-500)]"
        >
          <ArrowLeft size={16} className="mr-2" />
          Volver al inventario
        </Button>
        <PageHeader
          title="Nuevo Producto"
          subtitle="Registra un nuevo item en el catálogo del taller."
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
              <Label required>SKU / Código</Label>
              <Input
                type="text"
                placeholder="Ej. FX-LCD-156-FHD-30P"
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
                placeholder="Ej. Batería compatible Dell Latitude E7440"
                error={!!errors.nombre}
                {...register('nombre')}
              />
              {errors.nombre && <span className="form-error">{errors.nombre.message}</span>}
            </div>

            <div className="lg:col-span-4 space-y-1.5">
              <Label required>Categoría</Label>
              <Select {...register('category')} error={!!errors.category}>
                <option value="">Seleccione categoría...</option>
                {categories.map((category) => (
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
                {brands.map((brand) => (
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

            <div className="lg:col-span-12">
              <div className="rounded-2xl border border-[var(--gray-200)] bg-[var(--gray-50)] px-4 py-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-sm font-bold text-[var(--gray-800)]">Producto serializable</div>
                  <div className="text-xs text-[var(--gray-500)]">
                    Por ahora solo afecta la recepción de compras y el registro de series.
                  </div>
                </div>
                <label htmlFor="is_serializable" className="inline-flex items-center gap-3 cursor-pointer">
                  <input
                    id="is_serializable"
                    type="checkbox"
                    className="h-5 w-5 rounded border-[var(--gray-300)]"
                    {...register('is_serializable')}
                  />
                  <span className="text-sm font-semibold text-[var(--gray-700)]">
                    {isSerializable ? 'Sí, requiere series' : 'No, manejo estándar'}
                  </span>
                </label>
              </div>
            </div>
          </div>

          <div className="form-section-title mt-12 flex items-center gap-2">
            <BadgeDollarSign size={16} /> Precios e Inventario Inicial
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
            <div className="md:col-span-4 space-y-1.5">
              <Label required>Precio Costo (S/)</Label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--gray-400)] font-bold">S/</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  className="pl-9"
                  {...register('precio_costo')}
                />
              </div>
            </div>

            <div className="md:col-span-4 space-y-1.5">
              <Label required>Precio Venta (S/)</Label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--gray-400)] font-bold">S/</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  className="pl-9 font-bold"
                  {...register('precio_venta')}
                />
              </div>
            </div>

            <div className="md:col-span-2 space-y-1.5">
              <Label required>Stock Inicial</Label>
              <Input
                type="number"
                step="1"
                min="0"
                {...register('initial_stock', { valueAsNumber: true })}
              />
              {errors.initial_stock && <span className="form-error">{errors.initial_stock.message}</span>}
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

          <div className="form-field form-grid-full">
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
            onClick={() => navigate('/inventory')}
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
            {isSubmitting ? 'Guardando...' : 'Guardar Producto'}
          </Button>
        </div>
      </form>
    </div>
  );
}
