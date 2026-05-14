import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { AlertTriangle, CheckCircle2, CreditCard, UploadCloud, X } from 'lucide-react';

import { useRegistrarPago } from '../../hooks/useFinance';
import { cn } from '../../lib/utils';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { Select } from '../ui/Select';

const paymentSchema = z.object({
  amount: z.string().min(1, 'El monto es obligatorio').refine(
    (val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0,
    'Debe ser un número mayor a 0'
  ),
  metodo_pago: z.enum(['CASH', 'TRANSFER', 'CARD', 'YAPE', 'PLIN']),
  referencia: z.string().optional(),
});

type FormData = z.infer<typeof paymentSchema>;

interface Props {
  ticketId: string;
  saldoPendiente: number;
  onClose: () => void;
}

export const PaymentModal: React.FC<Props> = ({ ticketId, saldoPendiente, onClose }) => {
  const registrarMutation = useRegistrarPago(ticketId);
  const [voucherFile, setVoucherFile] = useState<File | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors }
  } = useForm<FormData>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      amount: saldoPendiente.toFixed(2),
      metodo_pago: 'CASH'
    }
  });

  const selectedMethod = watch('metodo_pago');
  const requiresVoucher = selectedMethod !== 'CASH';

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setVoucherFile(e.target.files[0]);
    }
  };

  const onSubmit = (data: FormData) => {
    if (requiresVoucher && !voucherFile) {
      alert('Es obligatorio adjuntar el voucher para pagos digitales.');
      return;
    }

    if (parseFloat(data.amount) > saldoPendiente) {
      alert('El monto ingresado es mayor al saldo pendiente.');
      return;
    }

    const formData = new FormData();
    formData.append('amount', data.amount);
    formData.append('metodo_pago', data.metodo_pago);
    if (data.referencia) {
      formData.append('referencia', data.referencia);
    }
    if (voucherFile) {
      formData.append('voucher_file', voucherFile);
    }

    registrarMutation.mutate(formData, {
      onSuccess: () => {
        onClose();
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,22,35,0.45)] backdrop-blur-sm p-4">
      <div className="bg-white rounded-[16px] shadow-[var(--shadow-modal)] w-full max-w-md overflow-hidden flex flex-col">
        <div className="flex justify-between items-center px-6 py-4 border-b border-[var(--gray-100)]">
          <h2 className="text-[17px] font-bold text-[var(--gray-800)]">Registrar Cobro</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--gray-400)] hover:bg-[var(--gray-100)] hover:text-[var(--gray-700)] transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="px-6 py-4 bg-[var(--color-warning-bg)] border-b border-[var(--color-warning-border)] flex justify-between items-center">
          <div className="flex items-center gap-2">
            <CreditCard size={16} className="text-[var(--color-warning)]" />
            <span className="text-[13px] text-[var(--color-warning)] font-bold uppercase tracking-tight">
              Saldo Pendiente
            </span>
          </div>
          <span className="text-xl font-black text-[var(--color-warning)]">S/ {saldoPendiente.toFixed(2)}</span>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
          <div className="space-y-1.5">
            <Label required>Método de Pago</Label>
            <Select {...register('metodo_pago')}>
              <option value="CASH">Efectivo (Confirmación Automática)</option>
              <option value="YAPE">Yape</option>
              <option value="PLIN">Plin</option>
              <option value="TRANSFER">Transferencia Bancaria</option>
              <option value="CARD">Tarjeta (POS)</option>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label required>Monto a Cobrar (S/)</Label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--gray-400)] font-bold">S/</span>
              <Input {...register('amount')} type="number" step="0.01" className="pl-9 font-bold text-lg" />
            </div>
            {errors.amount && <span className="form-error">{errors.amount.message}</span>}
          </div>

          {requiresVoucher && (
            <div className="space-y-4 p-5 rounded-2xl bg-[var(--gray-50)] border border-[var(--gray-200)] shadow-inner">
              <div className="p-3 bg-[var(--color-warning-bg)] border border-[var(--color-warning-border)] rounded-lg text-[12px] text-[var(--color-warning)] font-medium">
                Este pago digital se registrará como pendiente. No reducirá el saldo del ticket hasta que sea confirmado manualmente.
              </div>

              <div className="space-y-1.5">
                <Label required>N° de Operación / Referencia</Label>
                <Input {...register('referencia')} type="text" placeholder="Ej: 12345678" />
              </div>

              <div className="space-y-1.5">
                <Label required>Voucher / Comprobante</Label>
                <label
                  className={cn(
                    'flex flex-col items-center justify-center w-full h-28 border-2 border-dashed rounded-xl cursor-pointer transition-all',
                    voucherFile
                      ? 'bg-[var(--color-success-bg)] border-[var(--color-success-border)]'
                      : 'bg-white border-[var(--color-info-border)] hover:bg-[var(--color-info-bg)]'
                  )}
                >
                  <div className="flex flex-col items-center justify-center text-center px-4">
                    {voucherFile ? (
                      <>
                        <CheckCircle2 className="w-8 h-8 mb-2 text-[var(--color-success)]" />
                        <p className="text-[12px] text-[var(--color-success)] font-bold truncate max-w-full">
                          {voucherFile.name}
                        </p>
                      </>
                    ) : (
                      <>
                        <UploadCloud className="w-8 h-8 mb-2 text-[var(--color-info)]" />
                        <p className="text-[12px] text-[var(--color-info)] font-bold">
                          Click para subir imagen del voucher
                        </p>
                        <p className="text-[10px] text-[var(--gray-400)] mt-1 font-medium">
                          JPG, PNG o PDF (Máx. 5MB)
                        </p>
                      </>
                    )}
                  </div>
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*,application/pdf"
                    onChange={handleFileChange}
                  />
                </label>
              </div>
            </div>
          )}

          {registrarMutation.isError && (
            <div className="p-4 bg-[var(--color-danger-bg)] border border-[var(--color-danger-border)] rounded-xl flex items-center gap-2 text-[var(--color-danger)] text-xs font-bold">
              <AlertTriangle size={16} />
              {(registrarMutation.error as any)?.response?.data?.detail || 'No se pudo registrar el pago. Verifica los datos.'}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-[var(--gray-100)]">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={registrarMutation.isPending} variant="primary" className="px-6">
              {registrarMutation.isPending ? 'Procesando...' : 'Confirmar Cobro'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
