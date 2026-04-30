import { useDashboard } from "../../hooks/useCore";
import { useTickets, Ticket } from "../../hooks/useTickets";
import { useAuthStore } from "../../store/authStore";
import {
  Users,
  Ticket as TicketIcon,
  Package,
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp,
  DollarSign,
  BarChart3,
  PieChart,
} from "lucide-react";
import { Link } from "react-router-dom";
import { TicketStatusBadge } from "../../components/ui/TicketStatusBadge";
// import { PriorityBadge } from '../../components/ui/PriorityBadge';
import { PageHeader } from "../../components/ui/PageHeader";
import { Button } from "../../components/ui/Button";
import { cn } from "../../lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: "blue" | "orange" | "green" | "amber" | "red" | "indigo";
  link?: string;
  linkText?: string;
}

const StatCard = ({
  label,
  value,
  icon: Icon,
  color,
  link,
  linkText,
}: StatCardProps) => {
  const colorMap = {
    blue: "bg-[#EFF3FF] text-[#2347A5]",
    orange: "bg-[#FFF3EE] text-[#EF5B2A]",
    green: "bg-[#F0FDF4] text-[#16A34A]",
    amber: "bg-[#FFFBEB] text-[#D97706]",
    red: "bg-[#FEF2F2] text-[#DC2626]",
    indigo: "bg-[#F5F3FF] text-[#7C3AED]",
  };

  return (
    <div className="bg-white border border-[var(--gray-200)] rounded-xl p-5 shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] transition-all group">
      <div className="flex justify-between items-start mb-4">
        <div
          className={cn(
            "w-10 h-10 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110",
            colorMap[color],
          )}
        >
          <Icon size={22} />
        </div>
        {link && (
          <Link
            to={link}
            className="text-[11px] font-bold text-[var(--color-brand-blue)] hover:underline uppercase tracking-wider"
          >
            {linkText || "Ver más"}
          </Link>
        )}
      </div>
      <div>
        <p className="text-[11px] font-bold text-[var(--gray-400)] uppercase tracking-[0.05em] mb-1">
          {label}
        </p>
        <p className="text-[28px] font-extrabold text-[var(--gray-800)] leading-none">
          {value}
        </p>
      </div>
    </div>
  );
};

const SimpleBarChart = ({
  data,
  title,
  icon: Icon,
  colorClass = "bg-[var(--color-brand-blue)]",
}: {
  data: Record<string, number>;
  title: string;
  icon: any;
  colorClass?: string;
}) => {
  const entries = Object.entries(data);
  const max = Math.max(...entries.map(([, val]) => val), 1);

  const statusLabels: Record<string, string> = {
    INTAKE: "Ingreso",
    DIAGNOSTIC: "Diagnóstico",
    QUOTED: "Cotizado",
    APPROVED: "Aprobado",
    WAITING_PARTS: "En espera",
    IN_REPAIR: "En reparación",
    IN_TESTING: "En pruebas",
    READY: "Listo",
    DELIVERED: "Entregado",
    CLOSED: "Cerrado",
    REJECTED: "Rechazado",
    STORAGE: "Cochera",
    CASH: "Efectivo",
    YAPE: "Yape",
    TRANSFER: "Transf.",
    CARD: "Tarjeta",
  };

  return (
    <div className="bg-white border border-[var(--gray-200)] rounded-xl shadow-[var(--shadow-sm)] overflow-hidden h-full">
      <div className="px-6 py-4 border-b border-[var(--gray-100)] flex items-center gap-2">
        <Icon size={18} className="text-[var(--gray-400)]" />
        <h2 className="text-[15px] font-bold text-[var(--gray-800)]">
          {title}
        </h2>
      </div>
      <div className="p-6 space-y-4">
        {entries.length > 0 ? (
          entries.map(([key, val]) => (
            <div key={key} className="space-y-1.5">
              <div className="flex justify-between items-end">
                <span className="text-[12px] font-bold text-[var(--gray-500)] uppercase tracking-wide">
                  {statusLabels[key] || key}
                </span>
                <span className="text-[13px] font-black text-[var(--gray-800)]">
                  {val}
                </span>
              </div>
              <div className="h-2.5 bg-[var(--gray-50)] rounded-full overflow-hidden border border-[var(--gray-100)]">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-1000",
                    colorClass,
                  )}
                  style={{ width: `${(val / max) * 100}%` }}
                />
              </div>
            </div>
          ))
        ) : (
          <div className="py-10 text-center text-[var(--gray-400)] italic text-sm">
            Sin datos para mostrar hoy.
          </div>
        )}
      </div>
    </div>
  );
};

