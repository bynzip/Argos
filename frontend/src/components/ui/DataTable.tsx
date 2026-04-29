import React from 'react';
import { Search, Inbox } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface Column<T> {
  header: string;
  accessorKey?: keyof T;
  cell?: (item: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (item: T) => string | number;
  isLoading?: boolean;
  onSearch?: (term: string) => void;
  searchPlaceholder?: string;
  initialSearchValue?: string;
  actions?: React.ReactNode;
  filters?: React.ReactNode;
}

export function DataTable<T>({
  data,
  columns,
  keyExtractor,
  isLoading = false,
  onSearch,
  searchPlaceholder = 'Buscar...',
  initialSearchValue = '',
  actions,
  filters,
}: DataTableProps<T>) {
  // Manejo robusto para paginación global (si llega { count, results } en vez del array directo)
  const actualData = Array.isArray(data) ? data : (data as any)?.results || [];

  return (
    <div className="bg-white border border-[var(--gray-200)] rounded-[12px] overflow-hidden shadow-[var(--shadow-sm)]">
      {/* Table Toolbar */}
      {(onSearch || actions || filters) && (
        <div className="px-5 py-4 border-b border-[var(--gray-200)] flex flex-col sm:flex-row gap-4 justify-between items-center bg-white">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            {onSearch && (
              <div className="relative w-full sm:w-[280px]">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Search className="h-4 w-4 text-[var(--gray-400)]" />
                </div>
                <input
                  type="text"
                  onChange={(e) => onSearch(e.target.value)}
                  defaultValue={initialSearchValue}
                  className="w-full h-9 pl-9 pr-4 bg-[var(--gray-50)] border-1.5 border-[var(--gray-200)] rounded-lg text-[13px] text-[var(--gray-800)] outline-none transition-all placeholder:text-[var(--gray-400)] focus:bg-white focus:border-[var(--color-brand-blue)] focus:shadow-[0_0_0_3px_rgba(35,71,165,0.10)]"
                  placeholder={searchPlaceholder}
                />
              </div>
            )}
            {filters}
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {actions}
          </div>
        </div>
      )}

      {/* Table Content */}
      <div className="overflow-x-auto">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-20 gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-brand-blue)] border-t-transparent"></div>
            <p className="text-sm font-medium text-[var(--gray-500)]">Cargando datos...</p>
          </div>
        ) : actualData.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-center px-6">
            <div className="w-16 h-16 bg-[var(--gray-50)] rounded-full flex items-center justify-center mb-4">
              <Inbox className="h-8 w-8 text-[var(--gray-300)]" />
            </div>
            <h3 className="text-[16px] font-bold text-[var(--gray-800)]">No se encontraron resultados</h3>
            <p className="text-sm text-[var(--gray-500)] mt-1 max-w-[300px]">
              Intenta ajustar los filtros o los términos de búsqueda para encontrar lo que buscas.
            </p>
          </div>
        ) : (
          <table className="w-full border-collapse">
            <thead className="bg-[var(--gray-50)]">
              <tr>
                {columns.map((col, i) => (
                  <th 
                    key={i}
                    className={cn(
                      "px-4 py-3 text-left text-[11px] font-semibold text-[var(--gray-500)] uppercase tracking-[0.06em] border-b border-[var(--gray-200)]",
                      col.className
                    )}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--gray-100)]">
              {actualData.map((item: any) => (
                <tr 
                  key={keyExtractor(item)} 
                  className="hover:bg-[var(--gray-50)] transition-colors duration-100"
                >
                  {columns.map((col, i) => (
                    <td 
                      key={i}
                      className={cn(
                        "px-4 py-3.5 text-[14px] text-[var(--gray-700)] vertical-middle",
                        col.className
                      )}
                    >
                      {col.cell
                        ? col.cell(item)
                        : col.accessorKey
                        ? String(item[col.accessorKey] || '-')
                        : null}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
