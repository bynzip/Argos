import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCustomers, Customer } from '../../hooks/useCustomers';
import { DataTable, Column } from '../../components/ui/DataTable';
import { Plus, Eye } from 'lucide-react';

export default function CustomerListPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const navigate = useNavigate();
  
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const { data: customers = [], isLoading } = useCustomers({ search: debouncedSearch });

  const getLabelColor = (etiqueta: string) => {
    const colors: Record<string, string> = {
      NUEVO: 'bg-blue-100 text-blue-800 border-blue-200',
      REGULAR: 'bg-green-100 text-green-800 border-green-200',
      FRECUENTE: 'bg-purple-100 text-purple-800 border-purple-200',
      VIP: 'bg-amber-100 text-amber-800 border-amber-200',
      MOROSO: 'bg-red-100 text-red-800 border-red-200',
      ESPECIAL: 'bg-orange-100 text-orange-800 border-orange-200',
    };
    return colors[etiqueta] || 'bg-slate-100 text-slate-800 border-slate-200';
  };

  const columns: Column<Customer>[] = [
    {
      header: 'Cliente',
      cell: (item) => (
        <div className="flex flex-col cursor-pointer" onClick={() => navigate(`/customers/${item.id}`)}>
          <span className="font-bold text-slate-900 hover:text-brand-blue transition-colors">{item.nombre}</span>
          <span className="text-xs text-slate-500 font-medium mt-0.5">
            {item.tipo_cliente === 'PERSONA' ? 'DNI: ' : 'RUC: '}{item.identificador}
          </span>
        </div>
      ),
    },
    {
      header: 'Contacto',
      cell: (item) => (
        <div className="flex flex-col text-sm text-slate-600 font-medium">
          <span>{item.telefono || 'Sin teléfono'}</span>
          <span className="text-xs text-slate-400 mt-0.5">{item.correo_electronico || ''}</span>
        </div>
      ),
    },
    {
      header: 'Etiqueta',
      cell: (item) => (
        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold border shadow-sm ${getLabelColor(item.etiqueta)}`}>
          {item.etiqueta}
        </span>
      ),
    },
    {
      header: 'Acciones',
      cell: (item) => (
        <button 
          onClick={() => navigate(`/customers/${item.id}`)}
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
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Directorio de Clientes</h1>
          <p className="muted-copy mt-2 font-medium">
            Gestiona los clientes, sus datos de contacto y sus dispositivos.
          </p>
        </div>
      </div>

      <DataTable
        data={customers}
        columns={columns}
        keyExtractor={(item) => item.id}
        isLoading={isLoading}
        onSearch={setSearchTerm}
        searchPlaceholder="Buscar por DNI, RUC, nombre o teléfono..."
        actions={
          <button 
            onClick={() => navigate('/customers/new')}
            className="primary-button text-sm"
          >
            <Plus size={18} />
            <span className="hidden sm:inline">Nuevo Cliente</span>
          </button>
        }
      />
    </div>
  );
}
