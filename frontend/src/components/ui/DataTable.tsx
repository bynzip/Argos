import React from 'react';
import { Search } from 'lucide-react';

export interface Column<T> {
  header: string;
  accessorKey?: keyof T;
  cell?: (item: T) => React.ReactNode;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (item: T) => string | number;
  isLoading?: boolean;
  onSearch?: (term: string) => void;
  searchPlaceholder?: string;
  actions?: React.ReactNode;
}

export function DataTable<T>({
  data,
  columns,
  keyExtractor,
  isLoading = false,
  onSearch,
  searchPlaceholder = 'Buscar...',
  actions,
}: DataTableProps<T>) {
  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="surface-panel p-4 flex flex-col sm:flex-row gap-4 justify-between items-center">
        <div className="relative w-full sm:max-w-md">
          {onSearch && (
            <>
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                <Search className="h-5 w-5 text-slate-400" />
              </div>
              <input
                type="text"
                onChange={(e) => onSearch(e.target.value)}
                className="field-input w-full pl-12"
                placeholder={searchPlaceholder}
              />
            </>
          )}
        </div>
        <div className="flex items-center gap-3">
          {actions}
        </div>
      </div>

      {/* Table */}
      <div className="surface-panel overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center p-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-blue border-t-transparent"></div>
          </div>
        ) : data.length === 0 ? (
          <div className="p-12 text-center text-slate-500 font-medium">
            No se encontraron resultados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  {columns.map((col, i) => (
                    <th key={i}>{col.header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((item) => (
                  <tr key={keyExtractor(item)}>
                    {columns.map((col, i) => (
                      <td key={i}>
                        {col.cell
                          ? col.cell(item)
                          : col.accessorKey
                          ? String(item[col.accessorKey])
                          : null}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
