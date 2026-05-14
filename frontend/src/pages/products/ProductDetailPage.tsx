import { useParams, useNavigate, Link } from 'react-router-dom';
import { useProduct } from '../../hooks/useProducts';
import { useProductKardex, PaginatedResponse, InventoryMovement } from '../../hooks/useInventory';
import { useAuthStore } from '../../store/authStore';
import { ArrowLeft, Edit, AlertTriangle, Boxes, BadgeDollarSign, History, Warehouse } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { cn } from '../../lib/utils';

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: product, isLoading } = useProduct(id || null);
  const { data: kardexResponse } = useProductKardex(id || null);
  const { user } = useAuthStore();

  const canViewCost = user?.role === 'Administrador' || user?.role === 'Almacenero' || user?.is_superuser;
  const kardex = kardexResponse && !Array.isArray(kardexResponse) && 'results' in kardexResponse
    ? (kardexResponse as PaginatedResponse<InventoryMovement>).results
    : Array.isArray(kardexResponse) ? kardexResponse : [];

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

  const available = parseFloat(product.total_stock_disponible || product.total_stock || '0');
  const isLowStock = available <= product.stock_minimo;

  return (
    <div className="p-8 max-w-[1400px] mx-auto">
      <div className="mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('/inventory')} className="mb-4 text-[var(--gray-500)]">
          <ArrowLeft size={16} className="mr-2" />
          Volver al inventario
        </Button>
        <PageHeader
          title={product.nombre}
          subtitle={`Categoría: ${product.category_name} — Marca: ${product.brand_name}`}
          actions={(
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
          )}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-4 space-y-8">
          <Card className={cn('border-l-4', isLowStock ? 'border-l-[var(--color-danger)]' : 'border-l-[var(--color-brand-blue)]')}>
            <CardHeader className="py-4 border-b border-[var(--gray-100)]">
              <CardTitle className="text-[13px] text-[var(--gray-400)] uppercase tracking-wider flex items-center gap-2">
                <Boxes size={14} /> Control de Inventario
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-8 space-y-8">
              <div className="text-center">
                <span className="text-[11px] font-bold text-[var(--gray-400)] uppercase tracking-widest block mb-2">Disponible</span>
                <div className="flex items-baseline justify-center gap-2">
                  <span className={cn('text-6xl font-black leading-none', isLowStock ? 'text-[var(--color-danger)]' : 'text-[var(--gray-800)]')}>
                    {(product.total_stock_disponible || product.total_stock)}
                  </span>
                  <span className="text-[var(--gray-400)] font-bold text-xl uppercase">und</span>
                </div>
                {isLowStock && (
                  <div className="mt-6 flex items-center justify-center gap-2 text-[var(--color-danger)] bg-[var(--color-danger-bg)] p-3 rounded-xl border border-[var(--color-danger-border)]">
                    <AlertTriangle size={18} />
                    <span className="text-xs font-bold uppercase tracking-tight">Stock crítico (Mín: {product.stock_minimo})</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-[var(--gray-200)] bg-[var(--gray-50)] p-3 text-center">
                  <div className="text-[11px] text-[var(--gray-400)] uppercase font-bold">Físico</div>
                  <div className="text-2xl font-black">{product.total_stock_fisico}</div>
                </div>
                <div className="rounded-xl border border-[var(--gray-200)] bg-[var(--gray-50)] p-3 text-center">
                  <div className="text-[11px] text-[var(--gray-400)] uppercase font-bold">Reservado</div>
                  <div className="text-2xl font-black">{product.total_stock_reservado}</div>
                </div>
                <div className="rounded-xl border border-[var(--gray-200)] bg-[var(--gray-50)] p-3 text-center">
                  <div className="text-[11px] text-[var(--gray-400)] uppercase font-bold">Disponible</div>
                  <div className="text-2xl font-black">{product.total_stock_disponible || product.total_stock}</div>
                </div>
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
                      <BadgeDollarSign size={24} className="text-[var(--color-warning)] opacity-20" />
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-8 space-y-8">
          <Card>
            <CardHeader className="py-4 bg-[var(--gray-50)] border-b border-[var(--gray-100)]">
              <CardTitle className="text-[14px] font-bold text-[var(--gray-800)] uppercase tracking-tight flex items-center gap-2">
                <Warehouse size={16} /> Distribución por almacén
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8 space-y-4">
              {product.stocks?.length ? product.stocks.map((stock) => (
                <div key={stock.id} className="rounded-xl border border-[var(--gray-200)] p-4 bg-[var(--gray-50)]">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-bold text-[var(--gray-800)]">{stock.warehouse_name}</div>
                      <div className="text-xs text-[var(--gray-400)]">{stock.ubicacion_especifica || 'Sin ubicación específica'}</div>
                    </div>
                    <div className="text-right text-sm">
                      <div>Físico: <strong>{stock.cantidad}</strong></div>
                      <div>Reservado: <strong>{stock.reservado}</strong></div>
                      <div>Disponible: <strong>{stock.disponible}</strong></div>
                    </div>
                  </div>
                </div>
              )) : (
                <div className="text-sm text-[var(--gray-400)]">Sin stock distribuido por almacén.</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="py-4 bg-[var(--gray-50)] border-b border-[var(--gray-100)]">
              <CardTitle className="text-[14px] font-bold text-[var(--gray-800)] uppercase tracking-tight flex items-center gap-2">
                <History size={16} /> Kardex reciente
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-[var(--gray-50)] text-[11px] font-bold text-[var(--gray-400)] uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-3 text-left">Fecha</th>
                    <th className="px-6 py-3 text-left">Tipo</th>
                    <th className="px-6 py-3 text-left">Almacén</th>
                    <th className="px-6 py-3 text-right">Cantidad</th>
                    <th className="px-6 py-3 text-left">Referencia</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--gray-100)]">
                  {kardex.slice(0, 10).map((movement) => (
                    <tr key={movement.id}>
                      <td className="px-6 py-4">{new Date(movement.created_at).toLocaleString()}</td>
                      <td className="px-6 py-4">{movement.movement_type}</td>
                      <td className="px-6 py-4">
                        {movement.warehouse_name}
                        {movement.destination_warehouse_name ? ` → ${movement.destination_warehouse_name}` : ''}
                      </td>
                      <td className="px-6 py-4 text-right font-bold">{movement.quantity}</td>
                      <td className="px-6 py-4 text-xs text-[var(--gray-500)]">{movement.reference_type || '—'} {movement.reference_id || ''}</td>
                    </tr>
                  ))}
                  {kardex.length === 0 && (
                    <tr>
                      <td className="px-6 py-8 text-center text-[var(--gray-400)]" colSpan={5}>
                        Sin movimientos todavía.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
