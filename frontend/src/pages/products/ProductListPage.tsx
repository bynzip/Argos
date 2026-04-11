import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProducts, Product } from '../../hooks/useProducts';
import { DataTable, Column } from '../../components/ui/DataTable';
import { Plus, Package, AlertTriangle, Eye } from 'lucide-react';

export default function ProductListPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const navigate = useNavigate();
  
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const { data: products = [], isLoading } = useProducts({ search: debouncedSearch });

  const columns: Column<Product>[] = [
    {
      header: 'Código/Producto',
      cell: (item) => (
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-400">
            <Package size={20} />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-slate-900">{item.nombre}</span>
            <span className="text-xs font-bold text-brand-blue uppercase tracking-wider">{item.codigo}</span>
          </div>
        </div>
      ),
    },
    {
      header: 'Categoría/Marca',
      cell: (item) => (
        <div className="flex flex-col text-sm font-medium">
          <span className="text-slate-700">{item.category_name}</span>
          <span className="text-xs text-slate-400">{item.brand_name}</span>
        </div>
      ),
    },
    {
      header: 'Stock Total',
      cell: (item) => (
        <div className="flex items-center gap-2">
          <span className={`font-bold ${item.total_stock <= item.stock_minimo ? 'text-red-600' : 'text-slate-700'}`}>
            {item.total_stock}
          </span>
          {item.total_stock <= item.stock_minimo && (
            <AlertTriangle size={14} className="text-red-500" />
          )}
        </div>
      ),
    },
    {
      header: 'Precio Venta',
      cell: (item) => (
        <span className="font-bold text-slate-900 bg-slate-100 px-2 py-1 rounded-lg border border-slate-200 whitespace-nowrap">
          S/ {parseFloat(item.precio_venta).toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      header: 'Estado',
      cell: (item) => (
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold border ${
          item.activo 
            ? 'bg-green-50 text-green-700 border-green-200' 
            : 'bg-slate-50 text-slate-500 border-slate-200'
        }`}>
          {item.activo ? 'Activo' : 'Inactivo'}
        </span>
      ),
    },
    {
      header: 'Acciones',
      cell: (item) => (
        <button 
          onClick={() => navigate(`/inventory/${item.id}`)}
          className="text-slate-400 hover:text-brand-blue transition-colors p-2 rounded-xl hover:bg-blue-50"
          title="Ver detalle"
        >
          <Eye size={20} />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Catálogo de Productos</h1>
          <p className="muted-copy mt-2 font-medium">
            Gestiona los repuestos, accesorios y suministros del taller.
          </p>
        </div>
      </div>

      <DataTable
        data={products}
        columns={columns}
        keyExtractor={(item) => item.id}
        isLoading={isLoading}
        onSearch={setSearchTerm}
        searchPlaceholder="Buscar por código, nombre o marca..."
        actions={
          <button 
            onClick={() => navigate('/inventory/new')}
            className="primary-button text-sm"
          >
            <Plus size={18} />
            <span className="hidden sm:inline">Nuevo Producto</span>
          </button>
        }
      />
    </div>
  );
}
