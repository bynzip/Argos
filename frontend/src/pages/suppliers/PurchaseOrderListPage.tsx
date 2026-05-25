import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, ReceiptText } from 'lucide-react';

import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { PageHeader } from '../../components/ui/PageHeader';
import { Select } from '../../components/ui/Select';
import {
  PurchaseOrder,
  usePurchaseOrders,
} from '../../hooks/useSuppliers';
import {
  PURCHASE_ORDER_STATUS_LABELS,
  formatPurchaseDate,
} from './purchaseOrderUi';

const STATUS_STYLES: Record<string, string> = {
  DRAFT: 'border-[var(--gray-200)] bg-[var(--gray-50)] text-[var(--gray-500)]',
  SENT: 'border-[var(--color-info-border)] bg-[var(--color-info-bg)] text-[var(--color-brand-blue)]',
  PARTIALLY_RECEIVED: 'border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] text-[var(--color-warning)]',
  RECEIVED: 'border-[var(--color-success-border)] bg-[var(--color-success-bg)] text-[var(--color-success)]',
  CLOSED_INCOMPLETE: 'border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] text-[var(--color-warning)]',
  CANCELLED: 'border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] text-[var(--color-danger)]',
};

export default function PurchaseOrderListPage() {
  const navigate = useNavigate();
  const { data: orders = [], isLoading } = usePurchaseOrders();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const columns = [
    {
      header: 'Orden',
      className: 'w-[20%]',
      cell: (item: PurchaseOrder) => (
        <div className="flex flex-col gap-1">
          <Link
            to={`/suppliers/orders/${item.id}`}
            className="font-semibold text-[var(--color-brand-blue)] transition-colors hover:text-[var(--color-brand-orange)] hover:underline"
          >
            {item.folio}
          </Link>
        </div>
      ),
    },
    {
      header: 'Proveedor',
      className: 'w-[20%]',
      cell: (item: PurchaseOrder) => (
        <div className="flex flex-col">
          <span className="font-medium text-[var(--gray-700)]">{item.supplier_name}</span>
          <span className="text-xs text-[var(--gray-400)]">
            {item.items.length} linea{item.items.length === 1 ? '' : 's'}
          </span>
        </div>
      ),
    },
    {
      header: 'Creada',
      className: 'w-[14%]',
      cell: (item: PurchaseOrder) => formatPurchaseDate(item.created_at),
    },
    {
      header: 'Etiqueta',
      className: 'w-[14%]',
      cell: (item: PurchaseOrder) => (
        <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.04em] ${STATUS_STYLES[item.estado] || STATUS_STYLES.DRAFT}`}>
          {PURCHASE_ORDER_STATUS_LABELS[item.estado] || item.estado}
        </span>
      ),
    },
    {
      header: 'Subtotal',
      className: 'w-[14%]',
      cell: (item: PurchaseOrder) => (
        <span className="whitespace-nowrap font-semibold text-[var(--gray-800)]">
          S/ {Number(item.subtotal || 0).toFixed(2)}
        </span>
      ),
    },
  ];

  const filteredOrders = useMemo(() => {
    const normalizedTerm = searchTerm.trim().toLowerCase();

    return orders.filter((order) => {
      const matchesStatus = statusFilter ? order.estado === statusFilter : true;
      const matchesSearch = normalizedTerm
        ? [
          order.folio,
          order.supplier_name,
          order.destination_warehouse_name,
          PURCHASE_ORDER_STATUS_LABELS[order.estado] || order.estado,
        ].some((value) => value?.toLowerCase().includes(normalizedTerm))
        : true;

      return matchesStatus && matchesSearch;
    });
  }, [orders, searchTerm, statusFilter]);

  return (
    <div className="mx-auto max-w-[1360px] space-y-6 p-8">
      <PageHeader
        title="Ordenes de compra"
        subtitle="Consulta, edita borradores y sigue el estado de cada orden."
        actions={(
          <Button variant="primary" onClick={() => navigate('/suppliers/orders/new')}>
            <Plus size={18} />
            <span>Nueva orden</span>
          </Button>
        )}
      />

      <DataTable
        data={filteredOrders}
        columns={columns}
        keyExtractor={(item) => item.id}
        isLoading={isLoading}
        onSearch={setSearchTerm}
        searchPlaceholder="Buscar por orden, proveedor o almacen..."
        filters={(
          <div className="w-[180px]">
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 text-[13px]"
            >
              <option value="">Todas las Etiquetas</option>
              <option value="DRAFT">Borrador</option>
              <option value="SENT">Enviada</option>
              <option value="PARTIALLY_RECEIVED">Recepcion parcial</option>
              <option value="RECEIVED">Recibida</option>
              <option value="CLOSED_INCOMPLETE">Cerrada incompleta</option>
              <option value="CANCELLED">Cancelada</option>
            </Select>
          </div>
        )}
      />

      {!isLoading && filteredOrders.length === 0 && (
        <div className="rounded-2xl border border-dashed border-[var(--gray-200)] bg-white p-12 text-center text-[var(--gray-400)]">
          <ReceiptText size={22} className="mx-auto mb-3 text-[var(--gray-300)]" />
          No hay ordenes que coincidan con los filtros actuales.
        </div>
      )}
    </div>
  );
}
