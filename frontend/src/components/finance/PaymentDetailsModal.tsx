import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, CreditCard, Plus, ReceiptText, Save, WalletCards, X } from 'lucide-react';

import { useConfirmarPago, useCreateQuoteSchedules, useRegistrarPago } from '../../hooks/useFinance';
import { Quote, useQuote } from '../../hooks/useQuotes';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { Select } from '../ui/Select';

type ScheduleDraft = {
  amount: string;
  due_date: string;
};

type Props = {
  quote: Quote;
  onClose: () => void;
  isAdmin?: boolean;
};

const createEmptyInstallment = (): ScheduleDraft => ({
  amount: '',
  due_date: '',
});

const money = (value: string | number | null | undefined) => {
  const normalized = String(value ?? 0).replace(',', '.').trim();
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const PaymentDetailsModal = ({ quote, onClose, isAdmin = false }: Props) => {
  const { data: liveQuote } = useQuote(quote.id);
  const currentQuote = liveQuote || quote;
  const registrarPago = useRegistrarPago(quote.id);
  const confirmarPago = useConfirmarPago();
  const createSchedules = useCreateQuoteSchedules(quote.id);

  const [metodoPago, setMetodoPago] = useState<'CASH' | 'TRANSFER' | 'CARD' | 'YAPE' | 'PLIN'>('CASH');
  const [amount, setAmount] = useState(money(currentQuote.saldo_pendiente).toFixed(2));
  const [referencia, setReferencia] = useState('');
  const [voucherFile, setVoucherFile] = useState<File | null>(null);
  const [selectedScheduleIds, setSelectedScheduleIds] = useState<number[]>([]);
  const [scheduleAmounts, setScheduleAmounts] = useState<Record<number, string>>({});
  const [isEditingSchedules, setIsEditingSchedules] = useState(false);
  const [scheduleDraft, setScheduleDraft] = useState<ScheduleDraft[]>([createEmptyInstallment()]);
  const [localError, setLocalError] = useState<string | null>(null);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  const requiresVoucher = metodoPago !== 'CASH';
  const pendingSchedules = (currentQuote.payment_schedules || []).filter((schedule: any) => !schedule.esta_pagado && money(schedule.saldo_pendiente) > 0);
  const paidAmount = Math.max(0, money(currentQuote.total) - money(currentQuote.saldo_pendiente));
  const hasScheduleSelection = selectedScheduleIds.length > 0;
  const selectedScheduleTotal = selectedScheduleIds.reduce((acc, scheduleId) => acc + money(scheduleAmounts[scheduleId]), 0);
  const maxPayable = hasScheduleSelection ? selectedScheduleTotal : money(currentQuote.saldo_pendiente);

  useEffect(() => {
    if (!currentQuote.payment_schedules?.length) {
      setScheduleDraft([createEmptyInstallment()]);
      return;
    }

    setScheduleDraft(
      currentQuote.payment_schedules.map((schedule: any) => ({
        amount: money(schedule.amount).toFixed(2),
        due_date: schedule.due_date,
      })),
    );
  }, [currentQuote.id, currentQuote.payment_schedules]);

  useEffect(() => {
    if (!hasScheduleSelection) {
      setAmount(money(currentQuote.saldo_pendiente).toFixed(2));
      return;
    }

    const totalApplied = selectedScheduleIds.reduce((acc, scheduleId) => acc + money(scheduleAmounts[scheduleId]), 0);
    setAmount(totalApplied > 0 ? totalApplied.toFixed(2) : '');
  }, [currentQuote.saldo_pendiente, hasScheduleSelection, scheduleAmounts, selectedScheduleIds]);

  const selectedSchedulesSummary = useMemo(
    () => pendingSchedules.filter((schedule: any) => selectedScheduleIds.includes(schedule.id)),
    [pendingSchedules, selectedScheduleIds],
  );

  const toggleSchedule = (schedule: any) => {
    setSelectedScheduleIds((prev) => {
      if (prev.includes(schedule.id)) {
        return prev.filter((id) => id !== schedule.id);
      }

      setScheduleAmounts((current) => ({
        ...current,
        [schedule.id]: current[schedule.id] || money(schedule.saldo_pendiente).toFixed(2),
      }));
      return [...prev, schedule.id];
    });
  };

  const handleSaveSchedules = () => {
    setScheduleError(null);
    const installments = scheduleDraft
      .filter((item) => item.amount && item.due_date)
      .map((item) => ({
        amount: money(item.amount).toFixed(2),
        due_date: item.due_date,
      }));

    if (!installments.length) {
      setScheduleError('Debes definir al menos una cuota con monto y fecha.');
      return;
    }

    if (installments.some((item) => money(item.amount) <= 0)) {
      setScheduleError('Todas las cuotas deben tener un monto mayor a 0.');
      return;
    }

    createSchedules.mutate(installments, {
      onSuccess: () => {
        setIsEditingSchedules(false);
        setScheduleError(null);
      },
      onError: (error: any) => {
        setScheduleError(error?.response?.data?.installments || error?.response?.data?.detail || 'No se pudo guardar el cronograma.');
      },
    });
  };

  const handleSubmitPayment = () => {
    setLocalError(null);

    if (requiresVoucher && !voucherFile) {
      setLocalError('Debes adjuntar el comprobante para pagos digitales.');
      return;
    }

    if (money(amount) <= 0) {
      setLocalError('Debes ingresar un monto valido mayor a 0.');
      return;
    }

    if (maxPayable <= 0) {
      setLocalError('No hay saldo disponible para registrar un nuevo pago.');
      return;
    }

    if (money(amount) > maxPayable) {
      setLocalError(hasScheduleSelection ? 'El monto supera el total de las cuotas seleccionadas.' : 'El monto supera el saldo pendiente.');
      return;
    }

    const formData = new FormData();
    formData.append('amount', amount);
    formData.append('metodo_pago', metodoPago);
    if (referencia) {
      formData.append('referencia', referencia);
    }
    if (voucherFile) {
      formData.append('voucher_file', voucherFile);
    }

    if (hasScheduleSelection) {
      formData.append(
        'schedule_items',
        JSON.stringify(
          selectedSchedulesSummary.map((schedule: any) => ({
            schedule_id: schedule.id,
            amount: scheduleAmounts[schedule.id] || '0',
          })),
        ),
      );
    }

    registrarPago.mutate(formData, {
      onSuccess: () => {
        setVoucherFile(null);
        setReferencia('');
        setSelectedScheduleIds([]);
        setLocalError(null);
      },
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,22,35,0.45)] p-4 backdrop-blur-sm">
      <div className="flex max-h-[88vh] w-full max-w-6xl flex-col overflow-hidden rounded-[20px] bg-white shadow-[var(--shadow-modal)]">
        <div className="flex items-center justify-between border-b border-[var(--gray-100)] px-6 py-4">
          <div>
            <h2 className="text-[18px] font-bold text-[var(--gray-800)]">Detalles de pago</h2>
            <p className="text-sm text-[var(--gray-500)]">{currentQuote.folio} · {currentQuote.quote_type === 'DIRECT' ? 'Venta directa' : 'Cotizacion de reparacion'}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-[var(--gray-200)] text-[var(--gray-400)] transition-colors hover:border-[var(--gray-300)] hover:text-[var(--gray-700)]"
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto">
          <section className="border-b border-[var(--gray-100)] p-6">
            <div className="mb-5 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-[var(--gray-400)]">
              <ReceiptText size={16} />
              Resumen
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-[var(--gray-100)] bg-[var(--gray-50)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-bold uppercase text-[var(--gray-400)]">Total</div>
                    <div className="mt-1 text-xs text-[var(--gray-500)]">Acuerdo comercial actual</div>
                  </div>
                  <div className="text-right text-2xl font-black text-[var(--gray-800)]">S/ {money(currentQuote.total).toFixed(2)}</div>
                </div>
              </div>
              <div className="rounded-2xl border border-[var(--gray-100)] bg-[var(--gray-50)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-bold uppercase text-[var(--gray-400)]">Pagado</div>
                    <div className="mt-1 text-xs text-[var(--gray-500)]">Cobros confirmados</div>
                  </div>
                  <div className="text-right text-2xl font-black text-[var(--color-success)]">S/ {paidAmount.toFixed(2)}</div>
                </div>
              </div>
              <div className="rounded-2xl border border-[var(--gray-100)] bg-[var(--gray-50)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-bold uppercase text-[var(--gray-400)]">Restante</div>
                    <div className="mt-1 text-xs text-[var(--gray-500)]">Saldo por cobrar</div>
                  </div>
                  <div className="text-right text-2xl font-black text-[var(--color-warning)]">S/ {money(currentQuote.saldo_pendiente).toFixed(2)}</div>
                </div>
              </div>
            </div>
          </section>

          <div className="grid gap-0 xl:grid-cols-[1.1fr_1.2fr_1fr]">
          <section className="border-b border-[var(--gray-100)] p-6 xl:border-b-0 xl:border-r">
            <div className="space-y-3">
              <div className="mb-5 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-[var(--gray-400)]">
                <ReceiptText size={16} />
                Pagos registrados
              </div>
              {(currentQuote.receipts || []).length === 0 && (
                <div className="rounded-2xl border border-dashed border-[var(--gray-200)] bg-[var(--gray-50)] px-4 py-6 text-sm text-[var(--gray-500)]">
                  Aun no hay pagos registrados.
                </div>
              )}
              {(currentQuote.receipts || []).map((receipt: any) => (
                <div key={receipt.id} className="rounded-2xl border border-[var(--gray-200)] px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold text-[var(--gray-800)]">{receipt.folio}</div>
                      <div className="text-xs text-[var(--gray-500)]">{receipt.metodo_pago} · {receipt.estado}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-[var(--gray-800)]">S/ {money(receipt.amount).toFixed(2)}</div>
                      {isAdmin && receipt.estado === 'PENDING' && (
                        <Button
                          size="sm"
                          variant="secondary"
                          className="mt-2"
                          onClick={() => confirmarPago.mutate({ receiptId: receipt.id })}
                        >
                          Confirmar
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="border-b border-[var(--gray-100)] p-6 xl:border-b-0 xl:border-r">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-[var(--gray-400)]">
                <WalletCards size={16} />
                Cuotas
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsEditingSchedules((prev) => !prev)}
              >
                {isEditingSchedules ? 'Cancelar' : currentQuote.payment_schedules?.length ? 'Redefinir' : 'Configurar'}
              </Button>
            </div>

            {pendingSchedules.length > 0 ? (
              <div className="space-y-3">
                {pendingSchedules.map((schedule: any) => {
                  const active = selectedScheduleIds.includes(schedule.id);
                  return (
                    <div key={schedule.id} className={`rounded-2xl border px-4 py-3 transition-colors ${active ? 'border-[var(--color-brand-blue)] bg-[var(--color-info-bg)]' : 'border-[var(--gray-200)] bg-white'}`}>
                      <label className="flex cursor-pointer items-start gap-3">
                        <input
                          type="checkbox"
                          checked={active}
                          onChange={() => toggleSchedule(schedule)}
                          className="mt-1 h-4 w-4 rounded border-[var(--gray-300)] text-[var(--color-brand-blue)]"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-3">
                            <div className="font-semibold text-[var(--gray-800)]">Cuota {schedule.numero_cuota}</div>
                            <div className="text-sm font-bold text-[var(--gray-700)]">S/ {money(schedule.saldo_pendiente).toFixed(2)}</div>
                          </div>
                          <div className="mt-1 text-xs text-[var(--gray-500)]">Vence: {schedule.due_date}</div>
                        </div>
                      </label>

                      {active && (
                        <div className="mt-3">
                          <Label>Monto a aplicar</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={scheduleAmounts[schedule.id] || money(schedule.saldo_pendiente).toFixed(2)}
                            onChange={(event) => setScheduleAmounts((prev) => ({ ...prev, [schedule.id]: event.target.value }))}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-[var(--gray-200)] bg-[var(--gray-50)] px-4 py-6 text-sm text-[var(--gray-500)]">
                No hay cuotas definidas para esta cotizacion.
              </div>
            )}

            {isEditingSchedules && (
              <div className="mt-5 rounded-2xl border border-[var(--gray-200)] bg-[var(--gray-50)] p-4">
                <div className="mb-3 text-sm font-semibold text-[var(--gray-700)]">Editar cronograma</div>
                <div className="space-y-3">
                  {scheduleDraft.map((installment, index) => (
                    <div key={`${index}-${installment.due_date}`} className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Monto"
                        value={installment.amount}
                        onChange={(event) => {
                          const next = [...scheduleDraft];
                          next[index] = { ...next[index], amount: event.target.value };
                          setScheduleDraft(next);
                        }}
                      />
                      <Input
                        type="date"
                        value={installment.due_date}
                        onChange={(event) => {
                          const next = [...scheduleDraft];
                          next[index] = { ...next[index], due_date: event.target.value };
                          setScheduleDraft(next);
                        }}
                      />
                      <Button
                        variant="ghost"
                        onClick={() => setScheduleDraft((prev) => prev.filter((_, itemIndex) => itemIndex !== index))}
                      >
                        <X size={16} />
                      </Button>
                    </div>
                  ))}
                </div>
                {scheduleError && (
                  <div className="mt-4 flex items-center gap-2 rounded-2xl border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] px-4 py-3 text-sm text-[var(--color-danger)]">
                    <AlertTriangle size={16} />
                    {scheduleError}
                  </div>
                )}
                <div className="mt-4 flex items-center gap-2">
                  <Button
                    variant="ghost"
                    className="border border-[var(--color-info-border)] bg-[var(--color-info-bg)] text-[var(--color-brand-blue)] hover:bg-[var(--color-info-bg)] hover:opacity-90"
                    onClick={() => setScheduleDraft((prev) => [...prev, createEmptyInstallment()])}
                  >
                    <Plus size={16} className="mr-2" />
                    Agregar cuota
                  </Button>
                  <Button
                    className="border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] text-[var(--color-warning)] hover:bg-[var(--color-warning-bg)] hover:border-[var(--color-warning)] hover:opacity-90 shadow-none"
                    onClick={handleSaveSchedules}
                    disabled={createSchedules.isPending}
                  >
                    <Save size={16} className="mr-2" />
                    Guardar cuotas
                  </Button>
                </div>
              </div>
            )}
          </section>

          <section className="p-6">
            <div className="mb-5 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-[var(--gray-400)]">
              <CreditCard size={16} />
              Registrar pago
            </div>

            <div className="space-y-4">
              <div>
                <Label>Metodo de pago</Label>
                <Select value={metodoPago} onChange={(event) => setMetodoPago(event.target.value as any)}>
                  <option value="CASH">Efectivo</option>
                  <option value="YAPE">Yape</option>
                  <option value="PLIN">Plin</option>
                  <option value="TRANSFER">Transferencia</option>
                  <option value="CARD">Tarjeta</option>
                </Select>
              </div>

              <div>
                <Label>Monto a cobrar</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={amount}
                  disabled={hasScheduleSelection}
                  onChange={(event) => setAmount(event.target.value)}
                />
              </div>

              {hasScheduleSelection && (
                <div className="rounded-2xl border border-[var(--color-info-border)] bg-[var(--color-info-bg)] px-4 py-3 text-sm text-[var(--color-brand-blue)]">
                  El monto se calcula automaticamente a partir de las cuotas seleccionadas.
                </div>
              )}

              {requiresVoucher && (
                <>
                  <div>
                    <Label>Referencia</Label>
                    <Input value={referencia} onChange={(event) => setReferencia(event.target.value)} placeholder="Numero de operacion" />
                  </div>
                  <div>
                    <Label>Voucher</Label>
                    <label className={`flex min-h-[84px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-4 text-center transition-colors ${voucherFile ? 'border-[var(--color-success-border)] bg-[var(--color-success-bg)] text-[var(--color-success)]' : 'border-[var(--gray-200)] bg-[var(--gray-50)] text-[var(--gray-500)] hover:border-[var(--gray-300)]'}`}>
                      <div className="font-semibold">{voucherFile ? voucherFile.name : 'Seleccionar comprobante'}</div>
                      <div className="mt-1 text-xs">{voucherFile ? 'Archivo listo para enviar' : 'JPG, PNG o PDF'}</div>
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*,application/pdf"
                        onChange={(event) => setVoucherFile(event.target.files?.[0] || null)}
                      />
                    </label>
                  </div>
                </>
              )}

              {registrarPago.isError && (
                <div className="flex items-center gap-2 rounded-2xl border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] px-4 py-3 text-sm text-[var(--color-danger)]">
                  <AlertTriangle size={16} />
                  {(registrarPago.error as any)?.response?.data?.detail || 'No se pudo registrar el pago.'}
                </div>
              )}

              {localError && (
                <div className="flex items-center gap-2 rounded-2xl border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] px-4 py-3 text-sm text-[var(--color-danger)]">
                  <AlertTriangle size={16} />
                  {localError}
                </div>
              )}

              {requiresVoucher && !voucherFile && (
                <div className="flex items-center gap-2 rounded-2xl border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] px-3 py-2 text-xs text-[var(--color-warning)]">
                  <CheckCircle2 size={16} />
                  El pago digital se registrara como pendiente hasta su confirmacion.
                </div>
              )}

              <Button className="w-full" onClick={handleSubmitPayment} disabled={registrarPago.isPending || maxPayable <= 0}>
                {registrarPago.isPending ? 'Procesando...' : 'Registrar pago'}
              </Button>
            </div>
          </section>
          </div>
        </div>
      </div>
    </div>
  );
};
