import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, FileText, Plus, Save, Send, ShieldCheck, Ticket as TicketIcon, XCircle } from 'lucide-react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Label } from '../../components/ui/Label';
import { PageHeader } from '../../components/ui/PageHeader';
import { Select } from '../../components/ui/Select';
import { Textarea } from '../../components/ui/Textarea';
import { useCustomers, PaginatedResponse as CustomerPaginated } from '../../hooks/useCustomers';
import { useProducts, Product, PaginatedResponse as ProductPaginated } from '../../hooks/useProducts';
import {
  downloadQuotePdf,
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
  useServiceCategories,
  useServices,
  Service,
  PaginatedResponse,
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
  const { data: serviceCategories = [] } = useServiceCategories();

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
    customer: '',
    device: '',
    source_ticket: ticketId || '',
    descuento: '0',
    igv_rate: '18',
    valido_hasta: '',
    condiciones: '',
    notas: '',
  });
  const [lines, setLines] = useState<QuoteLine[]>([createEmptyLine()]);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [rejectReason, setRejectReason] = useState('');
  const [amountNotes, setAmountNotes] = useState('');

  useEffect(() => {
    if (ticket) {
      setForm((prev) => ({
        ...prev,
        customer: String(ticket.customer?.id || ''),
        device: ticket.device?.id ? String(ticket.device.id) : '',
        source_ticket: ticket.id,
      }));
    }
  }, [ticket]);

  useEffect(() => {
    if (quote) {
      setForm({
        customer: String(quote.customer.id),
        device: quote.device?.id ? String(quote.device.id) : '',
        source_ticket: quote.source_ticket?.id || '',
        descuento: quote.descuento,
        igv_rate: quote.igv_rate,
        valido_hasta: quote.valido_hasta || '',
        condiciones: quote.condiciones || '',
        notas: quote.notas || '',
      });
      setLines(
        quote.lines.map((line, index) => ({
          ...line,
          cantidad: String(line.cantidad),
          precio_unitario: String(line.precio_unitario),
          descuento_linea: String(line.descuento_linea),
          orden: line.orden ?? index,
        }))
      );
    }
  }, [quote]);

  const selectedCustomer = useMemo(
    () => customers.find((customer: any) => String(customer.id) === form.customer),
    [customers, form.customer]
  );
  const devices = selectedCustomer?.devices || (ticket?.device ? [ticket.device] : []);
  const isDraft = !isEditing || quote?.estado === 'DRAFT';
  const isAdmin = user?.is_superuser || user?.role === 'Administrador';

  const totals = useMemo(() => {
    const subtotal = lines.reduce((acc, line) => {
      const qty = parseFloat(line.cantidad || '0');
      const price = parseFloat(line.precio_unitario || '0');
      const discount = parseFloat(line.descuento_linea || '0');
      return acc + Math.max(0, (qty * price) - discount);
    }, 0);
    const descuento = parseFloat(form.descuento || '0');
    const taxable = Math.max(0, subtotal - descuento);
    const igv = taxable * (parseFloat(form.igv_rate || '0') / 100);
    return {
      subtotal,
      descuento,
      igv,
      total: taxable + igv,
    };
  }, [lines, form.descuento, form.igv_rate]);

  const onSubmit = async () => {
    const payload = {
      customer: parseInt(form.customer),
      device: form.device ? parseInt(form.device) : null,
      source_ticket: form.source_ticket || null,
      descuento: form.descuento,
      igv_rate: form.igv_rate,
      valido_hasta: form.valido_hasta,
      condiciones: form.condiciones,
      notas: form.notas,
      lines: lines.map((line, index) => ({
        ...line,
        orden: index,
      })),
      attachments,
    };

    if (isEditing && quote) {
      await updateQuote.mutateAsync(payload);
    } else {
      const created = await createQuote.mutateAsync(payload);
      navigate(`/quotes/${created.id}`);
    }
  };

  if (isEditing && isLoading) {
    return <div className="p-12 text-center">Cargando cotización...</div>;
  }

  return (
    <div className="p-8 max-w-[1400px] mx-auto space-y-8">
      <Button variant="ghost" size="sm" onClick={() => navigate('/quotes')}>
        <ArrowLeft size={16} className="mr-2" />
        Volver a cotizaciones
      </Button>

      <PageHeader
        title={quote ? `${quote.folio} · v${quote.version}` : 'Nueva cotización'}
        subtitle={quote?.source_ticket ? `Ligada al ticket ${quote.source_ticket.folio}` : 'Cotización directa o ligada a ticket.'}
        actions={(
          <div className="flex flex-wrap gap-2">
            {quote && quote.source_ticket && (
              <Button variant="secondary" onClick={() => navigate(`/tickets/${quote.source_ticket?.id}`)}>
                <TicketIcon size={16} className="mr-2" />
                Ver ticket
              </Button>
            )}
            {quote && (
              <Button
                variant="secondary"
                onClick={() => downloadQuotePdf(quote.id, quote.folio, quote.version)}
              >
                <FileText size={16} className="mr-2" />
                Descargar PDF
              </Button>
            )}
            {isDraft && (
              <Button onClick={onSubmit} disabled={createQuote.isPending || updateQuote.isPending}>
                <Save size={16} className="mr-2" />
                {isEditing ? 'Guardar borrador' : 'Crear cotización'}
              </Button>
            )}
            {quote?.estado === 'DRAFT' && (
              <Button variant="secondary" onClick={() => sendQuote.mutate(quote.id)}>
                <Send size={16} className="mr-2" />
                Marcar enviada
              </Button>
            )}
            {quote?.estado === 'SENT' && (
              <>
                <Button variant="secondary" onClick={() => approveQuote.mutate(quote.id)}>
                  <CheckCircle2 size={16} className="mr-2" />
                  Aprobar
                </Button>
                <Button variant="ghost" onClick={() => rejectQuote.mutate({ id: quote.id, motivo: rejectReason || 'Cliente rechazó la cotización' })}>
                  <XCircle size={16} className="mr-2" />
                  Rechazar
                </Button>
              </>
            )}
            {quote && quote.is_active_version && ['DRAFT', 'SENT', 'APPROVED'].includes(quote.estado) && (
              <Button variant="ghost" onClick={() => createVersion.mutate(quote.id, { onSuccess: (next) => navigate(`/quotes/${next.id}`) })}>
                <Plus size={16} className="mr-2" />
                Nueva versión
              </Button>
            )}
            {quote?.estado === 'APPROVED' && !quote.source_ticket && (
              <Button variant="secondary" onClick={() => convertToTicket.mutate(quote.id, { onSuccess: (data) => navigate(`/tickets/${data.ticket_id}`) })}>
                <TicketIcon size={16} className="mr-2" />
                Convertir en ticket
              </Button>
            )}
          </div>
        )}
      />

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        <div className="xl:col-span-8 space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Datos generales</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Cliente</Label>
                <Select
                  value={form.customer}
                  disabled={!!ticket || !!quote?.source_ticket}
                  onChange={(e) => setForm((prev) => ({ ...prev, customer: e.target.value, device: '' }))}
                >
                  <option value="">Selecciona cliente...</option>
                  {customers.map((customer: any) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.nombre} · {customer.identificador}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Dispositivo</Label>
                <Select
                  value={form.device}
                  disabled={!!ticket || !!quote?.source_ticket}
                  onChange={(e) => setForm((prev) => ({ ...prev, device: e.target.value }))}
                >
                  <option value="">Sin dispositivo</option>
                  {devices.map((device: any) => (
                    <option key={device.id} value={device.id}>
                      {device.marca} {device.modelo}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Válido hasta</Label>
                <Input type="date" value={form.valido_hasta} onChange={(e) => setForm((prev) => ({ ...prev, valido_hasta: e.target.value }))} />
              </div>
              <div>
                <Label>IGV (%)</Label>
                <Input type="number" step="0.01" value={form.igv_rate} onChange={(e) => setForm((prev) => ({ ...prev, igv_rate: e.target.value }))} />
              </div>
              <div className="md:col-span-2">
                <Label>Condiciones</Label>
                <Textarea rows={3} value={form.condiciones} onChange={(e) => setForm((prev) => ({ ...prev, condiciones: e.target.value }))} />
              </div>
              <div className="md:col-span-2">
                <Label>Notas internas</Label>
                <Textarea rows={3} value={form.notas} onChange={(e) => setForm((prev) => ({ ...prev, notas: e.target.value }))} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Líneas de cotización</CardTitle>
              {isDraft && (
                <Button variant="secondary" size="sm" onClick={() => setLines((prev) => [...prev, createEmptyLine()])}>
                  <Plus size={16} className="mr-2" />
                  Agregar línea
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {lines.map((line, index) => (
                <div key={index} className="border border-[var(--gray-200)] rounded-xl p-4 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                    <div>
                      <Label>Tipo</Label>
                      <Select
                        value={line.line_type}
                        disabled={!isDraft}
                        onChange={(e) => {
                          const next = [...lines];
                          next[index] = {
                            ...next[index],
                            line_type: e.target.value as 'PRODUCT' | 'SERVICE',
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
                        disabled={!isDraft}
                        onChange={(e) => {
                          const next = [...lines];
                          if (line.line_type === 'PRODUCT') {
                            const product = products.find((item) => item.id === parseInt(e.target.value));
                            next[index] = {
                              ...next[index],
                              product: e.target.value ? parseInt(e.target.value) : null,
                              descripcion: next[index].descripcion || product?.nombre || '',
                              precio_unitario: next[index].precio_unitario === '0' ? product?.precio_venta || '0' : next[index].precio_unitario,
                            };
                          } else {
                            const service = services.find((item) => item.id === parseInt(e.target.value));
                            next[index] = {
                              ...next[index],
                              service: e.target.value ? parseInt(e.target.value) : null,
                              descripcion: next[index].descripcion || service?.nombre || '',
                              precio_unitario: next[index].precio_unitario === '0' ? service?.precio_base || '0' : next[index].precio_unitario,
                            };
                          }
                          setLines(next);
                        }}
                      >
                        <option value="">Selecciona...</option>
                        {(line.line_type === 'PRODUCT' ? products : services).map((item: any) => (
                          <option key={item.id} value={item.id}>
                            {item.nombre}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div>
                      <Label>Cantidad</Label>
                      <Input
                        type="number"
                        step="0.001"
                        value={line.cantidad}
                        disabled={!isDraft}
                        onChange={(e) => {
                          const next = [...lines];
                          next[index] = { ...next[index], cantidad: e.target.value };
                          setLines(next);
                        }}
                      />
                    </div>
                    <div>
                      <Label>P. Unitario</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={line.precio_unitario}
                        disabled={!isDraft}
                        onChange={(e) => {
                          const next = [...lines];
                          next[index] = { ...next[index], precio_unitario: e.target.value };
                          setLines(next);
                        }}
                      />
                    </div>
                    <div>
                      <Label>Desc. línea</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={line.descuento_linea}
                        disabled={!isDraft}
                        onChange={(e) => {
                          const next = [...lines];
                          next[index] = { ...next[index], descuento_linea: e.target.value };
                          setLines(next);
                        }}
                      />
                    </div>
                    <div className="md:col-span-6">
                      <Label>Descripción</Label>
                      <Textarea
                        rows={2}
                        value={line.descripcion}
                        disabled={!isDraft}
                        onChange={(e) => {
                          const next = [...lines];
                          next[index] = { ...next[index], descripcion: e.target.value };
                          setLines(next);
                        }}
                      />
                    </div>
                  </div>
                  {isDraft && lines.length > 1 && (
                    <div className="flex justify-end">
                      <Button variant="ghost" size="sm" onClick={() => setLines((prev) => prev.filter((_, lineIndex) => lineIndex !== index))}>
                        Quitar línea
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Adjuntos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                type="file"
                multiple
                disabled={!isDraft}
                onChange={(e) => setAttachments(Array.from(e.target.files || []))}
              />
              {quote?.attachments?.length ? (
                <div className="flex flex-wrap gap-2">
                  {quote.attachments.map((attachment) => (
                    <a
                      key={attachment.id}
                      href={attachment.archivo}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[12px] font-medium px-3 py-2 rounded-lg border border-[var(--gray-200)] bg-[var(--gray-50)]"
                    >
                      {attachment.nombre_archivo}
                    </a>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <div className="xl:col-span-4 space-y-8">
          <Card>
            <CardHeader className="flex flex-row items-center gap-2">
              <FileText size={18} className="text-[var(--gray-400)]" />
              <CardTitle>Resumen</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between text-sm">
                <span>Subtotal</span>
                <span className="font-bold">S/ {totals.subtotal.toFixed(2)}</span>
              </div>
              <div>
                <Label>Descuento global</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.descuento}
                  disabled={!isDraft}
                  onChange={(e) => setForm((prev) => ({ ...prev, descuento: e.target.value }))}
                />
              </div>
              <div className="flex justify-between text-sm">
                <span>IGV</span>
                <span className="font-bold">S/ {totals.igv.toFixed(2)}</span>
              </div>
              <div className="pt-4 border-t border-[var(--gray-100)] flex justify-between">
                <span className="font-extrabold">Total</span>
                <span className="font-black text-[22px] text-[var(--color-brand-blue)]">S/ {totals.total.toFixed(2)}</span>
              </div>
              {quote?.requires_amount_approval && (
                <div className="p-3 rounded-lg border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] text-[12px] text-[var(--color-warning)] font-medium">
                  Esta cotización supera el umbral y requiere aprobación administrativa antes de enviarse.
                </div>
              )}
            </CardContent>
          </Card>

          {quote && (
            <Card>
              <CardHeader>
                <CardTitle>Control interno</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm">
                  <span className="text-[var(--gray-500)]">Estado:</span>{' '}
                  <span className="font-bold">{quote.estado}</span>
                </div>
                <div className="text-sm">
                  <span className="text-[var(--gray-500)]">Aprobación por monto:</span>{' '}
                  <span className="font-bold">{quote.latest_amount_approval_status || 'No requerida'}</span>
                </div>
                {quote.requires_amount_approval && isAdmin && quote.latest_amount_approval_status === 'PENDING' && (
                  <div className="space-y-3">
                    <Textarea
                      rows={3}
                      value={amountNotes}
                      onChange={(e) => setAmountNotes(e.target.value)}
                      placeholder="Notas de aprobación o rechazo..."
                    />
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
                  </div>
                )}

                {quote.estado === 'SENT' && (
                  <div>
                    <Label>Motivo de rechazo</Label>
                    <Textarea rows={3} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {quote?.version_history?.length ? (
            <Card>
              <CardHeader>
                <CardTitle>Versiones</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {quote.version_history.map((item) => (
                  <Link
                    key={item.id}
                    to={`/quotes/${item.id}`}
                    className="flex items-center justify-between rounded-lg border border-[var(--gray-200)] px-3 py-2 hover:bg-[var(--gray-50)]"
                  >
                    <span className="font-medium">v{item.version}</span>
                    <span className="text-[12px] text-[var(--gray-500)]">{item.estado}</span>
                  </Link>
                ))}
              </CardContent>
            </Card>
          ) : null}

          {serviceCategories.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Categorías de servicio</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {serviceCategories.map((category) => (
                  <span key={category.id} className="px-3 py-1 rounded-full text-[12px] font-medium bg-[var(--gray-50)] border border-[var(--gray-200)]">
                    {category.nombre}
                  </span>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
