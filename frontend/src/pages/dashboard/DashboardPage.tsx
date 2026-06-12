import { useEffect, useMemo, useState } from "react";
import type { ElementType, ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  Boxes,
  CheckCircle,
  ClipboardCheck,
  CreditCard,
  DollarSign,
  FileText,
  Package,
  ShieldCheck,
  Sparkles,
  Ticket,
  TrendingUp,
  Wrench,
} from "lucide-react";

import { useDashboard, type DashboardKey, type DashboardSection } from "../../hooks/useCore";
import { useAuthStore } from "../../store/authStore";
import { cn } from "../../lib/utils";

type MetricTone = "blue" | "green" | "amber" | "red" | "orange" | "neutral";

type MetricCardProps = {
  label: string;
  value: string | number;
  note?: string;
  icon: ElementType;
  tone?: MetricTone;
  href?: string;
};

type ActionItem = {
  id?: string | number;
  title: string;
  meta?: string;
  badge?: string;
  href: string;
  danger?: boolean;
};

const dashboardLabels: Record<DashboardKey, { label: string; icon: ElementType }> = {
  admin: { label: "Administrador", icon: ShieldCheck },
  reception: { label: "Recepcion", icon: CreditCard },
  technician: { label: "Tecnico", icon: Wrench },
  warehouse: { label: "Almacen", icon: Boxes },
};
const dashboardKeys = Object.keys(dashboardLabels) as DashboardKey[];

const statusLabels: Record<string, string> = {
  INTAKE: "Ingreso",
  DIAGNOSTIC: "Diagnostico",
  QUOTED: "Cotizado",
  APPROVED: "Aprobado",
  WAITING_PARTS: "Espera repuesto",
  IN_REPAIR: "Reparacion",
  IN_TESTING: "Pruebas",
  READY: "Listo",
  STORAGE: "Cochera",
};

const paymentLabels: Record<string, string> = {
  CASH: "Efectivo",
  YAPE: "Yape",
  PLIN: "Plin",
  TRANSFER: "Transferencia",
  CARD: "Tarjeta",
};

const paymentColors: Record<string, string> = {
  CASH: "#86EFAC",
  YAPE: "#93C5FD",
  PLIN: "#FDBA74",
  TRANSFER: "#FDE68A",
  CARD: "#C4B5FD",
};

const auditActionLabels: Record<string, string> = {
  CREATE: "Crear",
  UPDATE: "Editar",
  DELETE: "Eliminar",
  STATUS_CHANGE: "Cambio de estado",
  APPROVAL: "Aprobacion",
  PAYMENT: "Pago",
  SYSTEM: "Sistema",
};

const auditActionClasses: Record<string, string> = {
  CREATE: "border-[var(--color-success-border)] bg-[var(--color-success-bg)] text-[var(--color-success)]",
  UPDATE: "border-[var(--color-info-border)] bg-[var(--color-info-bg)] text-[var(--color-brand-blue)]",
  DELETE: "border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] text-[var(--color-danger)]",
  STATUS_CHANGE: "border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] text-[var(--color-warning)]",
  APPROVAL: "border-[#DDD6FE] bg-[#F5F3FF] text-[#6D28D9]",
  PAYMENT: "border-[var(--color-success-border)] bg-[var(--color-success-bg)] text-[var(--color-success)]",
  SYSTEM: "border-[var(--gray-200)] bg-[var(--gray-100)] text-[var(--gray-500)]",
};

const moduleLabels: Record<string, string> = {
  tickets: "Tickets",
  suppliers: "Compras",
  quotes: "Cotizaciones",
  finance: "Finanzas",
  products: "Inventario",
  customers: "Clientes",
  hr: "RR.HH.",
  system: "Sistema",
};

const toneClasses: Record<MetricTone, string> = {
  blue: "bg-[var(--color-info-bg)] text-[var(--color-brand-blue)] border-[var(--color-info-border)]",
  green: "bg-[var(--color-success-bg)] text-[var(--color-success)] border-[var(--color-success-border)]",
  amber: "bg-[var(--color-warning-bg)] text-[var(--color-warning)] border-[var(--color-warning-border)]",
  red: "bg-[var(--color-danger-bg)] text-[var(--color-danger)] border-[var(--color-danger-border)]",
  orange: "bg-[#FFF3EE] text-[var(--color-brand-orange)] border-[#FFD3C2]",
  neutral: "bg-[var(--gray-100)] text-[var(--gray-500)] border-[var(--gray-200)]",
};

const dashboardSessionKey = "argos.dashboard.active";

const ticketStatusToneClasses: Record<string, string> = {
  INTAKE: "border-[var(--color-info-border)] bg-[var(--color-info-bg)]",
  DIAGNOSTIC: "border-[var(--color-info-border)] bg-[var(--color-info-bg)]",
  QUOTED: "border-[var(--color-warning-border)] bg-[var(--color-warning-bg)]",
  IN_REPAIR: "border-[#FFD3C2] bg-[#FFF7F3]",
  IN_TESTING: "border-[#B8E5FF] bg-[#F0F9FF]",
  READY: "border-[var(--color-success-border)] bg-[var(--color-success-bg)]",
  STORAGE: "border-[var(--color-danger-border)] bg-[var(--color-danger-bg)]",
};

