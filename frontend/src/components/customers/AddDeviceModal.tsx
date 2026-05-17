import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useState } from 'react';
import { useCreateDevice } from '../../hooks/useCustomers';
import { X, Smartphone, Save } from 'lucide-react';
import { getApiErrorMessage } from '../../lib/apiErrors';

const deviceSchema = z.object({
  tipo_equipo: z.string().min(1, 'El tipo es requerido'),
  marca: z.string().min(1, 'La marca es requerida'),
  modelo: z.string().min(1, 'El modelo es requerido'),
  numero_serie: z.string().optional(),
  notas: z.string().optional(),
});

type DeviceForm = z.infer<typeof deviceSchema>;

interface AddDeviceModalProps {
  customerId: number;
  onClose: () => void;
}

export default function AddDeviceModal({ customerId, onClose }: AddDeviceModalProps) {
  const createDevice = useCreateDevice(customerId);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<DeviceForm>({
    resolver: zodResolver(deviceSchema),
  });

  const onSubmit = async (data: DeviceForm) => {
    try {
      setSubmitError(null);
      await createDevice.mutateAsync(data);
      onClose();
    } catch (error: any) {
      setSubmitError(getApiErrorMessage(error, 'No se pudo registrar el equipo.'));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,22,35,0.45)] backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-[var(--shadow-modal)] animate-in fade-in zoom-in duration-200 overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--gray-200)] p-5 bg-white">
          <h2 className="text-[17px] font-bold text-[var(--gray-800)] flex items-center gap-2">
            <Smartphone className="text-[var(--color-brand-blue)]" size={20} />
            Registrar Nuevo Equipo
          </h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-[var(--gray-100)] text-[var(--gray-500)] hover:bg-[var(--gray-200)] hover:text-[var(--gray-700)] transition-colors flex items-center justify-center">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-5">
          {submitError && (
            <div className="rounded-xl border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] px-4 py-3 text-sm font-medium text-[var(--color-danger)]">
              {submitError}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 sm:col-span-1">
              <label className="form-label">Tipo de Equipo *</label>
              <input 
                {...register('tipo_equipo')} 
                className="form-input w-full" 
                placeholder="Ej. Laptop, PC, Celular"
              />
              {errors.tipo_equipo && <p className="mt-1 text-xs text-[var(--color-danger)] font-medium">{errors.tipo_equipo.message}</p>}
            </div>
            
            <div className="col-span-2 sm:col-span-1">
              <label className="form-label">Marca *</label>
              <input 
                {...register('marca')} 
                className="form-input w-full" 
                placeholder="Ej. Lenovo, Samsung"
              />
              {errors.marca && <p className="mt-1 text-xs text-[var(--color-danger)] font-medium">{errors.marca.message}</p>}
            </div>

            <div className="col-span-2">
              <label className="form-label">Modelo *</label>
              <input 
                {...register('modelo')} 
                className="form-input w-full" 
                placeholder="Ej. ThinkPad T480, Galaxy S23"
              />
              {errors.modelo && <p className="mt-1 text-xs text-[var(--color-danger)] font-medium">{errors.modelo.message}</p>}
            </div>

            <div className="col-span-2">
              <label className="form-label">Número de Serie</label>
              <input 
                {...register('numero_serie')} 
                className="form-input w-full" 
                placeholder="S/N o Service Tag"
              />
            </div>

            <div className="col-span-2">
              <label className="form-label">Notas del equipo</label>
              <textarea 
                {...register('notas')} 
                rows={2} 
                className="form-input w-full p-3 h-auto" 
                placeholder="Ej. Color gris, teclado en inglés..."
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[var(--gray-100)]">
            <button type="button" onClick={onClose} className="btn-secondary text-sm">
              Cancelar
            </button>
            <button 
              type="submit" 
              disabled={isSubmitting} 
              className="btn-primary text-sm"
            >
              <Save size={18} />
              {isSubmitting ? 'Registrando...' : 'Registrar Equipo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
