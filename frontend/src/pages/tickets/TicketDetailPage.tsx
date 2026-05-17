import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Boxes, ClipboardList, CreditCard, FileText, History, Laptop, User as UserIcon } from 'lucide-react';

import { PaymentModal } from '../../components/finance/PaymentModal';
import { ReservationModal } from '../../components/inventory/ReservationModal';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { getApiErrorMessage, resolveMediaUrl } from '../../lib/apiErrors';
import { PageHeader } from '../../components/ui/PageHeader';
import { PriorityBadge } from '../../components/ui/PriorityBadge';
import { Textarea } from '../../components/ui/Textarea';
import { TicketStatusBadge } from '../../components/ui/TicketStatusBadge';
import { useConfirmarPago } from '../../hooks/useFinance';
import { useConsumeReservation, useReleaseReservation } from '../../hooks/useInventory';
import {
  useAddChecklistItem,
  useCreateWarrantyTicket,
  useTicket,
  useTicketTransition,
  useUpdateChecklistItem,
  useUpdateTechnicalDetails,
  useUpdateTicketAmounts,
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
  DIAGNOSTIC: 'Diagnóstico',
  QUOTED: 'Cotizado',
  APPROVED: 'Aprobado',
  WAITING_PARTS: 'Espera repuestos',
  IN_REPAIR: 'En reparación',
  IN_TESTING: 'En pruebas',
  READY: 'Listo',
  DELIVERED: 'Entregado',
  CLOSED: 'Cerrado',
  REJECTED: 'Rechazado',
  STORAGE: 'Cochera',
};

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { data: ticket, isLoading, refetch } = useTicket(id || '');

  const transitionMutation = useTicketTransition();
  const updateAmountsMutation = useUpdateTicketAmounts();
  const updateTechnicalDetailsMutation = useUpdateTechnicalDetails();
  const addChecklistItemMutation = useAddChecklistItem();
  const updateChecklistItemMutation = useUpdateChecklistItem();
  const createWarrantyMutation = useCreateWarrantyTicket();
  const confirmPaymentMutation = useConfirmarPago();
  const releaseReservationMutation = useReleaseReservation();
  const consumeReservationMutation = useConsumeReservation();

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showReservationModal, setShowReservationModal] = useState(false);
  const [showAmountsModal, setShowAmountsModal] = useState(false);
  const [montoEstimadoInput, setMontoEstimadoInput] = useState('');
  const [totalInput, setTotalInput] = useState('');
  const [diagnosticoInput, setDiagnosticoInput] = useState('');
  const [solucionInput, setSolucionInput] = useState('');
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [warrantyProblem, setWarrantyProblem] = useState('');
  const [checklistFiles, setChecklistFiles] = useState<Record<number, File[]>>({});
  const [checklistFeedback, setChecklistFeedback] = useState<string | null>(null);
  const [technicalSaved, setTechnicalSaved] = useState(false);

  const isRecep = user?.role === 'Recepcionista' || user?.is_superuser;
  const isTech = user?.role === 'Técnico' || user?.is_superuser;
  const isAdmin = user?.role === 'Administrador' || user?.is_superuser;
  const isAlmacenero = user?.role === 'Almacenero';
  const canManageReservations = isAdmin || isTech || isAlmacenero;

  useEffect(() => {
    const interval = setInterval(() => refetch(), 15000);
    return () => clearInterval(interval);
  }, [refetch]);

  useEffect(() => {
    if (!ticket) return;
    setDiagnosticoInput(ticket.diagnostico || '');
    setSolucionInput(ticket.solucion || '');
    setMontoEstimadoInput(ticket.monto_estimado || '');
    setTotalInput(ticket.total || '0.00');
    setTechnicalSaved(false);
  }, [ticket]);

  useEffect(() => {
    if (!technicalSaved) return;
    const timer = window.setTimeout(() => setTechnicalSaved(false), 2000);
    return () => window.clearTimeout(timer);
  }, [technicalSaved]);

  if (isLoading) {
    return <div className="p-12 text-center">Cargando ticket...</div>;
  }

  if (!ticket) {
    return <div className="p-12 text-center">Ticket no encontrado.</div>;
  }

  const pagosConfirmados = (ticket.receipts || [])
    .filter((receipt: any) => receipt.estado === 'CONFIRMED')
    .reduce((acc: number, receipt: any) => acc + parseFloat(receipt.amount), 0);
  const pagosPendientes = (ticket.receipts || [])
    .filter((receipt: any) => receipt.estado === 'PENDING')
    .reduce((acc: number, receipt: any) => acc + parseFloat(receipt.amount), 0);
  const total = parseFloat(ticket.total || '0');
  const saldoPendiente = total - pagosConfirmados;
  const allowedNextStatuses = VALID_TRANSITIONS[ticket.estado] || [];
  const hasTechnicalChanges =
    diagnosticoInput !== (ticket.diagnostico || '') ||
    solucionInput !== (ticket.solucion || '');
  const orderedTransitions = [...(ticket.transitions || [])].sort(
    (left: any, right: any) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
  );

  const handleTransition = (newStatus: string) => {
    transitionMutation.mutate(
      { id: ticket.id, newStatus },
      {
        onSuccess: () => refetch(),
        onError: (error: any) => alert(error?.response?.data?.detail || 'No se pudo transicionar el ticket.'),
      },
    );
  };

  const handleSaveTechnicalDetails = () => {
    updateTechnicalDetailsMutation.mutate(
      {
        id: ticket.id,
        diagnostico: diagnosticoInput,
        solucion: solucionInput,
      },
      {
        onSuccess: () => {
          setTechnicalSaved(true);
          refetch();
        },
      },
    );
  };

  const handleSaveAmounts = () => {
    updateAmountsMutation.mutate(
      {
        id: ticket.id,
        monto_estimado: montoEstimadoInput,
        total: totalInput,
      },
      {
        onSuccess: () => {
          setShowAmountsModal(false);
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
        onError: (error: any) => {
          setChecklistFeedback(getApiErrorMessage(error, 'No se pudo actualizar el checklist.'));
        },
      },
    );
  };

  const handleChecklistFilesChange = (itemId: number, files: FileList | null) => {
    setChecklistFiles((prev) => ({
      ...prev,
      [itemId]: files ? Array.from(files) : [],
    }));
  };

  const handleUploadChecklistEvidence = (item: any) => {
    if (!(checklistFiles[item.id] || []).length) return;
    const data = new FormData();
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
        onError: (error: any) => {
          setChecklistFeedback(getApiErrorMessage(error, 'No se pudo subir la evidencia del checklist.'));
        },
      },
    );
  };

  const handleCreateWarranty = () => {
    if (!warrantyProblem.trim()) return;
    createWarrantyMutation.mutate(
      {
        ticketId: ticket.id,
        descripcion_problema: warrantyProblem,
        prioridad: ticket.prioridad,
      },
      {
        onSuccess: () => {
          setWarrantyProblem('');
          refetch();
        },
      },
    );
  };

  return (
    <div className="p-8 max-w-[1400px] mx-auto space-y-8">
      <Button variant="ghost" size="sm" onClick={() => navigate('/tickets')}>
        <ArrowLeft size={16} className="mr-2" />
        Volver
      </Button>

      <PageHeader
        title={ticket.folio}
        subtitle={`Creado el ${new Date(ticket.created_at).toLocaleString()}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <TicketStatusBadge status={ticket.estado} />
            <PriorityBadge priority={ticket.prioridad} />
            {isRecep && saldoPendiente > 0 && !['DELIVERED', 'CLOSED'].includes(ticket.estado) && (
              <Button onClick={() => setShowPaymentModal(true)}>
                <CreditCard size={16} className="mr-2" />
                Cobrar
              </Button>
            )}
            {canManageReservations && ['APPROVED', 'WAITING_PARTS', 'IN_REPAIR'].includes(ticket.estado) && (
              <Button variant="secondary" onClick={() => setShowReservationModal(true)}>
                <Boxes size={16} className="mr-2" />
                Reservar
              </Button>
            )}
            {(isAdmin || isTech) && !ticket.active_quote && (
              <Button variant="ghost" onClick={() => setShowAmountsModal(true)}>
                Editar montos
              </Button>
            )}
            {allowedNextStatuses.map((status) => (
              <Button key={status} variant="secondary" size="sm" onClick={() => handleTransition(status)}>
                {statusLabels[status] || status}
              </Button>
            ))}
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-8">
          <Card>
            <CardHeader><CardTitle>Problema reportado</CardTitle></CardHeader>
            <CardContent className="pt-6">
              <p className="text-[15px] text-[var(--gray-700)] whitespace-pre-wrap">{ticket.descripcion_problema}</p>
            </CardContent>
          </Card>

          {(ticket.evidences || []).length > 0 && (
            <Card>
              <CardHeader><CardTitle>Evidencias del ticket</CardTitle></CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                  {(ticket.evidences || []).map((evidence: any) => (
                    <a
                      key={evidence.id}
                      href={resolveMediaUrl(evidence.archivo)}
                      target="_blank"
                      rel="noreferrer"
                      className="overflow-hidden rounded-xl border border-[var(--gray-200)] bg-[var(--gray-50)]"
                    >
                      <img
                        src={resolveMediaUrl(evidence.archivo)}
                        alt={evidence.nombre_archivo || 'Evidencia'}
                        className="h-28 w-full object-cover"
                      />
                      <div className="truncate px-3 py-2 text-xs text-[var(--gray-600)]">
                        {evidence.nombre_archivo || 'Evidencia'}
                      </div>
                    </a>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle>Diagnóstico y solución</CardTitle></CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div>
                <div className="text-[12px] font-bold uppercase text-[var(--gray-400)] mb-2">Diagnóstico</div>
                {(isTech || isAdmin) ? (
                  <Textarea rows={4} value={diagnosticoInput} onChange={(e) => setDiagnosticoInput(e.target.value)} />
                ) : (
                  <div className="p-4 rounded-xl bg-[var(--gray-50)] border border-[var(--gray-100)]">{ticket.diagnostico || 'Pendiente.'}</div>
                )}
              </div>
              <div>
                <div className="text-[12px] font-bold uppercase text-[var(--gray-400)] mb-2">Solución</div>
                {(isTech || isAdmin) ? (
                  <Textarea rows={4} value={solucionInput} onChange={(e) => setSolucionInput(e.target.value)} />
                ) : (
                  <div className="p-4 rounded-xl bg-[var(--gray-50)] border border-[var(--gray-100)]">{ticket.solucion || 'Pendiente.'}</div>
                )}
              </div>
              {(isTech || isAdmin) && (
                <div className="flex justify-end">
                  <Button onClick={handleSaveTechnicalDetails} disabled={updateTechnicalDetailsMutation.isPending || !hasTechnicalChanges}>
                    {updateTechnicalDetailsMutation.isPending ? 'Guardando...' : technicalSaved ? 'Guardado OK' : 'Guardar detalle tecnico'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center gap-2">
              <ClipboardList className="h-5 w-5 text-[var(--gray-400)]" />
              <CardTitle>Checklist post-servicio</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              {checklistFeedback && (
                <div className="rounded-xl border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] px-4 py-3 text-sm text-[var(--color-danger)]">
                  {checklistFeedback}
                </div>
              )}
              {(ticket.checklist_items || []).length === 0 && (
                <div className="text-sm text-[var(--gray-500)]">Sin items todavía. Los obligatorios bloquean el paso a listo.</div>
              )}
              {(ticket.checklist_items || []).map((item: any) => (
                <div key={item.id} className="space-y-4 p-4 rounded-xl border border-[var(--gray-200)]">
                  <div>
                    <div className="font-semibold text-[var(--gray-800)]">{item.nombre}</div>
                    <div className="text-[12px] text-[var(--gray-500)]">
                      {item.requerido ? 'Obligatorio' : 'Opcional'} · {item.completado ? 'Completado' : 'Pendiente'}
                    </div>
                  </div>
                  {(item.evidences || []).length > 0 && (
                    <div className="space-y-2">
                      <div className="text-[11px] font-bold uppercase text-[var(--gray-400)]">Evidencias</div>
                      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                        {(item.evidences || []).map((evidence: any) => (
                          <a
                            key={evidence.id}
                            href={resolveMediaUrl(evidence.archivo)}
                            target="_blank"
                            rel="noreferrer"
                            className="overflow-hidden rounded-xl border border-[var(--gray-200)] bg-[var(--gray-50)]"
                          >
                            <img
                              src={resolveMediaUrl(evidence.archivo)}
                              alt={evidence.nombre_archivo || 'Evidencia de checklist'}
                              className="h-28 w-full object-cover"
                            />
                            <div className="truncate px-3 py-2 text-xs text-[var(--gray-600)]">
                              {evidence.nombre_archivo || 'Evidencia'}
                            </div>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                  {(isTech || isAdmin) && (
                    <Button size="sm" variant={item.completado ? 'ghost' : 'secondary'} onClick={() => handleToggleChecklist(item)}>
                      {item.completado ? 'Reabrir' : 'Completar'}
                    </Button>
                  )}
                  {(isTech || isAdmin) && (
                    <div className="space-y-3 rounded-xl bg-[var(--gray-50)] p-3">
                      <Input
                        type="file"
                        accept="image/png,image/jpeg"
                        multiple
                        onChange={(e) => handleChecklistFilesChange(item.id, e.target.files)}
                      />
                      {(checklistFiles[item.id] || []).length > 0 && (
                        <div className="flex flex-col gap-3 text-sm text-[var(--gray-600)] md:flex-row md:items-center md:justify-between">
                          <span>{(checklistFiles[item.id] || []).length} archivo(s) listos para subir.</span>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleUploadChecklistEvidence(item)}
                            disabled={updateChecklistItemMutation.isPending}
                          >
                            Subir evidencia
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                ))}
              {(isTech || isAdmin) && (
                <div className="flex gap-3">
                  <Input value={newChecklistItem} onChange={(e) => setNewChecklistItem(e.target.value)} placeholder="Nuevo item obligatorio" />
                  <Button onClick={handleAddChecklist}>Agregar</Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Pagos y cronograma</CardTitle></CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-[var(--gray-50)] border border-[var(--gray-100)]">
                  <div className="text-[11px] uppercase text-[var(--gray-400)] font-bold">Total</div>
                  <div className="text-2xl font-black text-[var(--gray-800)]">S/ {total.toFixed(2)}</div>
                </div>
                <div className="p-4 rounded-xl bg-[var(--gray-50)] border border-[var(--gray-100)]">
                  <div className="text-[11px] uppercase text-[var(--gray-400)] font-bold">Pagado</div>
                  <div className="text-2xl font-black text-[var(--color-success)]">S/ {pagosConfirmados.toFixed(2)}</div>
                </div>
                <div className="p-4 rounded-xl bg-[var(--gray-50)] border border-[var(--gray-100)]">
                  <div className="text-[11px] uppercase text-[var(--gray-400)] font-bold">Saldo</div>
                  <div className="text-2xl font-black text-[var(--color-danger)]">S/ {saldoPendiente.toFixed(2)}</div>
                </div>
              </div>

              {(ticket.receipts || []).length > 0 && (
                <div className="space-y-3">
                  {(ticket.receipts || []).map((receipt: any) => (
                    <div key={receipt.id} className="flex justify-between items-center gap-3 p-4 rounded-xl border border-[var(--gray-200)]">
                      <div>
                        <div className="font-semibold text-[var(--gray-800)]">{receipt.folio} · {receipt.metodo_pago}</div>
                        <div className="text-[12px] text-[var(--gray-500)]">{receipt.estado}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="font-bold">S/ {parseFloat(receipt.amount).toFixed(2)}</div>
                        {isAdmin && receipt.estado === 'PENDING' && (
                          <Button size="sm" variant="secondary" onClick={() => confirmPaymentMutation.mutate(receipt.id, { onSuccess: () => refetch() })}>
                            Confirmar
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {(ticket.payment_schedules || []).length > 0 && (
                <div className="space-y-3">
                  <div className="text-[12px] uppercase font-bold text-[var(--gray-400)]">Cuotas</div>
                  {(ticket.payment_schedules || []).map((schedule: any) => (
                    <div key={schedule.id} className="flex justify-between items-center p-3 rounded-xl bg-[var(--gray-50)] border border-[var(--gray-100)]">
                      <span>Cuota {schedule.numero_cuota} · vence {schedule.due_date}</span>
                      <span className="font-bold">S/ {parseFloat(schedule.saldo_pendiente || schedule.amount).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}

              {(ticket.cochera_charges || []).length > 0 && (
                <div className="space-y-3">
                  <div className="text-[12px] uppercase font-bold text-[var(--gray-400)]">Cochera</div>
                  {(ticket.cochera_charges || []).map((charge: any) => (
                    <div key={charge.id} className="flex justify-between items-center p-3 rounded-xl bg-[var(--gray-50)] border border-[var(--gray-100)]">
                      <span>{charge.charge_date}</span>
                      <span className="font-bold">S/ {parseFloat(charge.tarifa_diaria || 0).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}

              {pagosPendientes > 0 && (
                <div className="text-sm text-[var(--color-warning)] p-4 rounded-xl bg-[var(--color-warning-bg)] border border-[var(--color-warning-border)]">
                  Hay S/ {pagosPendientes.toFixed(2)} en pagos digitales pendientes de confirmación.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-4 space-y-8">
          <Card>
            <CardHeader><CardTitle>Cliente y equipo</CardTitle></CardHeader>
            <CardContent className="pt-6 space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[var(--gray-50)] flex items-center justify-center text-[var(--color-brand-blue)] border border-[var(--gray-200)]">
                  <UserIcon size={20} />
                </div>
                <div>
                  <Link to={`/customers/${ticket.customer?.id}`} className="font-bold text-[var(--gray-800)] hover:text-[var(--color-brand-blue)]">
                    {ticket.customer?.nombre}
                  </Link>
                  <div className="text-[12px] text-[var(--gray-500)]">{ticket.customer?.identificador}</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-[var(--gray-50)] flex items-center justify-center text-[var(--gray-400)] border border-[var(--gray-200)]">
                  <Laptop size={20} />
                </div>
                <div>
                  <div className="font-bold text-[var(--gray-800)]">
                    {ticket.device ? `${ticket.device.marca} ${ticket.device.modelo}` : 'No registrado'}
                  </div>
                  <div className="text-[12px] text-[var(--gray-500)]">{ticket.device?.numero_serie || 'Sin serie'}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Cotización y reservas</CardTitle></CardHeader>
            <CardContent className="pt-6 space-y-4">
              {ticket.active_quote ? (
                <div className="p-4 rounded-xl border border-[var(--gray-200)]">
                  <div className="font-bold text-[var(--color-brand-blue)]">
                    <Link to={`/quotes/${ticket.active_quote.id}`}>{ticket.active_quote.folio}</Link>
                  </div>
                  <div className="text-[12px] text-[var(--gray-500)]">{ticket.active_quote.estado} · S/ {parseFloat(ticket.active_quote.total).toFixed(2)}</div>
                </div>
              ) : (
                <Button variant="secondary" className="w-full" onClick={() => navigate(`/quotes/new?ticketId=${ticket.id}`)}>
                  <FileText size={16} className="mr-2" />
                  Crear cotización
                </Button>
              )}

              {(ticket.stock_reservations || []).map((reservation: any) => (
                <div key={reservation.id} className="p-4 rounded-xl border border-[var(--gray-200)]">
                  <div className="font-semibold text-[var(--gray-800)]">{reservation.stock_item.product_name}</div>
                  <div className="text-[12px] text-[var(--gray-500)]">{reservation.stock_item.warehouse_name}</div>
                  <div className="text-[12px] text-[var(--gray-500)] mt-1">Reservado: {reservation.cantidad}</div>
                  {reservation.estado === 'ACTIVE' && canManageReservations && (
                    <div className="flex gap-2 mt-3">
                      <Button size="sm" variant="secondary" onClick={() => consumeReservationMutation.mutate({ id: reservation.id }, { onSuccess: () => refetch() })}>
                        Consumir
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => releaseReservationMutation.mutate({ id: reservation.id }, { onSuccess: () => refetch() })}>
                        Liberar
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Garantía</CardTitle></CardHeader>
            <CardContent className="pt-6 space-y-4">
              {ticket.parent_ticket_summary && (
                <div className="text-sm">
                  Ticket origen: <Link className="font-bold text-[var(--color-brand-blue)]" to={`/tickets/${ticket.parent_ticket_summary.id}`}>{ticket.parent_ticket_summary.folio}</Link>
                </div>
              )}
              {(ticket.warranty_children || []).map((child: any) => (
                <div key={child.id} className="p-3 rounded-xl border border-[var(--gray-200)]">
                  <Link to={`/tickets/${child.id}`} className="font-bold text-[var(--color-brand-blue)]">{child.folio}</Link>
                  <div className="text-[12px] text-[var(--gray-500)]">{child.estado}</div>
                </div>
              ))}
              {(isRecep || isAdmin) && (
                <>
                  <Textarea rows={3} value={warrantyProblem} onChange={(e) => setWarrantyProblem(e.target.value)} placeholder="Describe la falla reportada en garantía" />
                  <Button variant="secondary" className="w-full" onClick={handleCreateWarranty} disabled={createWarrantyMutation.isPending}>
                    {createWarrantyMutation.isPending ? 'Creando...' : 'Crear ticket de garantía'}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center gap-2">
              <History className="h-5 w-5 text-[var(--gray-400)]" />
              <CardTitle>Timeline</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="max-h-[420px] space-y-3 overflow-y-auto pr-2">
                {orderedTransitions.map((transition: any) => (
                <div key={transition.id} className="p-3 rounded-xl bg-[var(--gray-50)] border border-[var(--gray-100)]">
                  <div className="font-semibold text-[var(--gray-800)]">{statusLabels[transition.estado_nuevo] || transition.estado_nuevo}</div>
                  <div className="text-[12px] text-[var(--gray-500)]">
                    {transition.cambiado_por?.nombre || 'Sistema'} · {new Date(transition.created_at).toLocaleString()}
                  </div>
                  {transition.motivo && <div className="text-[12px] text-[var(--gray-500)] mt-1">{transition.motivo}</div>}
                </div>
              ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {showPaymentModal && (
        <PaymentModal
          ticketId={ticket.id}
          saldoPendiente={saldoPendiente}
          onClose={() => {
            setShowPaymentModal(false);
            refetch();
          }}
        />
      )}

      {showReservationModal && (
        <ReservationModal
          ticketId={ticket.id}
          activeQuoteId={ticket.active_quote?.id}
          onClose={() => {
            setShowReservationModal(false);
            refetch();
          }}
        />
      )}

      {showAmountsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,22,35,0.45)] p-4">
          <Card className="w-full max-w-md">
            <CardHeader><CardTitle>Actualizar montos</CardTitle></CardHeader>
            <CardContent className="pt-6 space-y-4">
              <Input value={montoEstimadoInput} onChange={(e) => setMontoEstimadoInput(e.target.value)} placeholder="Monto estimado" />
              <Input value={totalInput} onChange={(e) => setTotalInput(e.target.value)} placeholder="Total final" />
              <div className="flex justify-end gap-3">
                <Button variant="ghost" onClick={() => setShowAmountsModal(false)}>Cancelar</Button>
                <Button onClick={handleSaveAmounts} disabled={updateAmountsMutation.isPending}>
                  {updateAmountsMutation.isPending ? 'Guardando...' : 'Guardar'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
