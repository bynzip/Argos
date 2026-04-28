import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useProduct, useUpdateProduct, useCategories, useBrands } from '../../hooks/useProducts';
import { ArrowLeft, Save } from 'lucide-react';
import { useEffect } from 'react';

const productSchema = z.object({
  nombre: z.string().min(2, 'El nombre es obligatorio'),
  descripcion: z.string().optional(),
  category: z.string().min(1, 'La categoría es obligatoria'),
  brand: z.string().min(1, 'La marca es obligatoria'),
  precio_costo: z.string().min(1, 'El precio de costo es obligatorio'),
  precio_venta: z.string().min(1, 'El precio de venta es obligatorio'),
  stock_minimo: z.number().min(0, 'Debe ser 0 o más'),
  activo: z.boolean(),
});

type ProductForm = z.infer<typeof productSchema>;

export default function ProductEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: product, isLoading } = useProduct(id || null);
  const updateProduct = useUpdateProduct(id || '');
  const { data: categories = [] } = useCategories();
  const { data: brands = [] } = useBrands();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProductForm>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      stock_minimo: 5,
      activo: true,
    },
  });

  useEffect(() => {
    if (product) {
      reset({
        nombre: product.nombre,
        descripcion: product.descripcion,
        category: product.category.toString(),
        brand: product.brand.toString(),
        precio_costo: product.precio_costo,
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
        category: parseInt(data.category),
        brand: parseInt(data.brand),
        precio_costo: data.precio_costo,
        precio_venta: data.precio_venta,
      } as any);
      navigate(`/inventory/${id}`);
    } catch (error) {
      console.error('Error updating product:', error);
    }
  };

  if (isLoading) return <div className="p-6">Cargando producto...</div>;
  if (!product) return <div className="p-6">Producto no encontrado.</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(`/inventory/${id}`)}
            className="p-3 rounded-2xl hover:bg-slate-200 border border-transparent hover:border-slate-300 text-slate-500 transition-all bg-white shadow-sm"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Editar Producto</h1>
            <p className="muted-copy mt-1 font-medium">{product.codigo} - {product.nombre}</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="surface-card p-8 bg-white rounded-lg shadow">
          <div className="grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-6">
            
            <div className="sm:col-span-6">
              <label htmlFor="nombre" className="field-label block text-sm font-medium text-gray-700">Nombre del Producto *</label>
              <input
                type="text"
                id="nombre"
                {...register('nombre')}
                className="field-input mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
              {errors.nombre && <p className="mt-2 text-sm text-red-500 font-medium">{errors.nombre.message}</p>}
            </div>

            <div className="sm:col-span-3">
              <label htmlFor="category" className="field-label block text-sm font-medium text-gray-700">Categoría *</label>
              <select id="category" {...register('category')} className="field-input mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500">
                <option value="">Seleccionar...</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
              {errors.category && <p className="mt-2 text-sm text-red-500 font-medium">{errors.category.message}</p>}
            </div>

            <div className="sm:col-span-3">
              <label htmlFor="brand" className="field-label block text-sm font-medium text-gray-700">Marca *</label>
              <select id="brand" {...register('brand')} className="field-input mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500">
                <option value="">Seleccionar...</option>
                {brands.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
              </select>
              {errors.brand && <p className="mt-2 text-sm text-red-500 font-medium">{errors.brand.message}</p>}
            </div>

            <div className="sm:col-span-3">
              <label htmlFor="precio_costo" className="field-label block text-sm font-medium text-gray-700">Precio Costo (S/) *</label>
              <input
                type="number"
                step="0.01"
                id="precio_costo"
                {...register('precio_costo')}
                className="field-input mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            <div className="sm:col-span-3">
              <label htmlFor="precio_venta" className="field-label block text-sm font-medium text-gray-700">Precio Venta (S/) *</label>
              <input
                type="number"
                step="0.01"
                id="precio_venta"
                {...register('precio_venta')}
                className="field-input mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            <div className="sm:col-span-3">
              <label htmlFor="stock_minimo" className="field-label block text-sm font-medium text-gray-700">Stock Mínimo</label>
              <input
                type="number"
                id="stock_minimo"
                {...register('stock_minimo', { valueAsNumber: true })}
                className="field-input mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            <div className="sm:col-span-3 flex items-center pt-6">
              <input
                type="checkbox"
                id="activo"
                {...register('activo')}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="activo" className="ml-2 block text-sm text-gray-900">
                Producto Activo
              </label>
            </div>

            <div className="sm:col-span-6">
              <label htmlFor="descripcion" className="field-label block text-sm font-medium text-gray-700">Descripción</label>
              <textarea
                id="descripcion"
                rows={3}
                {...register('descripcion')}
                className="field-input mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-x-4">
          <button type="button" onClick={() => navigate(`/inventory/${id}`)} className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
            Cancelar
          </button>
          <button type="submit" disabled={isSubmitting} className="inline-flex justify-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50">
            <Save size={18} className="mr-2" />
            {isSubmitting ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      </form>
    </div>
  );
}