const DashboardPage = () => {
  const { data, isLoading } = useDashboard();
  const { user } = useAuthStore();

  // Detección de roles más robusta combinando info de sesión y del backend
  const effectiveRole = data?.role || user?.role;
  const isSuperAdmin = user?.is_superuser;

  const isAdmin = isSuperAdmin || effectiveRole === "Administrador";
  const isRecep = effectiveRole === "Recepcionista";
  const isTech = effectiveRole === "Técnico";
  const isAlmacenero = effectiveRole === "Almacenero";

  const { data: recentTicketsResponse } = useTickets({
    ordering: "-created_at",
    page_size: 5,
  });

  const recentTickets = Array.isArray(recentTicketsResponse) 
    ? recentTicketsResponse 
    : recentTicketsResponse?.results || [];

  if (isLoading)
    return (
      <div className="p-12 text-center font-medium text-[var(--gray-500)]">
        Cargando métricas del sistema...
      </div>
    );
  if (!data)
    return (
      <div className="p-12 text-center text-[var(--gray-500)]">
        No hay datos disponibles en este momento
      </div>
    );

  const today = new Date().toLocaleDateString("es-ES", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="p-8 max-w-[1400px] mx-auto">
      <PageHeader
        title={`Hola, ${user?.nombre || "Usuario"} 👋`}
        subtitle={today.charAt(0).toUpperCase() + today.slice(1)}
      />

      {/* Grid de Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {isAdmin && (
          <>
            <StatCard
              label="Tickets Activos"
              value={data.metrics.active_tickets || 0}
              icon={TicketIcon}
              color="blue"
              link="/tickets"
              linkText="Ir a tickets"
            />
            <StatCard
              label="Clientes Totales"
              value={data.metrics.customers_count || 0}
              icon={Users}
              color="indigo"
              link="/customers"
            />
            <StatCard
              label="Ingresos Hoy"
              value={`S/ ${parseFloat(data.metrics.daily_revenue || 0).toFixed(2)}`}
              icon={TrendingUp}
              color="green"
            />
            <StatCard
              label="Alertas Stock"
              value={data.metrics.low_stock_alerts || 0}
              icon={AlertTriangle}
              color="red"
              link="/inventory"
            />
          </>
        )}

        {isRecep && !isSuperAdmin && (
          <>
            <StatCard
              label="Caja de Hoy"
              value={data.metrics.caja_abierta ? "Abierta" : "Cerrada"}
              icon={DollarSign}
              color={data.metrics.caja_abierta ? "green" : "red"}
              link="/finance"
              linkText="Ver finanzas"
            />
            <StatCard
              label="Equipos p/ Entrega"
              value={data.metrics.ready_tickets || 0}
              icon={Package}
              color="blue"
              link="/tickets?estado=READY"
            />
            <StatCard
              label="Ingresos del Día"
              value={`S/ ${parseFloat(data.metrics.daily_revenue || 0).toFixed(2)}`}
              icon={TrendingUp}
              color="green"
            />
            <StatCard
              label="Cobros Pendientes"
              value={data.metrics.pending_payments_count || 0}
              icon={Clock}
              color="amber"
            />
          </>
        )}

        {isTech && !isSuperAdmin && (
          <>
            <StatCard
              label="Mis Tickets Activos"
              value={data.metrics.my_active_tickets || 0}
              icon={Clock}
              color="blue"
              link="/tickets"
              linkText="Mi Cola"
            />
            <StatCard
              label="Urgentes"
              value={data.metrics.my_urgent_tickets || 0}
              icon={AlertTriangle}
              color="red"
            />
            <StatCard
              label="Completados Hoy"
              value={data.metrics.my_completed_today || 0}
              icon={CheckCircle}
              color="green"
            />
            <StatCard
              label="En Pruebas"
              value={data.metrics.my_testing_tickets || 0}
              icon={Package}
              color="indigo"
            />
          </>
        )}

        {isAlmacenero && !isSuperAdmin && (
          <>
            <StatCard
              label="Stock Crítico"
              value={data.metrics.low_stock_alerts || 0}
              icon={AlertTriangle}
              color="red"
              link="/inventory"
            />
            <StatCard
              label="Total Productos"
              value={data.metrics.total_products || 0}
              icon={Package}
              color="blue"
              link="/inventory"
            />
            <StatCard
              label="Valor Inventario"
              value={`S/ ${parseFloat(data.metrics.inventory_value || 0).toFixed(2)}`}
              icon={DollarSign}
              color="green"
            />
            <StatCard
              label="Categorías"
              value={data.metrics.categories_count || 0}
              icon={BarChart3}
              color="indigo"
            />
          </>
        )}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        <div className="lg:col-span-2">
          {isAdmin && (
            <SimpleBarChart
              title="Distribución de Tickets por Estado"
              data={data.charts.tickets_by_status || {}}
              icon={BarChart3}
              colorClass="bg-[#5A89E8]"
            />
          )}
          {isRecep && !isSuperAdmin && (
            <SimpleBarChart
              title="Ingresos por Método de Pago (Hoy)"
              data={data.charts.revenue_by_method || {}}
              icon={PieChart}
              colorClass="bg-[var(--color-success)]"
            />
          )}
          {isTech && !isSuperAdmin && (
            <SimpleBarChart
              title="Mi Estado de Trabajo Actual"
              data={data.charts.my_status_distribution || {}}
              icon={BarChart3}
              colorClass="bg-[var(--color-brand-orange)]"
            />
          )}
          {isAlmacenero && !isSuperAdmin && (
            <SimpleBarChart
              title="Productos con Menor Stock"
              data={data.charts.low_stock_products || {}}
              icon={Package}
              colorClass="bg-[var(--color-danger)]"
            />
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-white border border-[var(--gray-200)] rounded-xl p-6 shadow-[var(--shadow-sm)] flex flex-col justify-center h-full">
            <div className="flex items-center gap-3 text-[var(--color-brand-blue)] mb-4">
              <div className="p-2 bg-[var(--color-info-bg)] rounded-lg">
                <CheckCircle size={24} />
              </div>
              <h3 className="text-lg font-bold">Estado del Sistema</h3>
            </div>
            <p className="text-[var(--gray-600)] text-sm leading-relaxed mb-6">
              Todos los módulos están operando con normalidad. No se reportan
              incidencias técnicas.
            </p>
            <div className="flex items-center gap-2 text-[10px] font-black bg-[var(--gray-50)] text-[var(--gray-500)] w-fit px-3 py-1.5 rounded-full uppercase tracking-widest border border-[var(--gray-200)]">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
              SISTEMA OPERATIVO
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Actividad Reciente */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-[var(--gray-200)] rounded-xl shadow-[var(--shadow-sm)] overflow-hidden">
            <div className="px-6 py-4 border-b border-[var(--gray-100)] flex justify-between items-center bg-[var(--gray-50)]">
              <h2 className="text-[14px] font-bold text-[var(--gray-800)] uppercase tracking-tight">
                Actividad Reciente
              </h2>
              <Link
                to="/tickets"
                className="text-[11px] font-bold text-[var(--color-brand-blue)] hover:underline uppercase tracking-wider"
              >
                VER TODOS
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[var(--gray-50)] text-[10px] font-bold text-[var(--gray-400)] uppercase tracking-wider border-b border-[var(--gray-100)]">
                  <tr>
                    <th className="px-6 py-3 text-left">Folio</th>
                    <th className="px-6 py-3 text-left">Cliente / Equipo</th>
                    <th className="px-6 py-3 text-left">Estado</th>
                    <th className="px-6 py-4 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--gray-100)]">
                  {recentTickets && recentTickets.length > 0 ? (
                    (recentTickets as Ticket[]).map((ticket) => (
                      <tr
                        key={ticket.id}
                        className="hover:bg-[var(--gray-50)] transition-colors"
                      >
                        <td className="px-6 py-4 text-sm font-bold text-[var(--color-brand-blue)]">
                          {ticket.folio}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-[var(--gray-700)]">
                              {ticket.customer?.nombre || "-"}
                            </span>
                            <span className="text-[11px] font-medium text-[var(--gray-400)]">
                              {ticket.device?.marca} {ticket.device?.modelo}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <TicketStatusBadge status={ticket.estado} />
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Link to={`/tickets/${ticket.id}`}>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="font-bold text-xs"
                            >
                              VER DETALLE
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-6 py-10 text-center text-[var(--gray-400)] italic text-sm"
                      >
                        No hay actividad reciente para mostrar.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Alertas Críticas */}
        <div className="space-y-6">
          {data.metrics.low_stock_alerts > 0 && (
            <div className="bg-[var(--color-danger-bg)] border border-[var(--color-danger-border)] rounded-xl p-6 shadow-sm">
              <div className="flex items-center gap-3 text-[var(--color-danger)] mb-4">
                <AlertTriangle size={24} />
                <h4 className="font-extrabold text-[15px] uppercase tracking-tight">
                  Alertas de Stock
                </h4>
              </div>
              <p className="text-sm text-[var(--color-danger)] mb-6 leading-relaxed font-medium">
                Hay **{data.metrics.low_stock_alerts}** productos que requieren
                reposición inmediata.
              </p>
              <Link to="/inventory">
                <Button variant="danger" className="w-full font-bold">
                  Gestionar Inventario
                </Button>
              </Link>
            </div>
          )}

          <div className="bg-white border border-[var(--gray-200)] rounded-xl p-6">
            <h4 className="text-[13px] font-bold text-[var(--gray-800)] uppercase tracking-wider mb-4 border-b border-[var(--gray-100)] pb-3">
              Resumen de Turno
            </h4>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-xs font-medium text-[var(--gray-500)]">
                  Iniciado por
                </span>
                <span className="text-xs font-bold text-[var(--gray-800)]">
                  {user?.nombre}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs font-medium text-[var(--gray-500)]">
                  Rol asignado
                </span>
                <span className="text-xs font-bold text-[var(--color-brand-blue)] bg-[var(--color-info-bg)] px-2 py-0.5 rounded-full">
                  {user?.role}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
