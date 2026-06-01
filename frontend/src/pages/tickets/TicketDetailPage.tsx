import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  ClipboardList,
  CreditCard,
  FileDown,
  Files,
  History,
  Plus,
  Save,
  ShieldAlert,
  Trash2,
  Upload,
  X,
} from 'lucide-react';

import { PaymentDetailsModal } from '../../components/finance/PaymentDetailsModal';
import { QuickAmountModal } from '../../components/tickets/QuickAmountModal';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { getApiErrorMessage, resolveMediaUrl } from '../../lib/apiErrors';
import { PageHeader } from '../../components/ui/PageHeader';
import { PriorityBadge } from '../../components/ui/PriorityBadge';
import { Select } from '../../components/ui/Select';
import { Textarea } from '../../components/ui/Textarea';
import { TicketStatusBadge } from '../../components/ui/TicketStatusBadge';
import { useQuote } from '../../hooks/useQuotes';
import {
  downloadTicketGuiaInternamientoPdf,
  useAddChecklistItem,
  useApplyChecklistTemplate,
  useChecklistTemplates,
  useCreateChecklistTemplate,
  useDeleteChecklistItem,
  useTicket,
  useTicketTransition,
  useUpdateChecklistItem,
  useUpdateTechnicalDetails,
} from '../../hooks/useTickets';
import { useAuthStore } from '../../store/authStore';

const VALID_TRANSITIONS: Record<string, string[]> = {
  INTAKE: ['DIAGNOSTIC'],
  DIAGNOSTIC: ['IN_REPAIR'],
  APPROVED: ['WAITING_PARTS', 'IN_REPAIR'],
  WAITING_PARTS: ['IN_REPAIR'],
  IN_REPAIR: ['IN_TESTING', 'DIAGNOSTIC'],
  IN_TESTING: ['READY'],
  READY: ['DELIVERED', 'STORAGE'],
  STORAGE: ['DELIVERED'],
  DELIVERED: ['CLOSED'],
};

const statusLabels: Record<string, string> = {
  INTAKE: 'Ingreso',
  DIAGNOSTIC: 'Diagnostico',
  QUOTED: 'Cotizado',
  APPROVED: 'Aprobado',
  WAITING_PARTS: 'Espera repuestos',
  IN_REPAIR: 'En reparacion',
  IN_TESTING: 'En pruebas',
  READY: 'Listo',
  DELIVERED: 'Entregado',
  CLOSED: 'Cerrado',
  REJECTED: 'Rechazado',
  STORAGE: 'Cochera',
};

