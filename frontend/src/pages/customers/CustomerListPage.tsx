import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useCustomers, Customer, PaginatedResponse } from '../../hooks/useCustomers';
import { DataTable } from '../../components/ui/DataTable';
import { Plus, Eye, ChevronLeft, ChevronRight } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { cn } from '../../lib/utils';

export default function CustomerListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const initialSearch = searchParams.get('search') || '';
  const initialEtiqueta = searchParams.get('etiqueta') || '';
  const initialPage = parseInt(searchParams.get('page') || '1');

  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch);
  const [etiquetaFilter, setEtiquetaFilter] = useState(initialEtiqueta);
  const [page, setPage] = useState(initialPage);
  
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

  const { data, isLoading } = useCustomers({ 
    search: debouncedSearch, 
    etiqueta: etiquetaFilter,
    page: page 
  });

  // Determinar si la data es paginada o un array simple
  const isPaginated = data && typeof data === 'object' && !Array.isArray(data);
  const customers = isPaginated 
    ? (data as PaginatedResponse<Customer>).results || [] 
    : (Array.isArray(data) ? data : []);
  
  const totalCount = isPaginated 
    ? (data as PaginatedResponse<Customer>).count || 0 
    : customers.length;
    
  const hasNext = isPaginated ? !!(data as PaginatedResponse<Customer>).next : false;
  const hasPrev = isPaginated ? !!(data as PaginatedResponse<Customer>).previous : false;

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    setSearchParams(prev => {
      prev.set('page', newPage.toString());
      return prev;
    });
  };

  const getLabelClass = (etiqueta: string) => {
    const classes: Record<string, string> = {
      NUEVO: 'bg-[#EFF3FF] text-[#2347A5] border-[#BFCFFF]',
      REGULAR: 'bg-[#F0FDF4] text-[#16A34A] border-[#BBF7D0]',
      FRECUENTE: 'bg-[#F5F3FF] text-[#7C3AED] border-[#DDD6FE]',
      VIP: 'bg-[#FFFBEB] text-[#D97706] border-[#FDE68A]',
      MOROSO: 'bg-[#FEF2F2] text-[#DC2626] border-[#FECACA]',
      ESPECIAL: 'bg-[#FFF7ED] text-[#C2410C] border-[#FDBA74]',
    };
    return classes[etiqueta] || 'bg-[var(--gray-50)] text-[var(--gray-500)] border-[var(--gray-200)]';
  };

  const columns = [
    {
      header: 'Cliente',
      cell: (item: Customer) => (
        <div className="flex flex-col cursor-pointer" onClick={() => navigate(`/customers/${item.id}`)}>
          <span className="font-semibold text-[var(--gray-800)] hover:text-[var(--color-brand-blue)] transition-colors">
            {item.nombre}
          </span>
          <span className="text-[12px] text-[var(--gray-400)] font-medium">
            {item.tipo_cliente === 'PERSONA' ? 'DNI: ' : 'RUC: '}{item.identificador}
          </span>
        </div>
      ),
    },
    {
      header: 'Contacto',
      cell: (item: Customer) => (
        <div className="flex flex-col text-[13px]">
          <span className="text-[var(--gray-700)] font-medium">{item.telefono || 'Sin teléfono'}</span>
          <span className="text-[var(--gray-400)]">{item.correo_electronico || ''}</span>
        </div>
      ),
    },
    {
      header: 'Etiqueta',
      cell: (item: Customer) => (
        <span className={cn(
          "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold border",
          getLabelClass(item.etiqueta)
        )}>
          {item.etiqueta}
        </span>
      ),
    },
    {
      header: '',
      cell: (item: Customer) => (
        <div className="flex justify-end">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 text-[var(--gray-400)] hover:text-[var(--color-brand-blue)]"
            onClick={() => navigate(`/customers/${item.id}`)}
          >
            <Eye size={16} />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-8 max-w-[1600px] mx-auto">
      <PageHeader 
        title="Directorio de Clientes"
        subtitle={`Gestiona los clientes y sus dispositivos (${totalCount} en total).`}
        actions={
          <Button variant="primary" onClick={() => navigate('/customers/new')}>
            <Plus size={18} />
            <span>Nuevo Cliente</span>
          </Button>
        }
      />

      <div className="space-y-4">
        <DataTable
          data={customers}
          columns={columns}
          keyExtractor={(item) => item.id}
          isLoading={isLoading}
          onSearch={setSearchTerm}
          initialSearchValue={initialSearch}
          searchPlaceholder="Buscar por DNI, RUC, nombre o teléfono..."
          filters={
            <div className="w-[180px]">
              <Select
                value={etiquetaFilter}
                onChange={(e) => {
                  const val = e.target.value;
                  setEtiquetaFilter(val);
                  setPage(1);
                  setSearchParams(prev => {
                    if (val) prev.set('etiqueta', val);
                    else prev.delete('etiqueta');
                    prev.set('page', '1');
                    return prev;
                  });
                }}
                className="h-9 text-[13px]"
              >
                <option value="">Todas las Etiquetas</option>
                <option value="NUEVO">Nuevo</option>
                <option value="REGULAR">Regular</option>
                <option value="FRECUENTE">Frecuente</option>
                <option value="VIP">VIP</option>
                <option value="MOROSO">Moroso</option>
                <option value="ESPECIAL">Especial</option>
              </Select>
            </div>
          }
        />

        {/* Pagination Footer */}
        {isPaginated && (
          <div className="flex items-center justify-between px-4 py-3 bg-white border border-[var(--gray-200)] rounded-xl shadow-sm">
            <div className="flex flex-1 justify-between sm:hidden">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handlePageChange(page - 1)}
                disabled={!hasPrev || isLoading}
              >
                Anterior
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handlePageChange(page + 1)}
                disabled={!hasNext || isLoading}
              >
                Siguiente
              </Button>
            </div>
            <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-[var(--gray-500)]">
                  Mostrando <span className="font-bold text-[var(--gray-800)]">{customers.length}</span> de <span className="font-bold text-[var(--gray-800)]">{totalCount}</span> clientes
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handlePageChange(page - 1)}
                  disabled={!hasPrev || isLoading}
                  className="h-8 w-8 p-0"
                >
                  <ChevronLeft size={18} />
                </Button>
                
                <div className="flex items-center justify-center h-8 min-w-[32px] px-2 rounded-lg bg-[var(--color-info-bg)] text-[var(--color-brand-blue)] text-xs font-bold border border-[var(--color-info-border)]">
                  Página {page}
                </div>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handlePageChange(page + 1)}
                  disabled={!hasNext || isLoading}
                  className="h-8 w-8 p-0"
                >
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

