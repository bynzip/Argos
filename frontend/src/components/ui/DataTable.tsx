import React from 'react';
import { Inbox, Search } from 'lucide-react';

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
  const actualData = Array.isArray(data) ? data : (data as any)?.results || [];

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--gray-200)] bg-white shadow-[var(--shadow-sm)]">
      {(onSearch || actions || filters) && (
        <div className="flex flex-col gap-3 border-b border-[var(--gray-200)] bg-white px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            {onSearch && (
              <div className="relative w-full sm:w-[320px]">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Search className="h-4 w-4 text-[var(--gray-400)]" />
                </div>
                <input
                  type="text"
                  onChange={(e) => onSearch(e.target.value)}
                  defaultValue={initialSearchValue}
                  className="h-10 w-full rounded-xl border border-[var(--gray-200)] bg-[var(--gray-50)] pl-9 pr-4 text-[13px] font-medium text-[var(--gray-800)] outline-none transition-all placeholder:text-[var(--gray-400)] focus:border-[var(--color-brand-blue)] focus:bg-white focus:shadow-[0_0_0_3px_rgba(35,71,165,0.10)]"
                  placeholder={searchPlaceholder}
                />
              </div>
            )}
            {filters}
          </div>

          <div className="flex shrink-0 items-center gap-3">
            {actions}
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center gap-3 p-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-brand-blue)] border-t-transparent" />
            <p className="text-sm font-medium text-[var(--gray-500)]">Cargando datos...</p>
          </div>
        ) : actualData.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--gray-50)]">
              <Inbox className="h-8 w-8 text-[var(--gray-300)]" />
            </div>
            <h3 className="text-[16px] font-bold text-[var(--gray-800)]">No se encontraron resultados</h3>
            <p className="mt-1 max-w-[300px] text-sm text-[var(--gray-500)]">
              Intenta ajustar los filtros o los terminos de busqueda para encontrar lo que buscas.
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
                      'border-b border-[var(--gray-200)] px-5 py-3 text-left text-[11px] font-black uppercase tracking-[0.06em] text-[var(--gray-500)]',
                      col.className,
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
                  className="transition-colors duration-100 hover:bg-[var(--gray-50)]"
                >
                  {columns.map((col, i) => (
                    <td
                      key={i}
                      className={cn(
                        'align-middle px-5 py-4 text-[13px] text-[var(--gray-700)]',
                        col.className,
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
