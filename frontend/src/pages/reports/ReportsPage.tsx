import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { useDailySummaryReport, useDelinquentCustomersReport, useInventoryReport, usePurchaseReport } from '../../hooks/useReports';

const Metric = ({ label, value }: { label: string; value: string | number }) => (
  <div className="p-4 rounded-xl border border-[var(--gray-200)] bg-white">
    <div className="text-[11px] uppercase text-[var(--gray-400)] font-bold">{label}</div>
    <div className="text-2xl font-black text-[var(--gray-800)] mt-1">{value}</div>
  </div>
);

export default function ReportsPage() {
  const { data: daily } = useDailySummaryReport();
  const { data: inventory } = useInventoryReport();
  const { data: purchases } = usePurchaseReport();
  const { data: delinquent } = useDelinquentCustomersReport();

  return (
    <div className="p-8 max-w-[1280px] mx-auto space-y-8">
      <PageHeader title="Reportes operativos" subtitle="Lectura rápida para presentación, control y seguimiento de cierre." />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Metric label="Ingresos confirmados hoy" value={`S/ ${parseFloat(daily?.confirmed_revenue || 0).toFixed(2)}`} />
        <Metric label="Stock crítico" value={inventory?.summary?.low_stock_count || 0} />
        <Metric label="Órdenes abiertas" value={purchases?.summary?.open_orders || 0} />
        <Metric label="Clientes morosos" value={delinquent?.summary?.morosos_count || 0} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card>
          <CardHeader><CardTitle>Clientes morosos</CardTitle></CardHeader>
          <CardContent className="pt-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-[11px] uppercase text-[var(--gray-400)]">
                  <tr>
                    <th className="text-left py-3">Cliente</th>
                    <th className="text-left py-3">Teléfono</th>
                    <th className="text-right py-3">Monto vencido</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--gray-100)]">
                  {(delinquent?.customers || []).slice(0, 10).map((item: any) => (
                    <tr key={item.ticket__customer_id}>
                      <td className="py-3 font-semibold">{item.ticket__customer__nombre}</td>
                      <td className="py-3">{item.ticket__customer__telefono || '-'}</td>
                      <td className="py-3 text-right">S/ {parseFloat(item.overdue_amount || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Productos con menor stock</CardTitle></CardHeader>
          <CardContent className="pt-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-[11px] uppercase text-[var(--gray-400)]">
                  <tr>
                    <th className="text-left py-3">Producto</th>
                    <th className="text-right py-3">Disponible</th>
                    <th className="text-right py-3">Mínimo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--gray-100)]">
                  {(inventory?.low_stock_products || []).slice(0, 10).map((item: any) => (
                    <tr key={item.id}>
                      <td className="py-3 font-semibold">{item.codigo} - {item.nombre}</td>
                      <td className="py-3 text-right">{item.stock_disponible}</td>
                      <td className="py-3 text-right">{item.stock_minimo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
