import { useParams, useNavigate } from 'react-router-dom';
import { useProducts } from '../../hooks/useProducts';
import { useAuthStore } from '../../store/authStore';
import { ArrowLeft, Edit, Package, Hash, Tag, Info, AlertTriangle } from 'lucide-react';

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const productId = id ? parseInt(id, 10) : null;
  
  const canViewCost = user?.role === 'Administrador' || user?.role === 'Almacenero' || user?.is_superuser;
  
  const { data: products = [], isLoading } = useProducts();
  const product = products.find(p => p.id === productId);

  if (isLoading) {
    return (
      <div className="flex justify-center p-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-blue border-t-transparent"></div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="p-8 text-center text-red-600 font-semibold text-lg">
        El producto no existe o fue eliminado.
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 p-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/inventory')}
            className="p-2 rounded-xl hover:bg-slate-200 border border-transparent hover:border-slate-300 text-slate-500 transition-all bg-white shadow-sm cursor-pointer"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-4">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-blue-50 text-brand-blue shadow-inner border border-blue-100">
              <Package size={28} />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">{product.nombre}</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm font-bold text-brand-blue uppercase tracking-widest bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-100">
                  {product.codigo}
                </span>
                <span className="text-slate-300">•</span>
                <span className="text-sm font-medium text-slate-500">{product.category_name}</span>
              </div>
            </div>
          </div>
        </div>
        <button 
          onClick={() => alert("Funcionalidad de edición de producto estará disponible en breve.")}
          className="px-4 py-2 bg-white text-slate-700 border border-slate-300 rounded-md text-sm font-medium hover:bg-slate-50 flex items-center justify-center flex-1 sm:flex-none cursor-pointer"
        >
          <Edit size={16} className="mr-2" />
          Editar Producto
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Panel Izquierdo: Precios y Stock */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-lg shadow border border-slate-200 p-6 border-l-4 border-l-brand-blue">
            <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
              <Info size={18} className="text-brand-blue" />
              Estado de Inventario
            </h2>
            
            <div className="space-y-6">
              <div>
                <dt className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-2">Existencia Total</dt>
                <dd className="flex items-baseline gap-2">
                  <span className={`text-5xl font-black ${product.total_stock <= product.stock_minimo ? 'text-red-600' : 'text-slate-900'}`}>
                    {product.total_stock}
                  </span>
                  <span className="text-slate-400 font-bold text-lg">Unidades</span>
                </dd>
                {product.total_stock <= product.stock_minimo && (
                  <div className="mt-3 flex items-center gap-2 text-red-600 bg-red-50 p-2 rounded-xl border border-red-100">
                    <AlertTriangle size={16} />
                    <span className="text-xs font-bold uppercase tracking-tight">Stock Crítico (Mín: {product.stock_minimo})</span>
                  </div>
                )}
              </div>

              <div className="pt-6 border-t border-slate-100">
                <dt className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3">Precios</dt>
                <div className="grid grid-cols-1 gap-4">
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Precio Venta</span>
                    <span className="text-2xl font-black text-slate-900 leading-none">S/ {parseFloat(product.precio_venta).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                  {canViewCost && product.precio_costo && (
                    <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100">
                      <span className="text-[10px] font-bold text-orange-400 uppercase block mb-1">Precio Costo</span>
                      <span className="text-2xl font-black text-orange-700 leading-none">S/ {parseFloat(product.precio_costo).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Panel Derecho: Detalles y Ubicaciones */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-lg shadow border border-slate-200 p-8">
            <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
              <Hash size={20} className="text-brand-blue" />
              Especificaciones Técnicas
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-sm">
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-1">Marca</label>
                  <p className="text-base font-bold text-slate-800 flex items-center gap-2">
                    <Tag size={14} className="text-brand-orange" />
                    {product.brand_name}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-1">Descripción</label>
                  <p className="text-slate-600 leading-relaxed italic">
                    {product.descripcion || 'Sin descripción adicional registrada.'}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-2">Ubicación en Almacén</label>
                  {/* Aquí iría el mapeo de stock_items si hubiera más almacenes */}
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-700">Almacén Principal</span>
                    <span className="bg-white px-3 py-1 rounded-lg border border-slate-200 font-black text-brand-blue">
                      {product.total_stock} und.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