const money = (value: string | number | null | undefined) => {
  const parsed = Number.parseFloat(String(value ?? 0));
  return Number.isFinite(parsed) ? parsed : 0;
};

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { data: ticket, isLoading, refetch } = useTicket(id || '');
  const { data: checklistTemplates = [] } = useChecklistTemplates();
  const activeQuoteId = ticket?.active_quote?.id ? String(ticket.active_quote.id) : null;
  const { data: activeQuote } = useQuote(activeQuoteId);

  const transitionMutation = useTicketTransition();
  const updateTechnicalDetailsMutation = useUpdateTechnicalDetails();
  const addChecklistItemMutation = useAddChecklistItem();
  const updateChecklistItemMutation = useUpdateChecklistItem();
  const deleteChecklistItemMutation = useDeleteChecklistItem();
  const applyChecklistTemplateMutation = useApplyChecklistTemplate();
  const createChecklistTemplateMutation = useCreateChecklistTemplate();

  const [diagnosticoInput, setDiagnosticoInput] = useState('');
  const [solucionInput, setSolucionInput] = useState('');
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [checklistFiles, setChecklistFiles] = useState<Record<number, File[]>>({});
  const [checklistFeedback, setChecklistFeedback] = useState<string | null>(null);
  const [technicalSaved, setTechnicalSaved] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [newTemplateName, setNewTemplateName] = useState('');
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [showTemplateSaver, setShowTemplateSaver] = useState(false);
  const [showPaymentDetails, setShowPaymentDetails] = useState(false);
  const [showQuickAmountModal, setShowQuickAmountModal] = useState(false);
  const [isDownloadingGuide, setIsDownloadingGuide] = useState(false);
  const [guideDownloadError, setGuideDownloadError] = useState<string | null>(null);

  const isTech = user?.role === 'TÃ©cnico' || user?.role === 'Tecnico' || user?.is_superuser;
  const isAdmin = user?.role === 'Administrador' || user?.is_superuser;

  useEffect(() => {
    const interval = setInterval(() => refetch(), 15000);
    return () => clearInterval(interval);
  }, [refetch]);

  useEffect(() => {
    if (!ticket) return;
    setDiagnosticoInput(ticket.diagnostico || '');
    setSolucionInput(ticket.solucion || '');
    setTechnicalSaved(false);
  }, [ticket]);

  const currentChecklistPreview = useMemo(
    () => (ticket?.checklist_items || []).map((item: any) => item.nombre),
    [ticket?.checklist_items],
  );

  if (isLoading) return <div className="p-12 text-center">Cargando ticket...</div>;
  if (!ticket) return <div className="p-12 text-center">Ticket no encontrado.</div>;

  const receiptList = (activeQuote?.receipts || (ticket as any).receipts || []) as Array<any>;
  const pagosConfirmados = receiptList
    .filter((receipt: any) => receipt.estado === 'CONFIRMED')
    .reduce((acc: number, receipt: any) => acc + money(receipt.amount), 0);
  const total = money(activeQuote?.total || ticket.active_quote?.total || ticket.total || '0');
  const saldoPendiente = activeQuote ? money(activeQuote.saldo_pendiente) : Math.max(0, total - pagosConfirmados);
  const canAssignQuickAmount = !ticket.has_linked_quote;
  const allowedNextStatuses = VALID_TRANSITIONS[ticket.estado] || [];
  const hasTechnicalChanges = diagnosticoInput !== (ticket.diagnostico || '') || solucionInput !== (ticket.solucion || '');
  const orderedTransitions = [...(ticket.transitions || [])].sort(
    (left: any, right: any) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
  );
  const selectedTemplate = checklistTemplates.find((template: any) => String(template.id) === selectedTemplateId);

  const handleTransition = (newStatus: string) => {
    transitionMutation.mutate(
      { id: ticket.id, newStatus },
      {
        onSuccess: () => refetch(),
        onError: (error: any) => alert(error?.response?.data?.detail || 'No se pudo transicionar el ticket.'),
      },
    );
  };

  const handleDownloadGuide = async () => {
    setIsDownloadingGuide(true);
    setGuideDownloadError(null);
    try {
      await downloadTicketGuiaInternamientoPdf(ticket.id, ticket.folio);
    } catch (error) {
      setGuideDownloadError(getApiErrorMessage(error, 'No se pudo descargar la guia.'));
    } finally {
      setIsDownloadingGuide(false);
    }
  };

  const handleSaveTechnicalDetails = () => {
    updateTechnicalDetailsMutation.mutate(
      { id: ticket.id, diagnostico: diagnosticoInput, solucion: solucionInput },
      {
        onSuccess: () => {
          setTechnicalSaved(true);
          refetch();
        },
      },
    );
  };

  const handleAddChecklist = () => {
    if (!newChecklistItem.trim()) return;
    const data = new FormData();
    data.append('nombre', newChecklistItem.trim());
    data.append('requerido', 'true');
    addChecklistItemMutation.mutate(
      { ticketId: ticket.id, data },
      {
        onSuccess: () => {
          setNewChecklistItem('');
          refetch();
        },
      },
    );
  };

  const handleToggleChecklist = (item: any) => {
    const data = new FormData();
    data.append('completado', String(!item.completado));
    (checklistFiles[item.id] || []).forEach((file) => data.append('evidences', file));
    updateChecklistItemMutation.mutate(
      {
        ticketId: ticket.id,
        checklistId: item.id,
        data,
      },
      {
        onSuccess: () => {
          setChecklistFeedback(null);
          setChecklistFiles((prev) => ({ ...prev, [item.id]: [] }));
          refetch();
        },
        onError: (error: any) => setChecklistFeedback(getApiErrorMessage(error, 'No se pudo actualizar el checklist.')),
      },
    );
  };

  const handleDeleteChecklist = (item: any) => {
    deleteChecklistItemMutation.mutate(
      { ticketId: ticket.id, checklistId: item.id },
      {
        onSuccess: () => {
          setChecklistFeedback(null);
          setChecklistFiles((prev) => {
            const next = { ...prev };
            delete next[item.id];
            return next;
          });
          refetch();
        },
        onError: (error: any) => setChecklistFeedback(getApiErrorMessage(error, 'No se pudo eliminar el item del checklist.')),
      },
    );
  };

  const closeChecklistPanels = () => {
    setShowTemplatePicker(false);
    setShowTemplateSaver(false);
  };

  return (
    <div className="mx-auto max-w-[1400px] space-y-8 p-8">
      <Button variant="ghost" size="sm" onClick={() => navigate('/tickets')}>
        <ArrowLeft size={16} className="mr-2" />
        Volver
      </Button>

      <PageHeader
        title={ticket.folio}
        subtitle={`Creado el ${new Date(ticket.created_at).toLocaleString()}`}
        actions={(
          <div className="flex flex-col items-start gap-3 sm:items-end">
            <div className="flex flex-wrap gap-2">
              <TicketStatusBadge status={ticket.estado} />
              <PriorityBadge priority={ticket.prioridad} />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={handleDownloadGuide} disabled={isDownloadingGuide}>
                <FileDown size={16} className="mr-1" />
                {isDownloadingGuide ? 'Descargando...' : 'Descargar guia'}
              </Button>
              {allowedNextStatuses.map((status) => (
                <Button key={status} variant="secondary" size="sm" onClick={() => handleTransition(status)}>
                  {statusLabels[status] || status}
                </Button>
              ))}
            </div>
            {guideDownloadError && (
              <div className="max-w-xs text-right text-xs font-medium text-[var(--color-danger)]">
                {guideDownloadError}
              </div>
            )}
          </div>
        )}
      />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="space-y-8 lg:col-span-8">
          <Card>
            <CardHeader className="px-6 py-4">
              <CardTitle>Problema reportado</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5 pt-6">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-[var(--gray-100)] bg-[var(--gray-50)] px-4 py-3">
                  <div className="mb-1 text-[11px] font-bold uppercase text-[var(--gray-400)]">Cliente</div>
                  {ticket.customer ? (
                    <>
                      <Link to={`/customers/${ticket.customer.id}`} className="font-semibold text-[var(--gray-800)] hover:text-[var(--color-brand-blue)]">
                        {ticket.customer.nombre}
                      </Link>
                      <div className="truncate text-xs text-[var(--gray-500)]">{ticket.customer.identificador}</div>
                    </>
                  ) : (
                    <div className="text-sm text-[var(--gray-500)]">Sin cliente asociado</div>
                  )}
                </div>

                <div className="rounded-xl border border-[var(--gray-100)] bg-[var(--gray-50)] px-4 py-3">
                  <div className="mb-1 text-[11px] font-bold uppercase text-[var(--gray-400)]">Equipo</div>
                  <div className="font-semibold text-[var(--gray-800)]">
                    {ticket.device ? `${ticket.device.marca} ${ticket.device.modelo}` : 'No registrado'}
                  </div>
                  <div className="truncate text-xs text-[var(--gray-500)]">{ticket.device?.numero_serie || 'Sin serie registrada'}</div>
                </div>

                <div className="rounded-xl border border-[var(--gray-100)] bg-[var(--gray-50)] px-4 py-3">
                  <div className="mb-1 text-[11px] font-bold uppercase text-[var(--gray-400)]">Cotizacion</div>
                  {ticket.active_quote ? (
                    <>
                      <Link to={`/quotes/${ticket.active_quote.id}`} className="font-semibold text-[var(--color-brand-blue)] hover:underline">
                        {ticket.active_quote.folio}
                      </Link>
                      <div className="truncate text-xs text-[var(--gray-500)]">{ticket.active_quote.estado}</div>
                    </>
                  ) : (
                    <div className="text-sm text-[var(--gray-500)]">No hay cotizacion asociada</div>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-[var(--gray-100)] bg-[var(--gray-50)] p-4">
                <div className="mb-2 text-[12px] font-bold uppercase text-[var(--gray-400)]">Problema detectado</div>
                <p className="whitespace-pre-wrap text-[15px] text-[var(--gray-700)]">{ticket.descripcion_problema}</p>
              </div>
            </CardContent>
          </Card>

          {(ticket.evidences || []).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Evidencias del ticket</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                  {(ticket.evidences || []).map((evidence: any) => (
                    <a key={evidence.id} href={resolveMediaUrl(evidence.archivo)} target="_blank" rel="noreferrer" className="overflow-hidden rounded-xl border border-[var(--gray-200)] bg-[var(--gray-50)]">
                      <img src={resolveMediaUrl(evidence.archivo)} alt={evidence.nombre_archivo || 'Evidencia'} className="h-28 w-full object-cover" />
                      <div className="truncate px-3 py-2 text-xs text-[var(--gray-600)]">{evidence.nombre_archivo || 'Evidencia'}</div>
                    </a>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3 px-6 py-4">
              <CardTitle>Diagnostico y solucion</CardTitle>
              {(isTech || isAdmin) && (
                <button
                  type="button"
                  title={
                    updateTechnicalDetailsMutation.isPending
                      ? 'Guardando cambios...'
                      : technicalSaved && !hasTechnicalChanges
                        ? 'Detalles guardados'
                        : hasTechnicalChanges
                          ? 'Guardar cambios del diagnostico y la solucion'
                          : 'No hay cambios por guardar'
                  }
                  onClick={handleSaveTechnicalDetails}
                  disabled={updateTechnicalDetailsMutation.isPending || !hasTechnicalChanges}
                  className={`flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border transition-colors ${
                    hasTechnicalChanges
                      ? 'border-[var(--color-brand-blue)] bg-[var(--color-info-bg)] text-[var(--color-brand-blue)]'
                      : 'border-[var(--gray-200)] bg-white text-[var(--gray-300)]'
                  }`}
                >
                  <Save size={16} />
                </button>
              )}
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div>
                <div className="mb-2 text-[12px] font-bold uppercase text-[var(--gray-400)]">Diagnostico</div>
                {(isTech || isAdmin)
                  ? <Textarea rows={4} value={diagnosticoInput} onChange={(event) => setDiagnosticoInput(event.target.value)} />
                  : <div className="rounded-xl border border-[var(--gray-100)] bg-[var(--gray-50)] p-4">{ticket.diagnostico || 'Pendiente.'}</div>}
              </div>
              <div>
                <div className="mb-2 text-[12px] font-bold uppercase text-[var(--gray-400)]">Solucion</div>
                {(isTech || isAdmin)
                  ? <Textarea rows={4} value={solucionInput} onChange={(event) => setSolucionInput(event.target.value)} />
                  : <div className="rounded-xl border border-[var(--gray-100)] bg-[var(--gray-50)] p-4">{ticket.solucion || 'Pendiente.'}</div>}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3 px-6 py-4">
              <div className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-[var(--gray-400)]" />
                <CardTitle>Checklist post-servicio</CardTitle>
              </div>
              {(isTech || isAdmin) && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    title="Seleccionar y aplicar una plantilla"
                    onClick={() => {
                      setShowTemplatePicker(true);
                      setShowTemplateSaver(false);
                    }}
                    className="flex h-10 min-w-[42px] cursor-pointer items-center justify-center rounded-full border border-[var(--gray-200)] bg-white px-3 text-[var(--gray-500)] transition-colors hover:border-[var(--gray-300)] hover:text-[var(--gray-700)]"
                  >
                    <Files size={16} />
                  </button>
                  {isAdmin && (
                    <button
                      type="button"
                      title="Guardar el checklist actual como plantilla"
                      onClick={() => {
                        setShowTemplateSaver(true);
                        setShowTemplatePicker(false);
                      }}
                      className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-[var(--gray-200)] bg-white text-[var(--gray-500)] transition-colors hover:border-[var(--gray-300)] hover:text-[var(--gray-700)]"
                    >
                      <Save size={16} />
                    </button>
                  )}
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              {checklistFeedback && (
                <div className="rounded-xl border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] px-4 py-3 text-sm text-[var(--color-danger)]">
                  {checklistFeedback}
                </div>
              )}

              {(ticket.checklist_items || []).length === 0 && (
                <div className="text-sm text-[var(--gray-500)]">Sin items todavia. Los obligatorios bloquean el paso a listo.</div>
              )}

              {(ticket.checklist_items || []).map((item: any) => (
                <div key={item.id} className="space-y-3 rounded-xl border border-[var(--gray-200)] px-4 py-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-3">
                      {(isTech || isAdmin) && (
                        <button
                          type="button"
                          onClick={() => handleDeleteChecklist(item)}
                          className="flex h-[46px] w-[46px] shrink-0 cursor-pointer items-center justify-center rounded-full border border-[var(--color-danger-border)] bg-white text-[var(--color-danger)] transition-colors hover:bg-[var(--color-danger-bg)]"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-[var(--gray-800)]">{item.nombre}</div>
                        <div className="text-[12px] text-[var(--gray-500)]">{item.requerido ? 'Obligatorio' : 'Opcional'} - {item.completado ? 'Completado' : 'Pendiente'}</div>
                      </div>
                    </div>
                    {(isTech || isAdmin) && (
                      <div className="flex items-center gap-3">
                        <label
                          htmlFor={`checklist-files-${item.id}`}
                          className={`flex h-[46px] w-[46px] cursor-pointer items-center justify-center rounded-full border transition-colors ${
                            (checklistFiles[item.id] || []).length > 0
                              ? 'border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] text-[var(--color-warning)]'
                              : 'border-[var(--gray-200)] bg-white text-[var(--gray-400)] hover:border-[var(--gray-300)] hover:text-[var(--gray-700)]'
                          }`}
                        >
                          <Upload size={18} />
                        </label>
                        <input
                          id={`checklist-files-${item.id}`}
                          type="file"
                          accept="image/png,image/jpeg"
                          multiple
                          className="hidden"
                          onChange={(event) => setChecklistFiles((prev) => ({ ...prev, [item.id]: event.target.files ? Array.from(event.target.files) : [] }))}
                        />
                        <button
                          type="button"
                          onClick={() => handleToggleChecklist(item)}
                          className={`flex h-[46px] w-[46px] cursor-pointer items-center justify-center rounded-full border transition-colors ${
                            item.completado
                              ? 'border-[#6fb4ff] bg-[#c8e3ff] text-[#256fc4]'
                              : 'border-[var(--gray-200)] bg-white text-[var(--gray-400)] hover:border-[var(--gray-300)] hover:text-[var(--gray-700)]'
                          }`}
                        >
                          <Check size={18} />
                        </button>
                      </div>
                    )}
                  </div>

                  {(item.evidences || []).length > 0 && (
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                      {(item.evidences || []).map((evidence: any) => (
                        <a key={evidence.id} href={resolveMediaUrl(evidence.archivo)} target="_blank" rel="noreferrer" className="overflow-hidden rounded-xl border border-[var(--gray-200)] bg-[var(--gray-50)]">
                          <img src={resolveMediaUrl(evidence.archivo)} alt={evidence.nombre_archivo || 'Evidencia de checklist'} className="h-28 w-full object-cover" />
                          <div className="truncate px-3 py-2 text-xs text-[var(--gray-600)]">{evidence.nombre_archivo || 'Evidencia'}</div>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {(isTech || isAdmin) && (
                <div className="flex gap-3">
                  <Input value={newChecklistItem} onChange={(event) => setNewChecklistItem(event.target.value)} placeholder="Nuevo item obligatorio" />
                  <Button onClick={handleAddChecklist}>
                    <Plus size={16} className="mr-2" />
                    Agregar
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-8 lg:col-span-4">
          <Card>
            <CardHeader className="px-6 py-4">
              <CardTitle>Resumen comercial</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-[var(--gray-100)] bg-[var(--gray-50)] p-4">
                  <div className="text-[11px] font-bold uppercase text-[var(--gray-400)]">Total</div>
                  <div className="mt-2 text-2xl font-black text-[var(--gray-800)]">S/ {total.toFixed(2)}</div>
                </div>
                <div className="rounded-xl border border-[var(--gray-100)] bg-[var(--gray-50)] p-4">
                  <div className="text-[11px] font-bold uppercase text-[var(--gray-400)]">Restante</div>
                  <div className="mt-2 text-2xl font-black text-[var(--color-warning)]">S/ {saldoPendiente.toFixed(2)}</div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-[12px] font-bold uppercase text-[var(--gray-400)]">Ultimos recibos</div>
                {receiptList.slice().sort((left: any, right: any) => new Date(right.created_at || right.created || 0).getTime() - new Date(left.created_at || left.created || 0).getTime()).slice(0, 3).map((receipt: any) => (
                  <div key={receipt.id} className="flex items-center justify-between rounded-xl border border-[var(--gray-100)] bg-[var(--gray-50)] px-4 py-3 text-sm">
                    <span className="font-medium text-[var(--gray-600)]">{receipt.folio || 'Recibo'}</span>
                    <span className="font-bold text-[var(--gray-800)]">S/ {money(receipt.amount).toFixed(2)}</span>
                  </div>
                ))}
                {receiptList.length === 0 && (
                  <div className="rounded-xl border border-dashed border-[var(--gray-200)] bg-[var(--gray-50)] px-4 py-4 text-sm text-[var(--gray-500)]">
                    Aun no hay recibos registrados.
                  </div>
                )}
              </div>

              {activeQuote ? (
                <div className="space-y-3">
                  <Button variant="secondary" className="w-full" onClick={() => setShowPaymentDetails(true)}>
                    <CreditCard size={16} className="mr-2" />
                    Detalles de pago
                  </Button>
                </div>
              ) : canAssignQuickAmount ? (
                <div className="space-y-3">
                  <Button variant="secondary" className="w-full" onClick={() => navigate(`/quotes/new?ticketId=${ticket.id}`)}>
                    Crear cotizacion
                  </Button>
                  <Button variant="secondary" className="w-full" onClick={() => setShowQuickAmountModal(true)}>
                    Asignar monto
                  </Button>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-[var(--gray-200)] bg-[var(--gray-50)] px-4 py-4 text-sm text-[var(--gray-500)]">
                  Este ticket ya tiene una cotizacion ligada. Continua el cobro desde el flujo normal.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="px-6 py-4">
              <CardTitle>Accesorios entregados</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-6">
              {(ticket.accessories || []).length > 0 ? (
                (ticket.accessories || []).map((accessory: any) => (
                  <div key={accessory.id} className="rounded-xl border border-[var(--gray-100)] bg-[var(--gray-50)] px-4 py-3">
                    <div className="font-semibold text-[var(--gray-800)]">{accessory.nombre}</div>
                    <div className="mt-1 text-sm text-[var(--gray-500)]">{accessory.condicion || 'Sin condicion registrada'}</div>
                    {accessory.notas && <div className="mt-2 text-xs text-[var(--gray-500)]">{accessory.notas}</div>}
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-[var(--gray-200)] bg-[var(--gray-50)] px-4 py-4 text-sm text-[var(--gray-500)]">
                  No se registraron accesorios en este ticket.
                </div>
              )}
            </CardContent>
          </Card>

          {ticket.es_garantia && ticket.parent_ticket_summary && (
            <Card>
              <CardHeader className="flex flex-row items-center gap-2 px-6 py-4">
                <ShieldAlert className="h-5 w-5 text-[var(--color-brand-blue)]" />
                <CardTitle>Ticket padre</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="rounded-xl border border-[var(--gray-100)] bg-[var(--gray-50)] px-4 py-4">
                  <div className="mb-1 text-[11px] font-bold uppercase text-[var(--gray-400)]">Garantia vinculada a</div>
                  <Link to={`/tickets/${ticket.parent_ticket_summary.id}`} className="font-semibold text-[var(--color-brand-blue)] hover:underline">
                    {ticket.parent_ticket_summary.folio}
                  </Link>
                  <div className="mt-2 text-sm text-[var(--gray-500)]">
                    Estado actual del ticket base: {statusLabels[ticket.parent_ticket_summary.estado] || ticket.parent_ticket_summary.estado}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="flex flex-row items-center gap-2">
              <History className="h-5 w-5 text-[var(--gray-400)]" />
              <CardTitle>Timeline</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="max-h-[420px] space-y-3 overflow-y-auto pr-2">
                {orderedTransitions.map((transition: any) => (
                  <div key={transition.id} className="rounded-xl border border-[var(--gray-100)] bg-[var(--gray-50)] p-3">
                    <div className="font-semibold text-[var(--gray-800)]">{statusLabels[transition.estado_nuevo] || transition.estado_nuevo}</div>
                    <div className="text-[12px] text-[var(--gray-500)]">{transition.cambiado_por?.nombre || 'Sistema'} Â· {new Date(transition.created_at).toLocaleString()}</div>
                    {transition.motivo && <div className="mt-1 text-[12px] text-[var(--gray-500)]">{transition.motivo}</div>}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {showTemplatePicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,22,35,0.45)] p-4 backdrop-blur-sm">
          <Card className="w-full max-w-2xl">
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <CardTitle>Aplicar plantilla</CardTitle>
              <button
                type="button"
                onClick={closeChecklistPanels}
                className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-[var(--gray-200)] text-[var(--gray-400)] transition-colors hover:border-[var(--gray-300)] hover:text-[var(--gray-700)]"
              >
                <X size={18} />
              </button>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                <Select value={selectedTemplateId} onChange={(event) => setSelectedTemplateId(event.target.value)}>
                  <option value="">Selecciona una plantilla...</option>
                  {checklistTemplates.map((template: any) => (
                    <option key={template.id} value={template.id}>{template.nombre}</option>
                  ))}
                </Select>
                <Button
                  variant="secondary"
                  onClick={() => selectedTemplateId && applyChecklistTemplateMutation.mutate(
                    { ticketId: ticket.id, templateId: parseInt(selectedTemplateId, 10) },
                    {
                      onSuccess: () => {
                        closeChecklistPanels();
                        refetch();
                      },
                    },
                  )}
                  disabled={!selectedTemplateId}
                >
                  Aplicar
                </Button>
              </div>

              <div className="rounded-2xl border border-[var(--gray-200)] bg-[var(--gray-50)] p-4">
                <div className="mb-3 text-sm font-semibold text-[var(--gray-700)]">Vista previa</div>
                {selectedTemplate?.items?.length ? (
                  <div className="space-y-2">
                    {selectedTemplate.items.map((item: any) => (
                      <div key={item.id} className="flex items-center justify-between rounded-xl border border-[var(--gray-100)] bg-white px-3 py-2 text-sm">
                        <span>{item.nombre}</span>
                        <span className="text-xs text-[var(--gray-500)]">{item.requerido ? 'Obligatorio' : 'Opcional'}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-[var(--gray-500)]">Selecciona una plantilla para ver sus items.</div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {showTemplateSaver && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,22,35,0.45)] p-4 backdrop-blur-sm">
          <Card className="w-full max-w-2xl">
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <CardTitle>Guardar plantilla</CardTitle>
              <button
                type="button"
                onClick={closeChecklistPanels}
                className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-[var(--gray-200)] text-[var(--gray-400)] transition-colors hover:border-[var(--gray-300)] hover:text-[var(--gray-700)]"
              >
                <X size={18} />
              </button>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                <Input value={newTemplateName} onChange={(event) => setNewTemplateName(event.target.value)} placeholder="Nombre de la plantilla" />
                <Button
                  variant="secondary"
                  onClick={() => {
                    if (!newTemplateName.trim()) return;
                    createChecklistTemplateMutation.mutate(
                      {
                        nombre: newTemplateName.trim(),
                        items: (ticket.checklist_items || []).map((item: any, index: number) => ({
                          nombre: item.nombre,
                          requerido: item.requerido,
                          orden: item.orden ?? index,
                        })),
                      },
                      {
                        onSuccess: () => {
                          setNewTemplateName('');
                          closeChecklistPanels();
                        },
                      },
                    );
                  }}
                  disabled={!newTemplateName.trim() || !(ticket.checklist_items || []).length}
                >
                  Guardar
                </Button>
              </div>

              <div className="rounded-2xl border border-[var(--gray-200)] bg-[var(--gray-50)] p-4">
                <div className="mb-3 text-sm font-semibold text-[var(--gray-700)]">Items que se guardaran</div>
                {currentChecklistPreview.length > 0 ? (
                  <div className="space-y-2">
                    {currentChecklistPreview.map((itemName: string, index: number) => (
                      <div key={`${itemName}-${index}`} className="rounded-xl border border-[var(--gray-100)] bg-white px-3 py-2 text-sm text-[var(--gray-700)]">
                        {itemName}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-[var(--gray-500)]">No hay items en el checklist actual.</div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {showPaymentDetails && activeQuote && (
        <PaymentDetailsModal quote={activeQuote} onClose={() => setShowPaymentDetails(false)} isAdmin={isAdmin} />
      )}

      {showQuickAmountModal && canAssignQuickAmount && (
        <QuickAmountModal
          ticketId={ticket.id}
          onClose={() => {
            setShowQuickAmountModal(false);
            refetch();
          }}
        />
      )}
    </div>
  );
}



