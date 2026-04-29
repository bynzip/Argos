import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useProduct, useUpdateProduct, useProductCategories, useProductBrands } from '../../hooks/useProducts';
import { ArrowLeft, Save, Package, Hash, Tag, Info, AlertTriangle, Boxes, BadgeDollarSign } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Label } from '../../components/ui/Label';
import { Select } from '../../components/ui/Select';
import { Textarea } from '../../components/ui/Textarea';

const productSchema = z.object({
  nombre: z.string().min(2, 'El nombre es obligatorio'),
  codigo: z.string().min(2, 'El código es obligatorio'),
  descripcion: z.string().optional(),
  category: z.string().min(1, 'La categoría es obligatoria'),
  brand: z.string().min(1, 'La marca es obligatoria'),
  precio_costo: z.string().optional(),
  precio_venta: z.string().min(1, 'El precio de venta es obligatorio'),
  stock_minimo: z.number().min(0),
  activo: z.boolean().default(true),
});

type ProductForm = z.infer<typeof productSchema>;

export default function ProductEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: product, isLoading } = useProduct(id || null);
  const { data: categories } = useProductCategories();
  const { data: brands } = useProductBrands();
  const updateProduct = useUpdateProduct(id || '');

  const {
    register,
    handleSubmit,
    reset,
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
        category: product.category.toString(),
        brand: product.brand.toString(),
        precio_costo: product.precio_costo || '',
        precio_venta: product.precio_venta,
        stock_minimo: product.stock_minimo,
        activo: product.activo,
      });
    }
  }, [product, reset]);

  const onSubmit = async (data: ProductForm) => {
    try {
      await updateProduct.mutateAsync({
        ...data,
        precio_costo: data.precio_costo || undefined,
      });
      navigate(`/inventory/${id}`);
    } catch (error) {
      console.error('Error updating product:', error);
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
    <div className="p-8 max-w-[1000px] mx-auto">
      {/* Header & Navigation */}
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
          subtitle={`Actualiza la información técnica y de stock de ${product?.nombre || 'este producto'}.`}
        />
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        <div className="form-card">
          <div className="form-section-title flex items-center gap-2">
            <Package size={16} /> Identificación del Producto
          </div>
          
          <div className="form-grid-2">
            <div className="form-field form-grid-full">
              <Label required>Nombre del Producto / Repuesto</Label>
              <Input
                type="text"
                placeholder="Ej. Pantalla LED 15.6'' 30 pines"
                error={!!errors.nombre}
                {...register('nombre')}
              />
              {errors.nombre && <span className="form-error">{errors.nombre.message}</span>}
            </div>

            <div className="form-field">
              <Label required>Código Único (SKU)</Label>
              <Input
                type="text"
                placeholder="Ej. PANT-LED-001"
                error={!!errors.codigo}
                {...register('codigo')}
              />
              {errors.codigo && <span className="form-error">{errors.codigo.message}</span>}
            </div>

            <div className="form-field">
              <Label required>Categoría</Label>
              <Select {...register('category')}>
                <option value="">Seleccione categoría...</option>
                {categories?.map(c => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </Select>
              {errors.category && <span className="form-error">{errors.category.message}</span>}
            </div>

            <div className="form-field">
              <Label required>Marca</Label>
              <Select {...register('brand')}>
                <option value="">Seleccione marca...</option>
                {brands?.map(b => (
                  <option key={b.id} value={b.id}>{b.nombre}</option>
                ))}
              </Select>
              {errors.brand && <span className="form-error">{errors.brand.message}</span>}
            </div>

            <div className="form-field">
              <Label required>Estado del Producto</Label>
              <div className="flex items-center gap-3 h-10 px-1">
                <input
                  type="checkbox"
                  id="activo"
                  className="w-4 h-4 rounded border-[var(--gray-300)] text-[var(--color-brand-blue)] focus:ring-[var(--color-brand-blue)]"
                  {...register('activo')}
                />
                <label htmlFor="activo" className="text-sm font-medium text-[var(--gray-700)] cursor-pointer">
                  Producto disponible para venta/uso
                </label>
              </div>
            </div>
          </div>

          <div className="form-section-title mt-12 flex items-center gap-2">
            <BadgeDollarSign size={16} /> Precios e Inventario
          </div>

          <div className="form-grid-2">
            <div className="form-field">
              <Label required>Precio Venta (S/)</Label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--gray-400)] font-bold">S/</span>
                <Input
                  type="number"
                  step="0.01"
                  className="pl-9 font-bold"
                  {...register('precio_venta')}
                />
              </div>
              {errors.precio_venta && <span className="form-error">{errors.precio_venta.message}</span>}
            </div>

            <div className="form-field">
              <Label>Precio Costo (S/)</Label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--gray-400)] font-bold">S/</span>
                <Input
                  type="number"
                  step="0.01"
                  className="pl-9"
                  {...register('precio_costo')}
                />
              </div>
            </div>

            <div className="form-field">
              <Label required>Stock Mínimo (Alerta)</Label>
              <Input
                type="number"
                {...register('stock_minimo', { valueAsNumber: true })}
              />
              <p className="text-[11px] text-[var(--gray-400)] mt-1">Se generará una alerta cuando el stock sea menor o igual a este valor.</p>
            </div>
          </div>

          <div className="form-section-title mt-12 flex items-center gap-2">
            <Info size={16} /> Detalles Adicionales
          </div>

          <div className="form-field form-grid-full">
            <Label>Descripción técnica / Notas</Label>
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
            {isSubmitting ? 'Guardando...' : '💾 Guardar Cambios'}
          </Button>
        </div>
      </form>
    </div>
  );
}
