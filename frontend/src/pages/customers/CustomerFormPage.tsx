import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useCreateCustomer } from '../../hooks/useCustomers';
import { ArrowLeft, Save } from 'lucide-react';

const customerSchema = z.object({
  tipo_cliente: z.enum(['PERSONA', 'EMPRESA']),
  identificador: z.string().min(8, 'Debe tener al menos 8 caracteres'),
  nombre: z.string().min(2, 'El nombre es obligatorio'),
  telefono: z.string().optional(),
  correo_electronico: z.string().email('Correo inválido').optional().or(z.literal('')),
  direccion: z.string().optional(),
  etiqueta: z.enum(['NUEVO', 'REGULAR', 'FRECUENTE', 'VIP', 'MOROSO', 'ESPECIAL']),
  notas: z.string().optional(),
});

type CustomerForm = z.infer<typeof customerSchema>;

export default function CustomerFormPage() {
  const navigate = useNavigate();
  const createCustomer = useCreateCustomer();
  const [identificadorError, setIdentificadorError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CustomerForm>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      tipo_cliente: 'PERSONA',
      etiqueta: 'NUEVO',
    },
  });

  const tipoCliente = watch('tipo_cliente');

  const onSubmit = async (data: CustomerForm) => {
    try {
      setIdentificadorError(null);
      
      const payload = {
        ...data,
        telefono: data.telefono || undefined,
        correo_electronico: data.correo_electronico || undefined,
        direccion: data.direccion || undefined,
        notas: data.notas || undefined,
      };

      const newCustomer = await createCustomer.mutateAsync(payload);
      navigate(`/customers/${newCustomer.id}`);
    } catch (error: any) {
      if (error.response?.data?.identificador) {
        setIdentificadorError(error.response.data.identificador[0]);
      } else {
        console.error('Error creating customer:', error);
      }
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/customers')}
            className="p-3 rounded-2xl hover:bg-slate-200 border border-transparent hover:border-slate-300 text-slate-500 transition-all bg-white shadow-sm"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Nuevo Cliente</h1>
            <p className="muted-copy mt-1 font-medium">Registra un nuevo cliente en el sistema</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="surface-card p-8">
          <div className="grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-6">
            
            <div className="sm:col-span-3">
              <label htmlFor="tipo_cliente" className="field-label">Tipo de Cliente</label>
              <select
                id="tipo_cliente"
                {...register('tipo_cliente')}
                className="field-input w-full"
              >
                <option value="PERSONA">Persona Natural (DNI)</option>
                <option value="EMPRESA">Empresa (RUC)</option>
              </select>
            </div>

            <div className="sm:col-span-3">
              <label htmlFor="identificador" className="field-label">
                {tipoCliente === 'PERSONA' ? 'DNI' : 'RUC'} *
              </label>
              <input
                type="text"
                id="identificador"
                {...register('identificador')}
                className="field-input w-full"
              />
              {errors.identificador && <p className="mt-2 text-sm text-red-500 font-medium">{errors.identificador.message}</p>}
              {identificadorError && <p className="mt-2 text-sm text-red-500 font-medium">{identificadorError}</p>}
            </div>

            <div className="sm:col-span-6">
              <label htmlFor="nombre" className="field-label">
                {tipoCliente === 'PERSONA' ? 'Nombre Completo' : 'Razón Social'} *
              </label>
              <input
                type="text"
                id="nombre"
                {...register('nombre')}
                className="field-input w-full"
              />
              {errors.nombre && <p className="mt-2 text-sm text-red-500 font-medium">{errors.nombre.message}</p>}
            </div>

            <div className="sm:col-span-3">
              <label htmlFor="telefono" className="field-label">Teléfono / Celular</label>
              <input
                type="text"
                id="telefono"
                {...register('telefono')}
                className="field-input w-full"
              />
            </div>

            <div className="sm:col-span-3">
              <label htmlFor="correo_electronico" className="field-label">Correo Electrónico</label>
              <input
                type="email"
                id="correo_electronico"
                {...register('correo_electronico')}
                className="field-input w-full"
              />
              {errors.correo_electronico && <p className="mt-2 text-sm text-red-500 font-medium">{errors.correo_electronico.message}</p>}
            </div>

            <div className="sm:col-span-6">
              <label htmlFor="direccion" className="field-label">Dirección</label>
              <input
                type="text"
                id="direccion"
                {...register('direccion')}
                className="field-input w-full"
              />
            </div>

            <div className="sm:col-span-6">
              <label htmlFor="notas" className="field-label">Notas internas</label>
              <textarea
                id="notas"
                rows={3}
                {...register('notas')}
                className="field-input w-full"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-x-4">
          <button
            type="button"
            onClick={() => navigate('/customers')}
            className="secondary-button text-sm"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="primary-button text-sm"
          >
            <Save size={18} />
            {isSubmitting ? 'Guardando...' : 'Guardar Cliente'}
          </button>
        </div>
      </form>
    </div>
  );
}
