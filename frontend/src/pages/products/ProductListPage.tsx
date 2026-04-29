import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useProducts, Product } from '../../hooks/useProducts';
import { useAuthStore } from '../../store/authStore';
import { DataTable } from '../../components/ui/DataTable';
import { Plus, Package, AlertTriangle, Eye, Edit } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';

export default function ProductListPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const navigate = useNavigate();
  const { user } = useAuthStore();
  
  const isAdmin = user?.role === 'Administrador' || user?.is_superuser;
  const isAlmacenero = user?.role === 'Almacenero';
  // Almacenero o Admin tienen permiso para ver costo
  const canViewCost = isAdmin || isAlmacenero;
  
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const { data: products = [], isLoading } = useProducts({ search: debouncedSearch });

  const columns = [
    {
      header: 'Código/Producto',
      cell: (item: Product) => (
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-[var(--gray-50)] text-[var(--gray-400)] border border-[var(--gray-100)]">
            <Package size={20} />
          </div>
          <div className="flex flex-col">
            <Link to={`/inventory/${item.id}`} className="font-bold text-[var(--gray-800)] hover:text-[var(--color-brand-blue)] hover:underline transition-colors">
              {item.nombre}
            </Link>
            <span className="text-[11px] font-bold text-[var(--color-brand-blue)] uppercase tracking-wider">{item.codigo}</span>
          </div>
        </div>
      ),
    },
    {
      header: 'Categoría/Marca',
      cell: (item: Product) => (
        <div className="flex flex-col text-[13px]">
          <span className="text-[var(--gray-700)] font-medium">{item.category_name}</span>
          <span className="text-[var(--gray-400)]">{item.brand_name}</span>
        </div>
      ),
    },
    {
      header: 'Stock Total',
      cell: (item: Product) => (
        <div className="flex items-center gap-2">
          <span className={`font-bold ${item.total_stock <= item.stock_minimo ? 'text-[var(--color-danger)]' : 'text-[var(--gray-700)]'}`}>
            {item.total_stock}
          </span>
          {item.total_stock <= item.stock_minimo && (
            <AlertTriangle size={14} className="text-[var(--color-danger)]" />
          )}
        </div>
      ),
    },
    {
      header: 'Precio Venta',
      cell: (item: Product) => (
        <span className="font-bold text-[var(--gray-800)] bg-[var(--gray-50)] px-2 py-1 rounded-md border border-[var(--gray-200)] whitespace-nowrap text-[13px]">
          S/ {parseFloat(item.precio_venta).toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </span>
      ),
    },
  ];

  // Add Cost Price if user has permission
  if (canViewCost) {
    columns.push({
      header: 'Precio Costo',
      cell: (item: Product) => (
        <span className="font-bold text-[var(--gray-500)] bg-[var(--gray-50)] px-2 py-1 rounded-md border border-[var(--gray-100)] whitespace-nowrap text-[13px]">
          S/ {item.precio_costo ? parseFloat(item.precio_costo).toLocaleString(undefined, { minimumFractionDigits: 2 }) : 'N/D'}
        </span>
      ),
    });
  }

  columns.push({
    header: 'Estado',
    cell: (item: Product) => (
      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold border ${
        item.activo 
          ? 'bg-[var(--color-success-bg)] text-[var(--color-success)] border-[var(--color-success-border)]' 
          : 'bg-[var(--gray-50)] text-[var(--gray-500)] border-[var(--gray-200)]'
      }`}>
        {item.activo ? 'Activo' : 'Inactivo'}
      </span>
    ),
  });

  columns.push({
    header: '',
    cell: (item: Product) => (
      <div className="flex justify-end gap-1">
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8 text-[var(--gray-400)] hover:text-[var(--color-brand-blue)]"
          onClick={() => navigate(`/inventory/${item.id}`)}
        >
          <Eye size={16} />
        </Button>
        {(isAdmin || isAlmacenero) && (
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 text-[var(--gray-400)] hover:text-[var(--color-brand-orange)]"
            onClick={() => navigate(`/inventory/edit/${item.id}`)}
          >
            <Edit size={16} />
          </Button>
        )}
      </div>
    ),
  });

  return (
    <div className="p-8 max-w-[1600px] mx-auto">
      <PageHeader 
        title="Catálogo de Productos"
        subtitle="Gestiona los repuestos, accesorios y suministros del taller."
        actions={
          <Button variant="primary" onClick={() => navigate('/inventory/new')}>
            <Plus size={18} />
            <span>Nuevo Producto</span>
          </Button>
        }
      />

      <DataTable
        data={products}
        columns={columns}
        keyExtractor={(item) => item.id}
        isLoading={isLoading}
        onSearch={setSearchTerm}
        searchPlaceholder="Buscar por código, nombre o marca..."
      />
    </div>
  );
}
