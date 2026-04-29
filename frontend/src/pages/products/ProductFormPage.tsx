import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useCreateProduct, useCategories, useBrands } from '../../hooks/useProducts';
import { ArrowLeft, Save, Package, BadgeDollarSign, Info } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Label } from '../../components/ui/Label';
import { Select } from '../../components/ui/Select';
import { Textarea } from '../../components/ui/Textarea';

const productSchema = z.object({
  nombre: z.string().min(2, 'El nombre es obligatorio'),
  descripcion: z.string().optional(),
  category: z.string().min(1, 'La categoría es obligatoria'),
  brand: z.string().min(1, 'La marca es obligatoria'),
  precio_costo: z.string().min(1, 'El precio de costo es obligatorio'),
  precio_venta: z.string().min(1, 'El precio de venta es obligatorio'),
  stock_minimo: z.number().min(0, 'Debe ser 0 o más'),
  initial_stock: z.number().min(0, 'Debe ser 0 o más'),
  activo: z.boolean(),
});

type ProductForm = z.infer<typeof productSchema>;

export default function ProductFormPage() {
  const navigate = useNavigate();
  const createProduct = useCreateProduct();
  const { data: categories = [] } = useCategories();
  const { data: brands = [] } = useBrands();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProductForm>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      stock_minimo: 5,
      initial_stock: 0,
      activo: true,
    },
  });

  const onSubmit = async (data: ProductForm) => {
    try {
      await createProduct.mutateAsync({
        ...data,
        category: parseInt(data.category),
        brand: parseInt(data.brand),
        precio_costo: parseFloat(data.precio_costo),
        precio_venta: parseFloat(data.precio_venta),
        initial_stock: data.initial_stock,
      });
      navigate('/inventory');
    } catch (error) {
      console.error('Error creating product:', error);
    }
  };

  return (
    <div className="p-8 max-w-[1000px] mx-auto">
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
        <div className="form-card">
          <div className="form-section-title flex items-center gap-2">
            <Package size={16} /> Identificación del Producto
          </div>
          
          <div className="form-grid-2">
            <div className="form-field form-grid-full">
              <Label required>Nombre del Producto / Repuesto</Label>
              <Input
                type="text"
                placeholder="Ej. Batería compatible Dell Latitude E7440"
                error={!!errors.nombre}
                {...register('nombre')}
              />
              {errors.nombre && <span className="form-error">{errors.nombre.message}</span>}
            </div>

            <div className="form-field">
              <Label required>Categoría</Label>
              <Select {...register('category')} error={!!errors.category}>
                <option value="">Seleccione categoría...</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </Select>
              {errors.category && <span className="form-error">{errors.category.message}</span>}
            </div>

            <div className="form-field">
              <Label required>Marca</Label>
              <Select {...register('brand')} error={!!errors.brand}>
                <option value="">Seleccione marca...</option>
                {brands.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
              </Select>
              {errors.brand && <span className="form-error">{errors.brand.message}</span>}
            </div>
          </div>

          <div className="form-section-title mt-12 flex items-center gap-2">
            <BadgeDollarSign size={16} /> Precios e Inventario Inicial
          </div>

          <div className="form-grid-3">
            <div className="form-field">
              <Label required>Precio Costo (S/)</Label>
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
            </div>

            <div className="form-field">
              <Label required>Stock Inicial</Label>
              <Input
                type="number"
                {...register('initial_stock', { valueAsNumber: true })}
              />
            </div>

            <div className="form-field">
              <Label required>Stock Mínimo</Label>
              <Input
                type="number"
                {...register('stock_minimo', { valueAsNumber: true })}
              />
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
            {isSubmitting ? 'Guardando...' : '💾 Guardar Producto'}
          </Button>
        </div>
      </form>
    </div>
  );
}
