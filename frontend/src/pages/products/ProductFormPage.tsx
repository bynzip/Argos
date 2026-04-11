import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useCreateProduct, useCategories, useBrands } from '../../hooks/useProducts';
import { ArrowLeft, Save } from 'lucide-react';

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
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/inventory')}
            className="p-3 rounded-2xl hover:bg-slate-200 border border-transparent hover:border-slate-300 text-slate-500 transition-all bg-white shadow-sm"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Nuevo Producto</h1>
            <p className="muted-copy mt-1 font-medium">Registra un nuevo item en el catálogo</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="surface-card p-8">
          <div className="grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-6">
            
            <div className="sm:col-span-6">
              <label htmlFor="nombre" className="field-label">Nombre del Producto *</label>
              <input
                type="text"
                id="nombre"
                {...register('nombre')}
                className="field-input w-full"
                placeholder="Ej. Kit de Mantenimiento HP G8"
              />
              {errors.nombre && <p className="mt-2 text-sm text-red-500 font-medium">{errors.nombre.message}</p>}
            </div>

            <div className="sm:col-span-3">
              <label htmlFor="category" className="field-label">Categoría *</label>
              <select id="category" {...register('category')} className="field-input w-full">
                <option value="">Seleccionar...</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
              {errors.category && <p className="mt-2 text-sm text-red-500 font-medium">{errors.category.message}</p>}
            </div>

            <div className="sm:col-span-3">
              <label htmlFor="brand" className="field-label">Marca *</label>
              <select id="brand" {...register('brand')} className="field-input w-full">
                <option value="">Seleccionar...</option>
                {brands.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
              </select>
              {errors.brand && <p className="mt-2 text-sm text-red-500 font-medium">{errors.brand.message}</p>}
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="precio_costo" className="field-label">Precio Costo (S/) *</label>
              <input
                type="number"
                step="0.01"
                id="precio_costo"
                {...register('precio_costo')}
                className="field-input w-full"
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="precio_venta" className="field-label">Precio Venta (S/) *</label>
              <input
                type="number"
                step="0.01"
                id="precio_venta"
                {...register('precio_venta')}
                className="field-input w-full"
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="initial_stock" className="field-label">Stock Inicial</label>
              <input
                type="number"
                id="initial_stock"
                {...register('initial_stock', { valueAsNumber: true })}
                className="field-input w-full"
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="stock_minimo" className="field-label">Stock Mínimo</label>
              <input
                type="number"
                id="stock_minimo"
                {...register('stock_minimo', { valueAsNumber: true })}
                className="field-input w-full"
              />
            </div>

            <div className="sm:col-span-6">
              <label htmlFor="descripcion" className="field-label">Descripción</label>
              <textarea
                id="descripcion"
                rows={3}
                {...register('descripcion')}
                className="field-input w-full"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-x-4">
          <button type="button" onClick={() => navigate('/inventory')} className="secondary-button text-sm">
            Cancelar
          </button>
          <button type="submit" disabled={isSubmitting} className="primary-button text-sm">
            <Save size={18} />
            {isSubmitting ? 'Guardando...' : 'Guardar Producto'}
          </button>
        </div>
      </form>
    </div>
  );
}
