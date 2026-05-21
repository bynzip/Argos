import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  FileText,
  Plus,
  Save,
  Send,
  ShieldCheck,
  Ticket as TicketIcon,
  XCircle,
} from 'lucide-react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { PaymentDetailsModal } from '../../components/finance/PaymentDetailsModal';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Label } from '../../components/ui/Label';
import { PageHeader } from '../../components/ui/PageHeader';
import { Select } from '../../components/ui/Select';
import { Textarea } from '../../components/ui/Textarea';
import { getApiErrorMessage } from '../../lib/apiErrors';
import { useCustomer, useCustomers, PaginatedResponse as CustomerPaginated } from '../../hooks/useCustomers';
import { useProducts, Product, PaginatedResponse as ProductPaginated } from '../../hooks/useProducts';
import {
  downloadQuotePdf,
  PaginatedResponse,
  QuoteLine,
  useApproveAmountQuote,
  useApproveQuote,
  useConvertQuoteToTicket,
  useCreateQuote,
  useCreateQuoteVersion,
  useQuote,
  useRejectAmountQuote,
  useRejectQuote,
  useSendQuote,
  useServices,
  Service,
  useUpdateQuote,
} from '../../hooks/useQuotes';
import { useTicket } from '../../hooks/useTickets';
import { useAuthStore } from '../../store/authStore';

const createEmptyLine = (): QuoteLine => ({
  line_type: 'PRODUCT',
  product: null,
  service: null,
  descripcion: '',
  cantidad: '1',
  precio_unitario: '0',
  descuento_linea: '0',
  supply_status: 'NOT_APPLICABLE',
  orden: 0,
});

const normalizeQuantityForInput = (value: string | number) => {
  const numeric = Number(value);
  if (Number.isFinite(numeric) && Number.isInteger(numeric)) {
    return String(numeric);
  }
  return String(value);
};

const money = (value: string | number | null | undefined) => {
  const numeric = Number.parseFloat(String(value ?? 0));
  return Number.isFinite(numeric) ? numeric : 0;
};

