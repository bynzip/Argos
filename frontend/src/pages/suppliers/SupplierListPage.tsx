import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Link2, Plus } from 'lucide-react';

import { DataTable } from '../../components/ui/DataTable';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { Supplier, useSuppliers } from '../../hooks/useSuppliers';
import ProductSupplierLinkModal from '../../components/products/ProductSupplierLinkModal';

export default function SupplierListPage() {
  const navigate = useNavigate();
  const { data: suppliers = [], isLoading } = useSuppliers();
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | null>(null);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const openLinkModal = (supplierId: number | null = null) => {
    setSelectedSupplierId(supplierId);
    setIsLinkModalOpen(true);
  };

  const closeLinkModal = () => {
    setSelectedSupplierId(null);
    setIsLinkModalOpen(false);
  };

  const filteredSuppliers = useMemo(() => {
    const normalizedTerm = searchTerm.trim().toLowerCase();

    return suppliers.filter((supplier) => {
      const matchesStatus = statusFilter === ''
        ? true
        : statusFilter === 'ACTIVE'
          ? supplier.activo
          : !supplier.activo;

      const matchesSearch = normalizedTerm
        ? [
          supplier.nombre,
          supplier.ruc,
          supplier.contacto,
          supplier.telefono,
          supplier.correo,
          supplier.direccion,
        ].some((value) => value?.toLowerCase().includes(normalizedTerm))
        : true;

      return matchesStatus && matchesSearch;
    });
  }, [suppliers, searchTerm, statusFilter]);

  const columns = [
    {
      header: 'Proveedor',
      cell: (item: Supplier) => (
        <button
          type="button"
          onClick={() => navigate(`/suppliers/edit/${item.id}`)}
          className="flex flex-col text-left"
        >
          <span className="font-semibold text-[var(--gray-800)] transition-colors hover:text-[var(--color-brand-blue)]">
            {item.nombre}
          </span>
          <span className="text-[12px] font-medium text-[var(--gray-400)]">
            RUC: {item.ruc}
          </span>
        </button>
      ),
    },
    {
      header: 'Contacto',
      cell: (item: Supplier) => (
        <div className="flex flex-col text-[13px]">
          <span className="font-medium text-[var(--gray-700)]">{item.contacto || 'Sin contacto'}</span>
          <span className="text-[var(--gray-400)]">{item.telefono || 'Sin telefono'}</span>
        </div>
      ),
    },
    {
      header: 'Correo',
      accessorKey: 'correo' as keyof Supplier,
    },
    {
      header: 'Direccion',
      cell: (item: Supplier) => (
        <span className="text-[13px] text-[var(--gray-600)]">{item.direccion || '-'}</span>
      ),
    },
    {
      header: 'Estado',
      cell: (item: Supplier) => (
        <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${
          item.activo
            ? 'border-[#BBF7D0] bg-[#F0FDF4] text-[#16A34A]'
            : 'border-[#FECACA] bg-[#FEF2F2] text-[#DC2626]'
        }`}>
          {item.activo ? 'ACTIVO' : 'INACTIVO'}
        </span>
      ),
    },
    {
      header: '',
      className: 'text-right',
      cell: (item: Supplier) => (
        <div className="flex justify-end gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => openLinkModal(item.id)}
          >
            Relacionar
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate(`/suppliers/edit/${item.id}`)}
          >
            Editar
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="mx-auto max-w-[1600px] p-8">
        <PageHeader
          title="Directorio de Proveedores"
          subtitle={`Gestiona la base operativa de compras (${filteredSuppliers.length} visibles de ${suppliers.length}).`}
          actions={(
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => openLinkModal()}>
                <Link2 size={16} className="mr-2" />
                Vincular producto
              </Button>
              <Button variant="primary" onClick={() => navigate('/suppliers/new')}>
                <Plus size={18} />
                <span>Nuevo Proveedor</span>
              </Button>
            </div>
          )}
        />

        <DataTable
          data={filteredSuppliers}
          columns={columns}
          keyExtractor={(item) => item.id}
          isLoading={isLoading}
          onSearch={setSearchTerm}
          searchPlaceholder="Buscar por proveedor, RUC, contacto o correo..."
          filters={(
            <div className="w-[180px]">
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-10 text-[13px]"
              >
                <option value="">Todos los estados</option>
                <option value="ACTIVE">Activos</option>
                <option value="INACTIVE">Inactivos</option>
              </Select>
            </div>
          )}
        />
      </div>

      <ProductSupplierLinkModal
        open={isLinkModalOpen}
        onClose={closeLinkModal}
        initialSupplierId={selectedSupplierId}
      />
    </>
  );
}