function formatMoney(value: unknown) {
  const amount = Number(value || 0);
  return `S/ ${amount.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatNumber(value: unknown) {
  return Number(value || 0).toLocaleString("es-PE");
}

function formatAuditDate(value: unknown) {
  if (!value) return "Sin fecha";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "Sin fecha";
  return date.toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "short",
  });
}

function formatAuditTime(value: unknown) {
  if (!value) return "--:--";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "--:--";
  return date.toLocaleTimeString("es-PE", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function percentage(value: number, max: number) {
  if (!max) return 0;
  return Math.max(0, Math.min(100, (value / max) * 100));
}

function DashboardTabs({
  available,
  active,
  onChange,
}: {
  available: DashboardKey[];
  active: DashboardKey | null;
  onChange: (key: DashboardKey) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <div className="inline-flex rounded-[10px] border border-[var(--gray-200)] bg-white p-1 shadow-[var(--shadow-sm)]">
        {available.map((key) => {
          const Icon = dashboardLabels[key].icon;
          const isActive = active === key;
          return (
            <button
              key={key}
              onClick={() => onChange(key)}
              className={cn(
                "flex h-9 items-center gap-2 rounded-lg px-4 text-[13px] font-bold transition-colors",
                isActive
                  ? "bg-[var(--color-info-bg)] text-[var(--color-brand-blue)] shadow-[inset_0_0_0_1px_var(--color-info-border)]"
                  : "text-[var(--gray-500)] hover:bg-[var(--gray-50)] hover:text-[var(--gray-800)]",
              )}
            >
              <Icon size={16} />
              {dashboardLabels[key].label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MetricCard({ label, value, note, icon: Icon, tone = "blue", href }: MetricCardProps) {
  const content = (
    <div className="group h-full rounded-xl border border-[var(--gray-200)] bg-white p-5 shadow-[var(--shadow-sm)] transition-all hover:shadow-[var(--shadow-md)]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className={cn("grid h-10 w-10 place-items-center rounded-lg border", toneClasses[tone])}>
          <Icon size={21} />
        </div>
        {href && (
          <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--color-brand-blue)]">
            Ver
          </span>
        )}
      </div>
      <p className="mb-1 text-[11px] font-black uppercase tracking-[0.06em] text-[var(--gray-400)]">
        {label}
      </p>
      <p className="text-[28px] font-black leading-none text-[var(--gray-800)]">{value}</p>
      {note && <p className="mt-3 text-[12px] leading-relaxed text-[var(--gray-500)]">{note}</p>}
    </div>
  );

  if (!href) return content;
  return (
    <Link to={href} className="block h-full">
      {content}
    </Link>
  );
}

function SectionCard({
  title,
  subtitle,
  action,
  className,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn("overflow-hidden rounded-xl border border-[var(--gray-200)] bg-white shadow-[var(--shadow-sm)]", className)}>
      <header className="flex min-h-14 items-center justify-between gap-4 border-b border-[var(--gray-200)] px-5 py-4">
        <div>
          <h2 className="text-[15px] font-bold text-[var(--gray-800)]">{title}</h2>
          {subtitle && <p className="mt-1 text-[12px] text-[var(--gray-500)]">{subtitle}</p>}
        </div>
        {action}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

function ActionLink({ href, children, danger = false }: { href: string; children: ReactNode; danger?: boolean }) {
  return (
    <Link
      to={href}
      className={cn(
        "inline-flex h-8 items-center justify-center rounded-md border px-3 text-[12px] font-bold transition-colors",
        danger
          ? "border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] text-[var(--color-danger)]"
          : "border-[var(--gray-300)] bg-white text-[var(--gray-700)] hover:bg-[var(--gray-50)]",
      )}
    >
      {children}
    </Link>
  );
}

function ActionQueue({ items, emptyText }: { items: ActionItem[]; emptyText: string }) {
  if (!items.length) {
    return (
      <div className="rounded-lg border border-dashed border-[var(--gray-200)] bg-[var(--gray-50)] px-4 py-8 text-center text-sm font-medium text-[var(--gray-400)]">
        {emptyText}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div
          key={`${item.title}-${item.id ?? index}`}
          className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-lg border border-[var(--gray-200)] bg-white p-4"
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-[var(--gray-800)]">{item.title}</span>
              {item.badge && (
                <span className="rounded-full bg-[var(--gray-100)] px-2 py-0.5 text-[11px] font-bold text-[var(--gray-500)]">
                  {item.badge}
                </span>
              )}
            </div>
            {item.meta && <p className="mt-1 text-[12px] leading-relaxed text-[var(--gray-500)]">{item.meta}</p>}
          </div>
          <ActionLink href={item.href} danger={item.danger}>
            Abrir
          </ActionLink>
        </div>
      ))}
    </div>
  );
}

function BarRows({ data, colors }: { data: Record<string, number>; colors?: Record<string, string> }) {
  const entries = Object.entries(data || {});
  const max = Math.max(...entries.map(([, value]) => value), 1);

  if (!entries.length) {
    return <p className="py-8 text-center text-sm font-medium text-[var(--gray-400)]">Sin datos para mostrar.</p>;
  }

  return (
    <div className="space-y-3">
      {entries.map(([key, value]) => (
        <div key={key} className="grid grid-cols-[132px_1fr_42px] items-center gap-3 max-sm:grid-cols-1 max-sm:gap-1">
          <span className="text-[12px] font-bold text-[var(--gray-600)]">{statusLabels[key] || paymentLabels[key] || key}</span>
          <div className="h-2.5 overflow-hidden rounded-full border border-[var(--gray-200)] bg-[var(--gray-100)]">
            <div
              className="h-full rounded-full"
              style={{
                width: `${percentage(value, max)}%`,
                background: colors?.[key] || "linear-gradient(90deg, var(--color-brand-blue), #93C5FD)",
              }}
            />
          </div>
          <span className="text-right text-[12px] font-black text-[var(--gray-800)] max-sm:text-left">{value}</span>
        </div>
      ))}
    </div>
  );
}

function TicketFlowChart({ data }: { data: Record<string, number> }) {
  const order = ["INTAKE", "DIAGNOSTIC", "QUOTED", "IN_REPAIR", "IN_TESTING", "READY", "STORAGE"];
  const filtered = order.reduce<Record<string, number>>((acc, key) => {
    acc[key] = Number(data?.[key] || 0);
    return acc;
  }, {});

  return (
    <div className="rounded-xl border border-[var(--gray-200)] bg-[linear-gradient(180deg,rgba(248,249,251,.72),rgba(255,255,255,.96))] p-4">
      <div className="mb-5 grid grid-cols-7 gap-2 overflow-x-auto max-xl:grid-cols-[repeat(7,minmax(112px,1fr))]">
        {order.map((key, index) => (
          <div
            key={key}
            className={cn(
              "relative min-h-[90px] rounded-lg border p-3 shadow-[var(--shadow-sm)]",
              ticketStatusToneClasses[key] || "border-[var(--gray-200)] bg-[var(--gray-50)]",
            )}
          >
            {index < order.length - 1 && (
              <span className="absolute right-[-9px] top-1/2 z-10 h-0.5 w-2 bg-[var(--gray-300)]" />
            )}
            <strong className="block text-[22px] leading-none text-[var(--gray-800)]">{filtered[key]}</strong>
            <span className="mt-2 block text-[11px] font-black uppercase tracking-[0.05em] text-[var(--gray-500)]">
              {statusLabels[key]}
            </span>
          </div>
        ))}
      </div>
      <BarRows
        data={filtered}
        colors={order.reduce<Record<string, string>>((acc, key) => {
          acc[key] = "linear-gradient(90deg, var(--color-brand-blue), #93C5FD)";
          return acc;
        }, {})}
      />
    </div>
  );
}

function SparklineRevenue({ data }: { data: Array<{ date: string; total: number }> }) {
  const values = data.map((item) => Number(item.total || 0));
  const max = Math.max(...values, 1);
  const points = values.map((value, index) => {
    const x = values.length <= 1 ? 0 : (index / (values.length - 1)) * 360;
    const y = 78 - percentage(value, max) * 0.62;
    return `${x},${y}`;
  });
  const areaPoints = `0,90 ${points.join(" ")} 360,90`;

  return (
    <div className="rounded-lg border border-[var(--gray-200)] bg-[linear-gradient(180deg,#fff,var(--gray-50))] p-4">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <strong className="text-[13px] text-[var(--gray-800)]">Ingresos confirmados - ultimos 7 dias</strong>
        <span className="text-[12px] font-bold text-[var(--color-success)]">{formatMoney(values[values.length - 1])}</span>
      </div>
      <svg viewBox="0 0 360 90" className="h-[74px] w-full" role="img" aria-label="Tendencia de ingresos">
        <polygon points={areaPoints} fill="rgba(35,71,165,.10)" />
        <polyline points={points.join(" ")} fill="none" stroke="var(--color-brand-blue)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function PaymentDonut({ data }: { data: Record<string, number> }) {
  const entries = Object.entries(data || {}).filter(([, value]) => Number(value) > 0);
  const total = entries.reduce((sum, [, value]) => sum + Number(value || 0), 0);
  let cursor = 0;
  const segments = entries.map(([key, value]) => {
    const start = cursor;
    const size = total ? (Number(value) / total) * 100 : 0;
    cursor += size;
    return `${paymentColors[key] || "var(--gray-300)"} ${start}% ${cursor}%`;
  });

  if (!entries.length) {
    return <p className="py-8 text-center text-sm font-medium text-[var(--gray-400)]">Sin pagos confirmados para este turno.</p>;
  }

  return (
    <div className="grid grid-cols-[170px_1fr] items-center gap-5 rounded-xl border border-[var(--gray-200)] bg-[var(--gray-50)] p-4 max-sm:grid-cols-1 max-sm:justify-items-center">
      <div
        className="relative grid h-[158px] w-[158px] place-items-center rounded-full shadow-[0_10px_24px_rgba(35,71,165,.10)] before:absolute before:inset-[18px] before:rounded-full before:bg-white before:shadow-[inset_0_0_0_1px_var(--gray-200)]"
        style={{ background: `conic-gradient(${segments.join(", ")})` }}
      >
        <div className="relative translate-y-1 text-center">
          <strong className="block max-w-[96px] text-[16px] leading-tight text-[var(--gray-800)]">{formatMoney(total)}</strong>
          <span className="mt-0.5 block text-[10px] font-black uppercase tracking-[0.06em] text-[var(--gray-500)]">Turno</span>
        </div>
      </div>
      <div className="w-full space-y-3">
        <div className="flex h-[18px] overflow-hidden rounded-full border border-[var(--gray-200)] bg-[var(--gray-100)]">
          {entries.map(([key, value]) => (
            <span
              key={key}
              style={{ width: `${percentage(Number(value), total)}%`, background: paymentColors[key] || "var(--gray-300)" }}
            />
          ))}
        </div>
        {entries.map(([key, value]) => (
          <div key={key} className="grid grid-cols-[10px_1fr_auto] items-center gap-2 text-[12px] font-bold text-[var(--gray-600)]">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: paymentColors[key] || "var(--gray-300)" }} />
            <span>{paymentLabels[key] || key}</span>
            <strong className="text-[var(--gray-800)]">{formatMoney(value)}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function TechnicianWorkChart({ section }: { section: DashboardSection }) {
  const distribution = (section.charts.status_distribution || {}) as Record<string, number>;
  const progressRate = Number(section.metrics.progress_rate || 0);

  return (
    <div className="rounded-xl border border-[var(--gray-200)] bg-[var(--gray-50)] p-4">
      <div className="mb-5 rounded-lg border border-[var(--gray-200)] bg-white p-4">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-[12px] font-black uppercase tracking-[0.06em] text-[var(--gray-500)]">Progreso de hoy</span>
          <strong className="text-[24px] leading-none text-[var(--gray-800)]">{progressRate}%</strong>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-[var(--gray-100)]">
          <div className="h-full rounded-full bg-[linear-gradient(90deg,var(--color-brand-blue),#93C5FD)]" style={{ width: `${progressRate}%` }} />
        </div>
        <p className="mt-2 text-[12px] text-[var(--gray-500)]">Calculado con tickets listos hoy frente a carga activa.</p>
      </div>
      <BarRows
        data={distribution}
        colors={{
          DIAGNOSTIC: "linear-gradient(90deg, var(--color-brand-blue), #93C5FD)",
          QUOTED: "linear-gradient(90deg, var(--color-brand-blue), #93C5FD)",
          IN_REPAIR: "linear-gradient(90deg, var(--color-brand-blue), #93C5FD)",
          IN_TESTING: "linear-gradient(90deg, var(--color-brand-blue), #93C5FD)",
          WAITING_PARTS: "linear-gradient(90deg, var(--color-brand-blue), #93C5FD)",
        }}
      />
    </div>
  );
}

function AdminDashboard({ section, tabs }: { section: DashboardSection; tabs: ReactNode }) {
  const metrics = section.metrics;
  const actions = section.actions;
  const decisionItems: ActionItem[] = [
    ...(actions.pending_digital_payments || []).map((item: any) => ({
      id: `payment-${item.id}`,
      title: `Pago ${item.folio}`,
      meta: `${item.ticket_folio || "Sin ticket"} - ${formatMoney(item.amount)} via ${paymentLabels[item.method] || item.method}`,
      badge: "Pago digital",
      href: item.ticket_id ? `/tickets/${item.ticket_id}` : "/finance",
    })),
    ...(actions.pending_discounts || []).map((item: any) => ({
      id: `discount-${item.id}`,
      title: `Descuento ${formatMoney(item.amount)}`,
      meta: `${item.ticket_folio || "Sin ticket"} - solicitado por ${item.requested_by || "usuario"}`,
      badge: item.type,
      href: "/finance",
    })),
    ...(actions.pending_reversals || []).map((item: any) => ({
      id: `reversal-${item.id}`,
      title: `Reversa ${item.receipt_folio}`,
      meta: `${formatMoney(item.amount)} - solicitado por ${item.requested_by || "usuario"}`,
      href: "/finance",
      danger: true,
    })),
  ].slice(0, 5);

  return (
    <DashboardShell
      eyebrow="Administrador / Gestion"
      title="Cabina de control del negocio"
      subtitle="Finanzas, operacion, riesgos, aprobaciones, personal, inventario y auditoria."
      headerAction={tabs}
    >
      <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Ingresos hoy" value={formatMoney(metrics.daily_revenue)} note="Recibos confirmados." icon={TrendingUp} tone="green" />
        <MetricCard label="Tickets activos" value={formatNumber(metrics.active_tickets)} note={`${formatNumber(metrics.ready_tickets)} listos o en cochera.`} icon={Ticket} href="/tickets" />
        <MetricCard label="Aprobaciones" value={formatNumber(Number(metrics.pending_discounts || 0) + Number(metrics.pending_reversals || 0) + Number(metrics.pending_digital_payments || 0))} note="Pagos, descuentos y reversas pendientes." icon={ShieldCheck} tone="amber" href="/finance" />
        <MetricCard label="Stock critico" value={formatNumber(metrics.low_stock_alerts)} note="Productos bajo minimo." icon={AlertTriangle} tone="red" href="/inventory" />
      </div>

      <div className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-[1.45fr_.85fr]">
        <SectionCard title="Flujo de tickets por estado" subtitle="Detecta cuellos de botella del taller." action={<ActionLink href="/tickets">Ver tickets</ActionLink>}>
          <TicketFlowChart data={section.charts.ticket_flow || {}} />
        </SectionCard>
        <SectionCard title="Centro de decisiones" subtitle="Acciones sensibles del administrador.">
          <ActionQueue items={decisionItems} emptyText="No hay aprobaciones pendientes." />
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <SectionCard title="Finanzas y caja" subtitle="Margen operativo y caja del dia.">
          <SparklineRevenue data={section.charts.revenue_trend || []} />
          <div className="mt-3 grid grid-cols-2 gap-3">
            <MiniInfo title="Cajas con diferencia" value={formatNumber(metrics.cash_difference_count)} />
            <MiniInfo title="Diferencia total" value={formatMoney(metrics.cash_difference_total)} />
            <MiniInfo title="Cuotas vencidas" value={formatNumber(metrics.overdue_installments)} />
            <MiniInfo title="Morosos" value={formatNumber(metrics.clientes_morosos)} />
          </div>
        </SectionCard>
        <SectionCard className="xl:col-span-2" title="Auditoria reciente" subtitle="Cambios sensibles del sistema.">
          <AuditList items={actions.audit_logs || []} />
        </SectionCard>
      </div>
    </DashboardShell>
  );
}

function ReceptionDashboard({ section, tabs }: { section: DashboardSection; tabs: ReactNode }) {
  const metrics = section.metrics;
  const actions = section.actions;
  const workItems: ActionItem[] = [
    ...(actions.ready_to_deliver || []).map((ticket: any) => ({
      id: `deliver-${ticket.id}`,
      title: `Entregar ${ticket.folio}`,
      meta: `${ticket.customer} - ${ticket.device || "Equipo registrado"}`,
      badge: "Saldo 0",
      href: `/tickets/${ticket.id}`,
    })),
    ...(actions.pending_collection || []).map((ticket: any) => ({
      id: `collect-${ticket.id}`,
      title: `Cobrar ${ticket.folio}`,
      meta: `${ticket.customer} - saldo ${formatMoney(ticket.saldo_pendiente)}`,
      href: `/tickets/${ticket.id}`,
    })),
    ...(actions.pending_digital_payments || []).map((item: any) => ({
      id: `payment-${item.id}`,
      title: `Pago ${item.folio}`,
      meta: `${item.ticket_folio || "Sin ticket"} - ${formatMoney(item.amount)} via ${paymentLabels[item.method] || item.method}`,
      badge: "Pago digital",
      href: item.ticket_id ? `/tickets/${item.ticket_id}` : "/finance",
    })),
  ].slice(0, 5);

  return (
    <DashboardShell
      eyebrow="Recepcion / Caja"
      title="Mostrador, cobros y entregas"
      subtitle="Entrada de equipos, pagos, cotizaciones y entrega segura."
      headerAction={tabs}
    >
      <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Caja del turno" value={metrics.cash_open ? "Abierta" : "Cerrada"} note={`Esperado: ${formatMoney(metrics.cash_expected_amount)}`} icon={DollarSign} tone={metrics.cash_open ? "green" : "red"} href="/finance" />
        <MetricCard label="Equipos listos" value={formatNumber(metrics.ready_tickets)} note={`${formatNumber(metrics.ready_with_pending_balance)} con saldo pendiente.`} icon={Package} href="/tickets?estado=READY" />
        <MetricCard label="Ingresos del turno" value={formatMoney(metrics.daily_revenue)} note="Solo recibos confirmados." icon={TrendingUp} tone="green" />
        <MetricCard label="Pagos digitales" value={formatNumber(metrics.pending_digital_payments)} note="Pendientes de validacion." icon={CreditCard} tone="amber" href="/finance" />
      </div>

      <div className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-[1.25fr_.9fr]">
        <SectionCard title="Trabajo inmediato" subtitle="Cola priorizada para recepcion.">
          <ActionQueue items={workItems} emptyText="No hay entregas ni cobros pendientes." />
        </SectionCard>
        <SectionCard title="Caja y metodos de pago" subtitle="Montos confirmados del turno." action={<ActionLink href="/finance">Cerrar caja</ActionLink>}>
          <PaymentDonut data={section.charts.payment_methods_today || {}} />
        </SectionCard>
      </div>

      <SectionCard title="Accesos utiles del mostrador" subtitle="Funciones frecuentes para atencion presencial.">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <QuickLink title="Buscar cliente" description="DNI, RUC, nombre o telefono." href="/customers" />
          <QuickLink title="Enviar cotizacion" description={`${formatNumber(metrics.quotes_pending)} pendientes.`} href="/quotes" />
          <QuickLink title="Registrar pago" description="Caja abierta requerida." href="/finance" />
          <QuickLink title="Imprimir documentos" description="Ficha, recibo y entrega." href="/tickets" />
        </div>
      </SectionCard>
    </DashboardShell>
  );
}

function TechnicianDashboard({ section, tabs }: { section: DashboardSection; tabs: ReactNode }) {
  const metrics = section.metrics;
  const actions = section.actions;
  const activeTickets = metrics.active_tickets ?? metrics.my_active_tickets;
  const urgentTickets = metrics.urgent_tickets ?? metrics.my_urgent_tickets;
  const completedToday = metrics.completed_today ?? metrics.my_completed_today;
  const waitingParts = metrics.waiting_parts ?? metrics.my_waiting_parts;
  const testingTickets = metrics.testing_tickets ?? metrics.my_testing_tickets;
  const workItems: ActionItem[] = [
    ...(actions.diagnosis_queue || []).map((ticket: any) => ({ id: `d-${ticket.id}`, title: `Diagnosticar ${ticket.folio}`, meta: `${ticket.customer} - ${ticket.device}`, href: `/tickets/${ticket.id}` })),
    ...(actions.repair_queue || []).map((ticket: any) => ({ id: `r-${ticket.id}`, title: `Reparar ${ticket.folio}`, meta: `${ticket.customer} - ${ticket.device}`, href: `/tickets/${ticket.id}` })),
    ...(actions.testing_queue || []).map((ticket: any) => ({ id: `t-${ticket.id}`, title: `Completar pruebas ${ticket.folio}`, meta: `${ticket.customer} - checklist pendiente`, href: `/tickets/${ticket.id}` })),
    ...(actions.waiting_parts || []).map((ticket: any) => ({ id: `w-${ticket.id}`, title: `Esperando repuesto ${ticket.folio}`, meta: `${ticket.customer} - revisar reserva`, href: `/tickets/${ticket.id}`, danger: true })),
  ].slice(0, 6);

  return (
    <DashboardShell
      eyebrow="Tecnico / Taller"
      title="Carga general de taller"
      subtitle="Diagnostico, reparacion, reservas y checklist sin ruido financiero."
      headerAction={tabs}
    >
      <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Tickets activos" value={formatNumber(activeTickets)} note="Carga activa del taller." icon={ClipboardCheck} />
        <MetricCard label="Urgentes" value={formatNumber(urgentTickets)} note="Prioridad critica." icon={AlertTriangle} tone="red" />
        <MetricCard label="Listos hoy" value={formatNumber(completedToday)} note="Movidos a listo." icon={CheckCircle} tone="green" />
        <MetricCard label="Espera repuesto" value={formatNumber(waitingParts)} note="Bloqueados por stock." icon={Package} tone="amber" />
        <MetricCard label="En pruebas" value={formatNumber(testingTickets)} note="Checklist y QC." icon={Sparkles} tone="orange" />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.2fr_.9fr]">
        <SectionCard title="Siguiente mejor accion" subtitle="Ordenado por prioridad, estado y antiguedad.">
          <ActionQueue items={workItems} emptyText="No hay trabajo tecnico pendiente." />
        </SectionCard>
        <SectionCard title="Distribucion general de trabajo" subtitle="Grafico corregido sin gauge circular.">
          <TechnicianWorkChart section={section} />
        </SectionCard>
      </div>
    </DashboardShell>
  );
}

function WarehouseDashboard({ section, tabs }: { section: DashboardSection; tabs: ReactNode }) {
  const metrics = section.metrics;
  const actions = section.actions;

  return (
    <DashboardShell
      eyebrow="Almacen / Logistica"
      title="Inventario, reservas y compras"
      subtitle="Stock disponible, reservas fisicas y ordenes de compra."
      headerAction={tabs}
    >
      <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Stock bajo" value={formatNumber(metrics.low_stock_alerts)} note="Productos bajo minimo." icon={AlertTriangle} tone="red" href="/inventory" />
        <MetricCard label="Reservas activas" value={formatNumber(metrics.active_reservations)} note={`${formatNumber(metrics.pending_delivery_reservations)} por entregar.`} icon={Package} tone="amber" href="/inventory/reservations" />
        <MetricCard label="OC abiertas" value={formatNumber(metrics.purchase_orders_open)} note={`${formatNumber(metrics.purchase_orders_partially_received)} parciales.`} icon={FileText} href="/suppliers/orders" />
        <MetricCard label="Valor inventario" value={formatMoney(metrics.inventory_value)} note="Segun precio de venta." icon={DollarSign} tone="green" />
      </div>

      <SectionCard title="Compras y recepciones" subtitle="Ordenes abiertas y mercaderia esperada." action={<ActionLink href="/suppliers/orders">Ver compras</ActionLink>}>
        <PurchaseOrdersTable items={actions.purchase_orders || []} />
      </SectionCard>
    </DashboardShell>
  );
}

function DashboardShell({
  eyebrow,
  title,
  subtitle,
  headerAction,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  headerAction?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="px-1">
      <div className="mb-5 mt-3 flex items-end justify-between gap-5 px-3 max-lg:flex-col max-lg:items-start">
        <div>
          <p className="mb-1 text-[12px] font-black uppercase tracking-[0.08em] text-[var(--color-brand-blue)]">{eyebrow}</p>
          <h1 className="text-[24px] font-bold leading-tight text-[var(--gray-800)]">{title}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--gray-500)]">{subtitle}</p>
        </div>
        {headerAction && <div className="self-end pb-1 max-lg:self-start max-lg:pb-0">{headerAction}</div>}
      </div>
      {children}
    </div>
  );
}

function MiniInfo({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--gray-200)] bg-[var(--gray-50)] p-3">
      <span className="block text-[11px] font-black uppercase tracking-[0.06em] text-[var(--gray-400)]">{title}</span>
      <strong className="mt-1 block text-[16px] text-[var(--gray-800)]">{value}</strong>
    </div>
  );
}

function QuickLink({ title, description, href }: { title: string; description: string; href: string }) {
  return (
    <Link to={href} className="rounded-lg border border-[var(--gray-200)] bg-[var(--gray-50)] p-4 transition-colors hover:bg-white">
      <strong className="block text-[13px] text-[var(--gray-800)]">{title}</strong>
      <span className="mt-1 block text-[12px] leading-relaxed text-[var(--gray-500)]">{description}</span>
    </Link>
  );
}

function AuditList({ items }: { items: any[] }) {
  if (!items.length) {
    return <p className="py-8 text-center text-sm font-medium text-[var(--gray-400)]">Sin actividad reciente.</p>;
  }

  return (
    <div className="min-h-[210px]">
      <div className="overflow-x-auto rounded-lg border border-[var(--gray-200)]">
        <table className="w-full min-w-[680px] table-fixed border-collapse bg-white">
          <thead>
            <tr className="border-b border-[var(--gray-200)] bg-[var(--gray-50)]">
              <th className="w-[34%] px-4 py-3 text-left text-[11px] font-black uppercase tracking-[0.06em] text-[var(--gray-500)]">Registro</th>
              <th className="w-[18%] px-4 py-3 text-left text-[11px] font-black uppercase tracking-[0.06em] text-[var(--gray-500)]">Accion</th>
              <th className="w-[16%] px-4 py-3 text-left text-[11px] font-black uppercase tracking-[0.06em] text-[var(--gray-500)]">Modulo</th>
              <th className="w-[20%] px-4 py-3 text-left text-[11px] font-black uppercase tracking-[0.06em] text-[var(--gray-500)]">Usuario</th>
              <th className="w-[12%] px-4 py-3 text-right text-[11px] font-black uppercase tracking-[0.06em] text-[var(--gray-500)]">Fecha</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const actionLabel = item.action_label || auditActionLabels[item.action] || item.action || "Actividad";
              const recordLabel = item.display_label || item.object_repr || item.object_id || item.module;
              const moduleLabel = moduleLabels[item.module] || item.module || "Sistema";
              return (
                <tr key={item.id} className="border-b border-[var(--gray-100)] last:border-0">
                  <td className="px-4 py-3">
                    <div className="min-w-0">
                      {item.related_url ? (
                        <Link to={item.related_url} className="inline-block max-w-full truncate text-[13px] font-bold text-[var(--gray-800)] hover:underline">
                          {recordLabel}
                        </Link>
                      ) : (
                        <strong className="block truncate text-[13px] text-[var(--gray-800)]">{recordLabel}</strong>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn("inline-flex rounded-full border px-2 py-1 text-[11px] font-bold", auditActionClasses[item.action] || auditActionClasses.SYSTEM)}>
                      {actionLabel}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[12px] font-bold text-[var(--gray-600)]">{moduleLabel}</td>
                  <td className="px-4 py-3 text-[12px] text-[var(--gray-600)]">{item.user || "Sistema"}</td>
                  <td className="px-4 py-3 text-right">
                    <span className="block text-[12px] font-bold text-[var(--gray-700)]">{formatAuditDate(item.created_at)}</span>
                    <span className="mt-0.5 block text-[11px] font-bold text-[var(--gray-400)]">{formatAuditTime(item.created_at)}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PurchaseOrdersTable({ items }: { items: any[] }) {
  if (!items.length) {
    return <p className="py-8 text-center text-sm font-medium text-[var(--gray-400)]">No hay ordenes de compra abiertas.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-[var(--gray-200)] bg-[var(--gray-50)]">
            <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-[0.06em] text-[var(--gray-500)]">OC</th>
            <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-[0.06em] text-[var(--gray-500)]">Proveedor</th>
            <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-[0.06em] text-[var(--gray-500)]">Estado</th>
            <th className="px-4 py-3 text-right text-[11px] font-black uppercase tracking-[0.06em] text-[var(--gray-500)]">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-b border-[var(--gray-100)] last:border-0">
              <td className="px-4 py-3 font-bold text-[var(--color-brand-blue)]">{item.folio}</td>
              <td className="px-4 py-3 text-[var(--gray-700)]">{item.supplier}</td>
              <td className="px-4 py-3">
                <span className="rounded-full bg-[var(--color-info-bg)] px-2 py-1 text-[11px] font-bold text-[var(--color-brand-blue)]">{item.estado}</span>
              </td>
              <td className="px-4 py-3 text-right font-bold text-[var(--gray-800)]">{formatMoney(item.subtotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const DashboardPage = () => {
  const { data, isLoading } = useDashboard();
  const { user } = useAuthStore();
  const [activeDashboard, setActiveDashboard] = useState<DashboardKey | null>(() => {
    if (typeof window === "undefined") return null;
    const saved = window.sessionStorage.getItem(dashboardSessionKey) as DashboardKey | null;
    return saved && dashboardKeys.includes(saved) ? saved : null;
  });

  const availableDashboards = data?.available_dashboards || [];
  const defaultDashboard = data?.default_dashboard || null;

  useEffect(() => {
    if (!data) return;
    if (!activeDashboard || !availableDashboards.includes(activeDashboard)) {
      setActiveDashboard(defaultDashboard);
    }
  }, [activeDashboard, availableDashboards, data, defaultDashboard]);

  useEffect(() => {
    if (!activeDashboard || !availableDashboards.includes(activeDashboard) || typeof window === "undefined") return;
    window.sessionStorage.setItem(dashboardSessionKey, activeDashboard);
  }, [activeDashboard, availableDashboards]);

  const handleDashboardChange = (key: DashboardKey) => {
    setActiveDashboard(key);
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(dashboardSessionKey, key);
    }
  };

  const activeSection = useMemo(() => {
    if (!data || !activeDashboard) return null;
    return data.dashboards[activeDashboard] || null;
  }, [activeDashboard, data]);

  if (isLoading) {
    return <div className="p-12 text-center font-medium text-[var(--gray-500)]">Cargando metricas del sistema...</div>;
  }

  if (!data || !availableDashboards.length) {
    return (
      <div className="p-12 text-center text-[var(--gray-500)]">
        No hay dashboards disponibles para tu usuario.
      </div>
    );
  }

  const tabs = <DashboardTabs available={availableDashboards} active={activeDashboard} onChange={handleDashboardChange} />;

  return (
    <div className="mx-auto max-w-[1440px] px-8 pb-8 pt-2 max-sm:px-4 max-sm:pb-4 max-sm:pt-2">
      <div className="mb-8 rounded-xl border border-[var(--gray-200)] bg-white p-4 shadow-[var(--shadow-sm)]">
        <div className="flex items-center justify-between gap-5 max-lg:flex-col max-lg:items-start">
          <div>
            <p className="mb-1 text-[12px] font-black uppercase tracking-[0.08em] text-[var(--color-brand-blue)]">Dashboard Argos ERP</p>
            <h1 className="text-[24px] font-bold text-[var(--gray-800)]">Hola, {user?.nombre || "Usuario"}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--gray-500)]">
              Selecciona la vista operativa disponible para tus roles. Los datos se actualizan automaticamente cada minuto.
            </p>
          </div>
          <div className="rounded-full border border-[var(--gray-200)] bg-[var(--gray-50)] px-3 py-1.5 text-[12px] font-bold text-[var(--gray-500)]">
            {user?.roles?.join(" + ") || user?.role || "Personal"}
          </div>
        </div>
      </div>

      {activeDashboard === "admin" && activeSection && <AdminDashboard section={activeSection} tabs={tabs} />}
      {activeDashboard === "reception" && activeSection && <ReceptionDashboard section={activeSection} tabs={tabs} />}
      {activeDashboard === "technician" && activeSection && <TechnicianDashboard section={activeSection} tabs={tabs} />}
      {activeDashboard === "warehouse" && activeSection && <WarehouseDashboard section={activeSection} tabs={tabs} />}
    </div>
  );
};

export default DashboardPage;
