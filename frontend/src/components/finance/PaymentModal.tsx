import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRegistrarPago } from '../../hooks/useFinance';
import { X, UploadCloud } from 'lucide-react';

const paymentSchema = z.object({
  amount: z.string().min(1, 'El monto es obligatorio').refine(val => !isNaN(parseFloat(val)) && parseFloat(val) > 0, 'Debe ser un número mayor a 0'),
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

  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      amount: saldoPendiente.toFixed(2),
      metodo_pago: 'CASH'
    }
  });

  const selectedMethod = watch('metodo_pago');
  const requiresVoucher = ['TRANSFER', 'YAPE', 'PLIN'].includes(selectedMethod);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setVoucherFile(e.target.files[0]);
    }
  };

  const onSubmit = (data: FormData) => {
    if (requiresVoucher && !voucherFile) {
      alert("Es obligatorio adjuntar el voucher para pagos digitales.");
      return;
    }

    if (parseFloat(data.amount) > saldoPendiente) {
      alert("El monto ingresado es mayor al saldo pendiente.");
      return;
    }

    const formData = new FormData();
    formData.append('amount', data.amount);
    formData.append('metodo_pago', data.metodo_pago);
    if (data.referencia) formData.append('referencia', data.referencia);
    if (voucherFile) formData.append('voucher_file', voucherFile);

    registrarMutation.mutate(formData, {
      onSuccess: () => {
        onClose();
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-lg font-bold text-gray-900">Registrar Cobro</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
        </div>
        
        <div className="p-4 bg-amber-50 border-b border-amber-100 flex justify-between items-center">
          <span className="text-sm text-amber-800 font-medium">Saldo Pendiente:</span>
          <span className="text-xl font-bold text-amber-600">S/ {saldoPendiente.toFixed(2)}</span>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Método de Pago</label>
            <select 
              {...register('metodo_pago')}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="CASH">Efectivo (Confirmación Automática)</option>
              <option value="YAPE">Yape</option>
              <option value="PLIN">Plin</option>
              <option value="TRANSFER">Transferencia Bancaria</option>
              <option value="CARD">Tarjeta (POS)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Monto a Cobrar (S/)</label>
            <input 
              {...register('amount')}
              type="number"
              step="0.01"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
            {errors.amount && <p className="text-xs text-red-500 mt-1">{errors.amount.message}</p>}
          </div>

          {requiresVoucher && (
            <div className="space-y-4 p-4 border rounded-md bg-gray-50">
              <div>
                <label className="block text-sm font-medium text-gray-700">N° de Operación / Referencia *</label>
                <input 
                  {...register('referencia')}
                  type="text"
                  required
                  placeholder="Ej: 12345678"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Voucher / Comprobante *</label>
                <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-blue-300 border-dashed rounded-md cursor-pointer bg-blue-50 hover:bg-blue-100 transition">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <UploadCloud className="w-6 h-6 mb-1 text-blue-500" />
                    <p className="text-xs text-blue-600 font-medium">
                      {voucherFile ? voucherFile.name : 'Click para subir voucher'}
                    </p>
                  </div>
                  <input type="file" className="hidden" accept="image/*,application/pdf" onChange={handleFileChange} />
                </label>
              </div>
            </div>
          )}

          {registrarMutation.isError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-600">
              Error al registrar: {(registrarMutation.error as any)?.response?.data?.detail || 'Revisa los datos ingresados.'}
            </div>
          )}

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={registrarMutation.isPending}
              className="px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
            >
              {registrarMutation.isPending ? 'Procesando...' : 'Confirmar Cobro'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
