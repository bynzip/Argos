import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useProducts, Product, useCategories, useBrands, PaginatedResponse } from '../../hooks/useProducts';
import { useAuthStore } from '../../store/authStore';
import { DataTable } from '../../components/ui/DataTable';
import { Plus, Package, AlertTriangle, Eye, Edit, ChevronLeft, ChevronRight, Boxes, History, Warehouse } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';

export default function ProductListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const initialSearch = searchParams.get('search') || '';
  const initialCategory = searchParams.get('category') || '';
  const initialBrand = searchParams.get('brand') || '';
  const initialPage = parseInt(searchParams.get('page') || '1');

  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch);
  const [categoryFilter, setCategoryFilter] = useState(initialCategory);
  const [brandFilter, setBrandFilter] = useState(initialBrand);
  const [page, setPage] = useState(initialPage);

  const isAdmin = user?.role === 'Administrador' || user?.is_superuser;
  const isAlmacenero = user?.role === 'Almacenero';
  const canViewCost = isAdmin || isAlmacenero;

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      if (searchTerm !== initialSearch) {
        setPage(1);
        setSearchParams(prev => {
          if (searchTerm) prev.set('search', searchTerm);
          else prev.delete('search');
          prev.set('page', '1');
          return prev;
        });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const { data, isLoading } = useProducts({
    search: debouncedSearch,
    category: categoryFilter || undefined,
    brand: brandFilter || undefined,
    page,
  });

  const { data: categories } = useCategories();
  const { data: brands } = useBrands();

  const isPaginated = data && typeof data === 'object' && !Array.isArray(data);
  const products = isPaginated
    ? (data as PaginatedResponse<Product>).results || []
    : (Array.isArray(data) ? data : []);

  const totalCount = isPaginated
    ? (data as PaginatedResponse<Product>).count || 0
    : products.length;

  const hasNext = isPaginated ? !!(data as PaginatedResponse<Product>).next : false;
  const hasPrev = isPaginated ? !!(data as PaginatedResponse<Product>).previous : false;

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    setSearchParams(prev => {
      prev.set('page', newPage.toString());
      return prev;
    });
  };

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
      header: 'Stock Disponible',
      cell: (item: Product) => {
        const available = parseFloat(item.total_stock_disponible || item.total_stock || '0');
        return (
          <div className="flex items-center gap-2">
            <span className={`font-bold ${available <= item.stock_minimo ? 'text-[var(--color-danger)]' : 'text-[var(--gray-700)]'}`}>
              {item.total_stock_disponible || item.total_stock}
            </span>
            {available <= item.stock_minimo && (
              <AlertTriangle size={14} className="text-[var(--color-danger)]" />
            )}
          </div>
        );
      },
    },
    {
      header: 'Físico/Reservado',
      cell: (item: Product) => (
        <div className="flex flex-col text-[12px]">
          <span>Físico: <strong>{item.total_stock_fisico}</strong></span>
          <span className="text-[var(--gray-500)]">Reservado: {item.total_stock_reservado}</span>
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
        subtitle={`Gestiona los repuestos, accesorios y suministros (${totalCount} en total).`}
        actions={(
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => navigate('/inventory/warehouses')}>
              <Warehouse size={16} className="mr-2" />
              Almacenes
            </Button>
            <Button variant="secondary" onClick={() => navigate('/inventory/reservations')}>
              <Boxes size={16} className="mr-2" />
              Reservas
            </Button>
            <Button variant="secondary" onClick={() => navigate('/inventory/movements')}>
              <History size={16} className="mr-2" />
              Movimientos
            </Button>
            <Button variant="primary" onClick={() => navigate('/inventory/new')}>
              <Plus size={18} />
              <span>Nuevo Producto</span>
            </Button>
          </div>
        )}
      />

      <div className="space-y-4">
        <DataTable
          data={products}
          columns={columns}
          keyExtractor={(item) => item.id}
          isLoading={isLoading}
          onSearch={setSearchTerm}
          initialSearchValue={initialSearch}
          searchPlaceholder="Buscar por código, nombre o marca..."
          filters={(
            <div className="flex gap-3">
              <div className="w-[160px]">
                <Select
                  value={categoryFilter}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCategoryFilter(val);
                    setPage(1);
                    setSearchParams(prev => {
                      if (val) prev.set('category', val);
                      else prev.delete('category');
                      prev.set('page', '1');
                      return prev;
                    });
                  }}
                  className="h-9 text-[13px]"
                >
                  <option value="">Todas las Categorías</option>
                  {categories?.map(c => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </Select>
              </div>
              <div className="w-[160px]">
                <Select
                  value={brandFilter}
                  onChange={(e) => {
                    const val = e.target.value;
                    setBrandFilter(val);
                    setPage(1);
                    setSearchParams(prev => {
                      if (val) prev.set('brand', val);
                      else prev.delete('brand');
                      prev.set('page', '1');
                      return prev;
                    });
                  }}
                  className="h-9 text-[13px]"
                >
                  <option value="">Todas las Marcas</option>
                  {brands?.map(b => (
                    <option key={b.id} value={b.id}>{b.nombre}</option>
                  ))}
                </Select>
              </div>
            </div>
          )}
        />

        {isPaginated && (
          <div className="flex items-center justify-between px-4 py-3 bg-white border border-[var(--gray-200)] rounded-xl shadow-sm">
            <div className="flex flex-1 justify-between sm:hidden">
              <Button variant="secondary" size="sm" onClick={() => handlePageChange(page - 1)} disabled={!hasPrev || isLoading}>
                Anterior
              </Button>
              <Button variant="secondary" size="sm" onClick={() => handlePageChange(page + 1)} disabled={!hasNext || isLoading}>
                Siguiente
              </Button>
            </div>
            <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-[var(--gray-500)]">
                  Mostrando <span className="font-bold text-[var(--gray-800)]">{products.length}</span> de <span className="font-bold text-[var(--gray-800)]">{totalCount}</span> productos
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={() => handlePageChange(page - 1)} disabled={!hasPrev || isLoading} className="h-8 w-8 p-0">
                  <ChevronLeft size={18} />
                </Button>
                <div className="flex items-center justify-center h-8 min-w-[32px] px-2 rounded-lg bg-[var(--color-info-bg)] text-[var(--color-brand-blue)] text-xs font-bold border border-[var(--color-info-border)]">
                  Página {page}
                </div>
                <Button variant="secondary" size="sm" onClick={() => handlePageChange(page + 1)} disabled={!hasNext || isLoading} className="h-8 w-8 p-0">
                  <ChevronRight size={18} />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