export default function QuoteEditorPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const ticketId = searchParams.get('ticketId');
  const isEditing = !!id;
  const { user } = useAuthStore();

  const { data: quote, isLoading } = useQuote(id || null);
  const { data: ticket } = useTicket(ticketId || '');
  const { data: customerResponse } = useCustomers({ page_size: 100 });
  const { data: productsResponse } = useProducts({ page_size: 100 });
  const { data: servicesResponse } = useServices({ page_size: 100 });

  const createQuote = useCreateQuote();
  const updateQuote = useUpdateQuote(id || '');
  const sendQuote = useSendQuote();
  const approveQuote = useApproveQuote();
  const rejectQuote = useRejectQuote();
  const createVersion = useCreateQuoteVersion();
  const convertToTicket = useConvertQuoteToTicket();
  const approveAmount = useApproveAmountQuote();
  const rejectAmount = useRejectAmountQuote();

  const customers = customerResponse && !Array.isArray(customerResponse) && 'results' in customerResponse
    ? (customerResponse as CustomerPaginated<any>).results
    : Array.isArray(customerResponse) ? customerResponse : [];
  const products = productsResponse && !Array.isArray(productsResponse) && 'results' in productsResponse
    ? (productsResponse as ProductPaginated<Product>).results
    : Array.isArray(productsResponse) ? productsResponse : [];
  const services = servicesResponse && !Array.isArray(servicesResponse) && 'results' in servicesResponse
    ? (servicesResponse as PaginatedResponse<Service>).results
    : Array.isArray(servicesResponse) ? servicesResponse : [];

  const [form, setForm] = useState({
    quote_type: 'REPAIR' as 'REPAIR' | 'DIRECT',
    customer: '',
    device: '',
    source_ticket: ticketId || '',
    descuento: '0',
    igv_rate: '18',
    valido_hasta: '',
    notas: '',
  });
  const [lines, setLines] = useState<QuoteLine[]>([createEmptyLine()]);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [amountNotes, setAmountNotes] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showPaymentDetails, setShowPaymentDetails] = useState(false);
  const [selectedVersionId, setSelectedVersionId] = useState('');

  const selectedCustomerId = form.customer ? parseInt(form.customer, 10) : null;
  const { data: selectedCustomerDetail } = useCustomer(selectedCustomerId);

  useEffect(() => {
    if (!ticket) return;
    setForm((prev) => ({
      ...prev,
      customer: String(ticket.customer?.id || ''),
      device: ticket.device?.id ? String(ticket.device.id) : '',
      source_ticket: ticket.id,
    }));
  }, [ticket]);

  useEffect(() => {
    if (!quote) return;
    setSelectedVersionId(String(quote.id));
    setForm({
      quote_type: quote.quote_type,
      customer: String(quote.customer.id),
      device: quote.device?.id ? String(quote.device.id) : '',
      source_ticket: quote.source_ticket?.id || '',
      descuento: quote.descuento,
      igv_rate: quote.igv_rate,
      valido_hasta: quote.valido_hasta || '',
      notas: quote.notas || '',
    });
    setLines(
      quote.lines.map((line, index) => ({
        ...line,
        cantidad: normalizeQuantityForInput(line.cantidad),
        precio_unitario: String(line.precio_unitario),
        descuento_linea: String(line.descuento_linea),
        orden: line.orden ?? index,
      })),
    );
    setAttachments([]);
  }, [quote]);

  const devices = selectedCustomerDetail?.devices || (ticket?.device ? [ticket.device] : []);
  const isDraft = !isEditing || quote?.estado === 'DRAFT';
  const isAdmin = user?.is_superuser || user?.role === 'Administrador';
  const isReceptionist = user?.role === 'Recepcionista';
  const hasCommercialActivity = (quote?.receipts?.length || 0) > 0 || (quote?.payment_schedules?.length || 0) > 0;
  const canEditDraft = isDraft && (!quote || (quote.is_active_version && !hasCommercialActivity));
  const canEditDiscounts = canEditDraft && !isReceptionist;
  const canCreateVersion = !!quote && quote.is_active_version && ['DRAFT', 'SENT', 'APPROVED', 'REJECTED'].includes(quote.estado) && !hasCommercialActivity;

  const totals = useMemo(() => {
    const subtotal = lines.reduce((acc, line) => {
      const qty = money(line.cantidad);
      const price = money(line.precio_unitario);
      const discount = money(line.descuento_linea);
      return acc + Math.max(0, (qty * price) - discount);
    }, 0);
    const descuento = money(form.descuento);
    const taxable = Math.max(0, subtotal - descuento);
    const igv = taxable * (money(form.igv_rate) / 100);
    return {
      subtotal,
      descuento,
      igv,
      total: taxable + igv,
    };
  }, [form.descuento, form.igv_rate, lines]);

  const summaryLines = useMemo(() => (
    lines.map((line, index) => {
      const selectedProduct = line.product ? products.find((item) => item.id === line.product) : null;
      const selectedService = line.service ? services.find((item) => item.id === line.service) : null;
      const label =
        line.descripcion?.trim() ||
        line.product_name ||
        line.service_name ||
        selectedProduct?.nombre ||
        selectedService?.nombre ||
        `${line.line_type === 'PRODUCT' ? 'Producto' : 'Servicio'} ${index + 1}`;

      const lineTotal = Math.max(0, (money(line.cantidad) * money(line.precio_unitario)) - money(line.descuento_linea));
      return {
        key: `${line.line_type}-${index}-${label}`,
        label,
        qty: normalizeQuantityForInput(line.cantidad),
        total: lineTotal,
      };
    })
  ), [lines, products, services]);

  const headerSubtitle = useMemo(() => {
    const sourceTicket = quote?.source_ticket || (ticket ? { id: ticket.id, folio: ticket.folio } : null);
    if (!sourceTicket) {
      return 'Centro comercial para precio, cuotas y cobro.';
    }

    return (
      <span>
        Ligada al ticket{' '}
        <Link to={`/tickets/${sourceTicket.id}`} className="font-semibold text-[var(--color-brand-blue)] hover:underline">
          {sourceTicket.folio}
        </Link>
      </span>
    );
  }, [quote?.source_ticket, ticket]);

  const latestApproval = useMemo(() => {
    if (!quote?.approvals?.length) return null;
    return [...quote.approvals].sort(
      (left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
    )[0];
  }, [quote?.approvals]);

  const isDirty = useMemo(() => {
    if (!quote) {
      return (
        form.customer !== '' ||
        form.device !== '' ||
        form.descuento !== '0' ||
        form.igv_rate !== '18' ||
        form.valido_hasta !== '' ||
        form.notas !== '' ||
        lines.length !== 1 ||
        lines[0]?.descripcion !== '' ||
        lines[0]?.cantidad !== '1' ||
        lines[0]?.precio_unitario !== '0' ||
        lines[0]?.descuento_linea !== '0' ||
        attachments.length > 0
      );
    }

    const currentState = JSON.stringify({
      form,
      lines: lines.map((line, index) => ({
        line_type: line.line_type,
        product: line.product || null,
        service: line.service || null,
        descripcion: line.descripcion || '',
        cantidad: normalizeQuantityForInput(line.cantidad),
        precio_unitario: String(line.precio_unitario),
        descuento_linea: String(line.descuento_linea),
        supply_status: line.supply_status || 'NOT_APPLICABLE',
        orden: line.orden ?? index,
      })),
      attachments: attachments.map((file) => file.name),
    });

    const originalState = JSON.stringify({
      form: {
        quote_type: quote.quote_type,
        customer: String(quote.customer.id),
        device: quote.device?.id ? String(quote.device.id) : '',
        source_ticket: quote.source_ticket?.id || '',
        descuento: quote.descuento,
        igv_rate: quote.igv_rate,
        valido_hasta: quote.valido_hasta || '',
        notas: quote.notas || '',
      },
      lines: quote.lines.map((line, index) => ({
        line_type: line.line_type,
        product: line.product || null,
        service: line.service || null,
        descripcion: line.descripcion || '',
        cantidad: normalizeQuantityForInput(line.cantidad),
        precio_unitario: String(line.precio_unitario),
        descuento_linea: String(line.descuento_linea),
        supply_status: line.supply_status || 'NOT_APPLICABLE',
        orden: line.orden ?? index,
      })),
      attachments: [],
    });

    return currentState !== originalState;
  }, [attachments, form, lines, quote]);

  const onSubmit = async () => {
    setSubmitError(null);
    if (form.quote_type === 'REPAIR' && !form.customer && !form.source_ticket) {
      setSubmitError('Debes seleccionar un cliente o partir desde un ticket para una cotizacion de reparacion.');
      return;
    }
    if (lines.length === 0) {
      setSubmitError('Debes agregar al menos una linea.');
      return;
    }
    if (lines.some((line) => !/^[1-9]\d*$/.test(String(line.cantidad || '').trim()))) {
      setSubmitError('Todas las lineas deben tener una cantidad entera positiva.');
      return;
    }

    const payload = {
      quote_type: form.quote_type,
      customer: form.customer ? parseInt(form.customer, 10) : null,
      device: form.device ? parseInt(form.device, 10) : null,
      source_ticket: form.source_ticket || null,
      descuento: form.descuento,
      igv_rate: form.igv_rate,
      valido_hasta: form.valido_hasta,
      notas: form.notas,
      lines: lines.map((line, index) => ({ ...line, orden: index })),
      attachments,
    };

    try {
      if (isEditing && quote) {
        await updateQuote.mutateAsync(payload);
      } else {
        const created = await createQuote.mutateAsync(payload);
        navigate(`/quotes/${created.id}`);
      }
    } catch (error: any) {
      setSubmitError(getApiErrorMessage(error, 'No se pudo guardar la cotizacion.'));
    }
  };

  if (isEditing && isLoading) {
    return <div className="p-12 text-center">Cargando cotizacion...</div>;
  }

  return (
    <div className="mx-auto max-w-[1480px] space-y-8 p-8">
      <Button variant="ghost" size="sm" onClick={() => navigate('/quotes')}>
        <ArrowLeft size={16} className="mr-2" />
        Volver a cotizaciones
      </Button>

      <PageHeader
        title={quote ? `${quote.folio} · v${quote.version}` : 'Nueva cotizacion'}
        subtitle={headerSubtitle}
        actions={(
          <div className="flex flex-wrap gap-2">
            {quote && (
              <Button variant="secondary" onClick={() => downloadQuotePdf(quote.id, quote.folio, quote.version)}>
                <FileText size={16} className="mr-2" />
                PDF
              </Button>
            )}
            {!isEditing && canEditDraft && (
              <Button variant="secondary" onClick={onSubmit} disabled={createQuote.isPending || updateQuote.isPending}>
                <Save size={16} className="mr-2" />
                {isEditing ? 'Guardar borrador' : 'Crear cotizacion'}
              </Button>
            )}
            {quote?.estado === 'APPROVED' && !quote.source_ticket && (
              <Button variant="secondary" onClick={() => convertToTicket.mutate(quote.id, { onSuccess: (data) => navigate(`/tickets/${data.ticket_id}`) })}>
                <TicketIcon size={16} className="mr-2" />
                Convertir a ticket
              </Button>
            )}
          </div>
        )}
      />

      {submitError && (
        <div className="rounded-xl border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] px-4 py-3 text-sm font-medium text-[var(--color-danger)]">
          {submitError}
        </div>
      )}

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-12">
        <div className="space-y-8 xl:col-span-8">
          <Card>
            <CardHeader className="px-6 py-4">
              <CardTitle>Datos generales</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 pt-4 md:grid-cols-2">
              <div>
                <Label>Tipo de cotizacion</Label>
                <Select
                  value={form.quote_type}
                  disabled={!!quote}
                  onChange={(event) => setForm((prev) => ({ ...prev, quote_type: event.target.value as 'REPAIR' | 'DIRECT' }))}
                >
                  <option value="REPAIR">Reparacion</option>
                  <option value="DIRECT">Directa</option>
                </Select>
              </div>
              <div>
                <Label>Cliente</Label>
                <Select
                  value={form.customer}
                  disabled={!!ticket || !!quote?.source_ticket}
                  onChange={(event) => setForm((prev) => ({ ...prev, customer: event.target.value, device: '' }))}
                >
                  <option value="">
                    {form.quote_type === 'DIRECT' ? 'Cliente generico del sistema' : 'Selecciona cliente...'}
                  </option>
                  {customers.map((customer: any) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.nombre} · {customer.identificador}
                    </option>
                  ))}
                </Select>
              </div>

              {(form.quote_type === 'REPAIR' || form.source_ticket) && (
                <div>
                  <Label>Dispositivo</Label>
                  <Select
                    value={form.device}
                    disabled={!!ticket || !!quote?.source_ticket}
                    onChange={(event) => setForm((prev) => ({ ...prev, device: event.target.value }))}
                  >
                    <option value="">Sin dispositivo</option>
                    {devices.map((device: any) => (
                      <option key={device.id} value={device.id}>
                        {device.marca} {device.modelo}
                      </option>
                    ))}
                  </Select>
                </div>
              )}

              <div>
                <Label>Valido hasta</Label>
                <Input type="date" value={form.valido_hasta} onChange={(event) => setForm((prev) => ({ ...prev, valido_hasta: event.target.value }))} />
              </div>
              <div>
                <Label>IGV (%)</Label>
                <Input type="number" step="0.01" value={form.igv_rate} onChange={(event) => setForm((prev) => ({ ...prev, igv_rate: event.target.value }))} />
              </div>
              <div>
                <Label>Descuento global</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.descuento}
                  disabled={!canEditDiscounts}
                  onChange={(event) => setForm((prev) => ({ ...prev, descuento: event.target.value }))}
                />
              </div>
              <div className="md:col-span-2">
                <Label>Notas</Label>
                <Textarea rows={3} value={form.notas} onChange={(event) => setForm((prev) => ({ ...prev, notas: event.target.value }))} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between px-6 py-4">
              <CardTitle>Lineas de cotizacion</CardTitle>
              {canEditDraft && (
                <Button variant="secondary" size="sm" onClick={() => setLines((prev) => [...prev, createEmptyLine()])}>
                  <Plus size={16} className="mr-2" />
                  Agregar linea
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              {lines.map((line, index) => (
                <div key={index} className="space-y-4 rounded-xl border border-[var(--gray-200)] p-4">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
                    <div>
                      <Label>Tipo</Label>
                      <Select
                        value={line.line_type}
                        disabled={!canEditDraft}
                        onChange={(event) => {
                          const next = [...lines];
                          next[index] = {
                            ...next[index],
                            line_type: event.target.value as 'PRODUCT' | 'SERVICE',
                            product: null,
                            service: null,
                          };
                          setLines(next);
                        }}
                      >
                        <option value="PRODUCT">Producto</option>
                        <option value="SERVICE">Servicio</option>
                      </Select>
                    </div>
                    <div className="md:col-span-2">
                      <Label>{line.line_type === 'PRODUCT' ? 'Producto' : 'Servicio'}</Label>
                      <Select
                        value={String(line.line_type === 'PRODUCT' ? line.product || '' : line.service || '')}
                        disabled={!canEditDraft}
                        onChange={(event) => {
                          const next = [...lines];
                          if (line.line_type === 'PRODUCT') {
                            const product = products.find((item) => item.id === parseInt(event.target.value, 10));
                            next[index] = {
                              ...next[index],
                              product: event.target.value ? parseInt(event.target.value, 10) : null,
                              descripcion: next[index].descripcion || product?.nombre || '',
                              precio_unitario: next[index].precio_unitario === '0' ? product?.precio_venta || '0' : next[index].precio_unitario,
                            };
                          } else {
                            const service = services.find((item) => item.id === parseInt(event.target.value, 10));
                            next[index] = {
                              ...next[index],
                              service: event.target.value ? parseInt(event.target.value, 10) : null,
                              descripcion: next[index].descripcion || service?.nombre || '',
                              precio_unitario: next[index].precio_unitario === '0' ? service?.precio_base || '0' : next[index].precio_unitario,
                            };
                          }
                          setLines(next);
                        }}
                      >
                        <option value="">Selecciona...</option>
                        {(line.line_type === 'PRODUCT' ? products : services).map((item: any) => (
                          <option key={item.id} value={item.id}>{item.nombre}</option>
                        ))}
                      </Select>
                    </div>
                    <div>
                      <Label>Cantidad</Label>
                      <Input
                        type="number"
                        step="1"
                        min="1"
                        value={line.cantidad}
                        disabled={!canEditDraft}
                        onChange={(event) => {
                          const next = [...lines];
                          next[index] = { ...next[index], cantidad: event.target.value };
                          setLines(next);
                        }}
                      />
                    </div>
                    <div>
                      <Label>P. unitario</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={line.precio_unitario}
                        disabled={!canEditDraft}
                        onChange={(event) => {
                          const next = [...lines];
                          next[index] = { ...next[index], precio_unitario: event.target.value };
                          setLines(next);
                        }}
                      />
                    </div>
                    <div>
                      <Label>Desc. linea</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={line.descuento_linea}
                        disabled={!canEditDiscounts}
                        onChange={(event) => {
                          const next = [...lines];
                          next[index] = { ...next[index], descuento_linea: event.target.value };
                          setLines(next);
                        }}
                      />
                    </div>
                    <div className="md:col-span-6">
                      <Label>Descripcion</Label>
                      <Textarea
                        rows={2}
                        value={line.descripcion}
                        disabled={!canEditDraft}
                        onChange={(event) => {
                          const next = [...lines];
                          next[index] = { ...next[index], descripcion: event.target.value };
                          setLines(next);
                        }}
                      />
                    </div>
                  </div>
                  {canEditDraft && lines.length > 1 && (
                    <div className="flex justify-end">
                      <Button variant="ghost" size="sm" onClick={() => setLines((prev) => prev.filter((_, lineIndex) => lineIndex !== index))}>
                        Quitar linea
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

        </div>

        <div className="space-y-8 xl:col-span-4">
          <Card>
              <CardHeader className="flex flex-row items-center justify-between px-6 py-3">
                <CardTitle>Versiones</CardTitle>
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-8 w-8 rounded-full p-0"
                  disabled={!canCreateVersion}
                  title={canCreateVersion ? 'Crear nueva version' : 'No se puede crear una nueva version en este estado'}
                  onClick={() => {
                    if (!quote || !canCreateVersion) return;
                    setSubmitError(null);
                    createVersion.mutate(quote.id, {
                      onSuccess: (next) => navigate(`/quotes/${next.id}`),
                      onError: (error) => setSubmitError(getApiErrorMessage(error, 'No se pudo crear una nueva version.')),
                    });
                  }}
                >
                  <Plus size={16} />
                </Button>
              </CardHeader>
              <CardContent className="pt-6">
              <Select
                value={selectedVersionId}
                onChange={(event) => {
                  setSelectedVersionId(event.target.value);
                  navigate(`/quotes/${event.target.value}`);
                }}
              >
                {(quote?.version_history || []).map((version) => (
                  <option key={version.id} value={version.id}>
                    v{version.version} · {version.estado}{version.is_active_version ? ' · Activa' : ''}
                  </option>
                ))}
              </Select>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="px-6 py-4">
              <CardTitle>Resumen comercial</CardTitle>
            </CardHeader>
              <CardContent className="space-y-4 pt-4">
                <div className="space-y-3">
                {summaryLines.map((line) => (
                  <div key={line.key} className="flex items-center justify-between gap-3 text-sm text-[var(--gray-700)]">
                    <div className="min-w-0 truncate">
                      {line.label} <span className="text-[var(--gray-500)]">({line.qty})</span>
                    </div>
                    <div className="shrink-0 font-semibold text-[var(--gray-800)]">S/ {line.total.toFixed(2)}</div>
                  </div>
                ))}
              </div>

              {totals.descuento > 0 && (
                <div className="flex justify-between text-sm text-[var(--gray-600)]">
                  <span>Descuento global</span>
                  <span className="font-semibold">- S/ {totals.descuento.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm text-[var(--gray-600)]">
                <span>IGV</span>
                <span className="font-semibold">S/ {totals.igv.toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-t border-[var(--gray-100)] pt-4">
                <span className="font-extrabold text-[var(--gray-800)]">Total</span>
                <span className="text-[22px] font-black text-[var(--color-brand-blue)]">S/ {totals.total.toFixed(2)}</span>
              </div>

              {quote && (
                <Button variant="secondary" className="w-full" onClick={() => setShowPaymentDetails(true)}>
                  <CreditCard size={16} className="mr-2" />
                  Detalles de pago
                </Button>
              )}

              {!quote && (
                <div className="rounded-xl border border-dashed border-[var(--gray-200)] bg-[var(--gray-50)] px-4 py-4 text-sm text-[var(--gray-500)]">
                  Guarda la cotizacion para habilitar cuotas, historial de pagos y cobros.
                </div>
              )}

              {quote?.requires_amount_approval && (
                <div className="rounded-lg border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] p-3 text-xs font-medium text-[var(--color-warning)]">
                  Esta cotizacion requiere aprobacion administrativa por monto.
                </div>
              )}
            </CardContent>
          </Card>

          {quote && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between px-6 py-4">
                <CardTitle>Estado actual</CardTitle>
                <div className="text-xs font-medium text-[var(--gray-500)]">
                  {new Date(quote.created_at).toLocaleDateString('es-PE')}
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pt-6">
                <div className="rounded-xl border border-[var(--gray-100)] bg-[var(--gray-50)] px-4 py-3">
                  <div className="font-semibold text-[var(--gray-800)]">{quote.estado}</div>
                </div>
                {(quote.estado === 'DRAFT' && quote.is_active_version) || quote.estado === 'SENT' ? (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {quote.estado === 'DRAFT' && quote.is_active_version && (
                      <Button
                        variant="secondary"
                        className="w-full"
                        onClick={onSubmit}
                        disabled={!isDirty || createQuote.isPending || updateQuote.isPending}
                        title={isDirty ? 'Guardar cambios del borrador' : 'No hay cambios para guardar'}
                      >
                        Guardar borrador
                      </Button>
                    )}
                    {quote.estado === 'DRAFT' && quote.is_active_version && (
                      <Button variant="secondary" className="w-full" onClick={() => sendQuote.mutate(quote.id)}>
                        <Send size={16} className="mr-2" />
                        Enviar
                      </Button>
                    )}
                    {quote.estado === 'SENT' && (
                      <>
                        <Button variant="secondary" className="w-full" onClick={() => approveQuote.mutate(quote.id)}>
                          <CheckCircle2 size={16} className="mr-2" />
                          Aprobar
                        </Button>
                        <Button variant="danger" className="w-full" onClick={() => rejectQuote.mutate({ id: quote.id, motivo: 'Cliente rechazo la cotizacion' })}>
                          <XCircle size={16} className="mr-2" />
                          Rechazar
                        </Button>
                      </>
                    )}
                  </div>
                ) : null}
                {latestApproval && (
                  <div className="rounded-xl border border-[var(--gray-100)] bg-[var(--gray-50)] px-4 py-3">
                    <div className="text-sm font-semibold text-[var(--gray-800)]">{latestApproval.estado}</div>
                    <div className="mt-1 text-xs text-[var(--gray-500)]">{new Date(latestApproval.created_at).toLocaleDateString('es-PE')}</div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {quote?.requires_amount_approval && isAdmin && quote.latest_amount_approval_status === 'PENDING' && (
            <Card>
              <CardHeader className="px-6 py-4">
                <CardTitle>Aprobacion administrativa</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea rows={3} value={amountNotes} onChange={(event) => setAmountNotes(event.target.value)} placeholder="Notas..." />
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => approveAmount.mutate({ id: quote.id, notas: amountNotes })}>
                    <ShieldCheck size={16} className="mr-2" />
                    Aprobar monto
                  </Button>
                  <Button variant="ghost" onClick={() => rejectAmount.mutate({ id: quote.id, notas: amountNotes })}>
                    <XCircle size={16} className="mr-2" />
                    Rechazar monto
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="px-6 py-4">
              <CardTitle>Adjuntos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <Input type="file" multiple disabled={!canEditDraft} onChange={(event) => setAttachments(Array.from(event.target.files || []))} />
              {quote?.attachments?.length ? (
                <div className="flex flex-wrap gap-2">
                  {quote.attachments.map((attachment) => (
                    <a key={attachment.id} href={attachment.archivo} target="_blank" rel="noreferrer" className="rounded-lg border border-[var(--gray-200)] bg-[var(--gray-50)] px-3 py-2 text-xs font-medium hover:border-[var(--gray-300)]">
                      {attachment.nombre_archivo}
                    </a>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>

      {quote && showPaymentDetails && (
        <PaymentDetailsModal quote={quote} onClose={() => setShowPaymentDetails(false)} isAdmin={isAdmin} />
      )}
    </div>
  );
}
