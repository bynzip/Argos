import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useCreateDevice } from '../../hooks/useCustomers';
import { X, Smartphone, Save } from 'lucide-react';

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

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<DeviceForm>({
    resolver: zodResolver(deviceSchema),
  });

  const onSubmit = async (data: DeviceForm) => {
    try {
      await createDevice.mutateAsync(data);
      onClose();
    } catch (error) {
      console.error('Error adding device:', error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="surface-card w-full max-w-lg shadow-2xl animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between border-b border-slate-100 p-6 bg-slate-50/50 rounded-t-3xl">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Smartphone className="text-brand-blue" size={24} />
            Registrar Nuevo Equipo
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-xl text-slate-400 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-8 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 sm:col-span-1">
              <label className="field-label">Tipo de Equipo *</label>
              <input 
                {...register('tipo_equipo')} 
                className="field-input w-full" 
                placeholder="Ej. Laptop, PC, Celular"
              />
              {errors.tipo_equipo && <p className="mt-1 text-xs text-red-500 font-medium">{errors.tipo_equipo.message}</p>}
            </div>
            
            <div className="col-span-2 sm:col-span-1">
              <label className="field-label">Marca *</label>
              <input 
                {...register('marca')} 
                className="field-input w-full" 
                placeholder="Ej. Lenovo, Samsung"
              />
              {errors.marca && <p className="mt-1 text-xs text-red-500 font-medium">{errors.marca.message}</p>}
            </div>

            <div className="col-span-2">
              <label className="field-label">Modelo *</label>
              <input 
                {...register('modelo')} 
                className="field-input w-full" 
                placeholder="Ej. ThinkPad T480, Galaxy S23"
              />
              {errors.modelo && <p className="mt-1 text-xs text-red-500 font-medium">{errors.modelo.message}</p>}
            </div>

            <div className="col-span-2">
              <label className="field-label">Número de Serie</label>
              <input 
                {...register('numero_serie')} 
                className="field-input w-full" 
                placeholder="S/N o Service Tag"
              />
            </div>

            <div className="col-span-2">
              <label className="field-label">Notas del equipo</label>
              <textarea 
                {...register('notas')} 
                rows={2} 
                className="field-input w-full" 
                placeholder="Ej. Color gris, teclado en inglés..."
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="secondary-button text-sm py-2">
              Cancelar
            </button>
            <button 
              type="submit" 
              disabled={isSubmitting} 
              className="primary-button text-sm py-2 px-8"
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
