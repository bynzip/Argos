import { useParams, useNavigate, Link } from 'react-router-dom';
import { useProduct } from '../../hooks/useProducts';
import { useAuthStore } from '../../store/authStore';
import { ArrowLeft, Edit, Package, Hash, Tag, Info, AlertTriangle, Boxes, BadgeDollarSign } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { cn } from '../../lib/utils';

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: product, isLoading } = useProduct(id || null);
  const { user } = useAuthStore();
  
  const canViewCost = user?.role === 'Administrador' || user?.role === 'Almacenero' || user?.is_superuser;

  if (isLoading) {
    return (
      <div className="flex justify-center p-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-brand-blue)] border-t-transparent"></div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="p-20 text-center text-[var(--color-danger)] font-bold text-lg">
        El producto no existe o fue eliminado.
      </div>
    );
  }

  const isLowStock = product.total_stock <= product.stock_minimo;

  return (
    <div className="p-8 max-w-[1400px] mx-auto">
      {/* Header & Navigation */}
      <div className="mb-6">
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
          title={product.nombre}
          subtitle={`Categoría: ${product.category_name} — Marca: ${product.brand_name}`}
          actions={
            <div className="flex gap-2">
              <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-[13px] font-bold bg-[var(--color-info-bg)] text-[var(--color-brand-blue)] border border-[var(--color-info-border)] uppercase tracking-widest">
                {product.codigo}
              </span>
              {canViewCost && (
                <Link to={`/inventory/edit/${product.id}`}>
                  <Button variant="secondary">
                    <Edit size={16} className="mr-2" />
                    Editar Producto
                  </Button>
                </Link>
              )}
            </div>
          }
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Stock & Prices */}
        <div className="lg:col-span-4 space-y-8">
          
          {/* Stock Card */}
          <Card className={cn("border-l-4", isLowStock ? "border-l-[var(--color-danger)]" : "border-l-[var(--color-brand-blue)]")}>
            <CardHeader className="py-4 border-b border-[var(--gray-100)]">
              <CardTitle className="text-[13px] text-[var(--gray-400)] uppercase tracking-wider flex items-center gap-2">
                <Boxes size={14} /> Control de Inventario
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-8 space-y-8">
              <div className="text-center">
                <span className="text-[11px] font-bold text-[var(--gray-400)] uppercase tracking-widest block mb-2">Existencia Total</span>
                <div className="flex items-baseline justify-center gap-2">
                  <span className={cn(
                    "text-6xl font-black leading-none",
                    isLowStock ? "text-[var(--color-danger)]" : "text-[var(--gray-800)]"
                  )}>
                    {product.total_stock}
                  </span>
                  <span className="text-[var(--gray-400)] font-bold text-xl uppercase">und</span>
                </div>
                
                {isLowStock && (
                  <div className="mt-6 flex items-center justify-center gap-2 text-[var(--color-danger)] bg-[var(--color-danger-bg)] p-3 rounded-xl border border-[var(--color-danger-border)]">
                    <AlertTriangle size={18} />
                    <span className="text-xs font-bold uppercase tracking-tight">Stock Crítico (Mín: {product.stock_minimo})</span>
                  </div>
                )}
              </div>

              <div className="pt-8 border-t border-[var(--gray-100)]">
                <span className="text-[11px] font-bold text-[var(--gray-400)] uppercase tracking-widest block mb-4">Estructura de Precios</span>
                <div className="space-y-4">
                  <div className="bg-[var(--gray-50)] p-5 rounded-2xl border border-[var(--gray-100)] flex justify-between items-center">
                    <div>
                      <span className="text-[10px] font-bold text-[var(--gray-400)] uppercase block mb-1">Precio de Venta</span>
                      <span className="text-2xl font-black text-[var(--gray-900)] leading-none">
                        S/ {parseFloat(product.precio_venta).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <BadgeDollarSign size={24} className="text-[var(--color-success)] opacity-20" />
                  </div>
                  
                  {canViewCost && product.precio_costo && (
                    <div className="bg-[var(--color-warning-bg)] p-5 rounded-2xl border border-[var(--color-warning-border)] flex justify-between items-center">
                      <div>
                        <span className="text-[10px] font-bold text-[var(--color-warning)] uppercase block mb-1">Precio de Costo</span>
                        <span className="text-2xl font-black text-[var(--color-warning)] leading-none">
                          S/ {parseFloat(product.precio_costo).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <Info size={24} className="text-[var(--color-warning)] opacity-20" />
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Details & Tech Info */}
        <div className="lg:col-span-8 space-y-8">
          <Card>
            <CardHeader className="py-4 bg-[var(--gray-50)] border-b border-[var(--gray-100)]">
              <CardTitle className="text-[14px] font-bold text-[var(--gray-800)] uppercase tracking-tight flex items-center gap-2">
                <Hash size={16} /> Especificaciones y Detalles
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                <div className="space-y-8">
                  <div>
                    <label className="text-[11px] font-bold text-[var(--gray-400)] uppercase tracking-widest block mb-2">Marca del Producto</label>
                    <div className="flex items-center gap-2">
                      <Tag size={16} className="text-[var(--color-brand-orange)]" />
                      <span className="text-lg font-bold text-[var(--gray-800)]">{product.brand_name}</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-[var(--gray-400)] uppercase tracking-widest block mb-2">Descripción General</label>
                    <p className="text-[var(--gray-600)] leading-relaxed text-sm bg-[var(--gray-50)] p-4 rounded-xl border border-[var(--gray-100)] italic">
                      {product.descripcion || 'Sin descripción adicional registrada para este producto.'}
                    </p>
                  </div>
                </div>

                <div className="space-y-8">
                  <div className="bg-[var(--gray-50)] p-6 rounded-2xl border border-[var(--gray-100)]">
                    <label className="text-[11px] font-bold text-[var(--gray-400)] uppercase tracking-widest block mb-4">Distribución en Almacén</label>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-[var(--gray-200)] shadow-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-[var(--color-brand-blue)]"></div>
                          <span className="text-sm font-bold text-[var(--gray-700)]">Almacén Principal</span>
                        </div>
                        <span className="text-sm font-black text-[var(--color-brand-blue)]">
                          {product.total_stock} unidades
                        </span>
                      </div>
                      
                      {/* Placeholder for future warehouse distribution */}
                      <div className="flex items-center justify-between p-3 opacity-40 grayscale">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-[var(--gray-300)]"></div>
                          <span className="text-sm font-medium text-[var(--gray-500)]">Showroom / Vitrina</span>
                        </div>
                        <span className="text-sm font-bold text-[var(--gray-500)]">0 unidades</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-[var(--gray-400)] uppercase tracking-widest block mb-2">Última Actualización</label>
                    <p className="text-xs text-[var(--gray-500)] font-medium">
                      Control de inventario sincronizado: {new Date().toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
