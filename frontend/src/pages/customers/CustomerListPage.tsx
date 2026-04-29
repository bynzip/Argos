import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCustomers, Customer } from '../../hooks/useCustomers';
import { DataTable } from '../../components/ui/DataTable';
import { Plus, Eye } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { cn } from '../../lib/utils';

export default function CustomerListPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [etiquetaFilter, setEtiquetaFilter] = useState('');
  const navigate = useNavigate();
  
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const { data: customers = [], isLoading } = useCustomers({ search: debouncedSearch, etiqueta: etiquetaFilter });

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
        subtitle="Gestiona los clientes, sus datos de contacto y sus dispositivos."
        actions={
          <Button variant="primary" onClick={() => navigate('/customers/new')}>
            <Plus size={18} />
            <span>Nuevo Cliente</span>
          </Button>
        }
      />

      <DataTable
        data={customers}
        columns={columns}
        keyExtractor={(item) => item.id}
        isLoading={isLoading}
        onSearch={setSearchTerm}
        searchPlaceholder="Buscar por DNI, RUC, nombre o teléfono..."
        filters={
          <div className="w-[180px]">
            <Select
              value={etiquetaFilter}
              onChange={(e) => setEtiquetaFilter(e.target.value)}
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
    </div>
  );
}
