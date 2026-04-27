import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useCustomer, useUpdateCustomer } from '../../hooks/useCustomers';
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

export default function CustomerEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const customerId = id ? parseInt(id, 10) : null;
  const { data: customer, isLoading } = useCustomer(customerId);
  const updateCustomer = useUpdateCustomer(customerId || 0);
  const [identificadorError, setIdentificadorError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CustomerForm>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      tipo_cliente: 'PERSONA',
      etiqueta: 'NUEVO',
    },
  });

  useEffect(() => {
    if (customer) {
      reset({
        tipo_cliente: customer.tipo_cliente,
        identificador: customer.identificador,
        nombre: customer.nombre,
        telefono: customer.telefono || '',
        correo_electronico: customer.correo_electronico || '',
        direccion: customer.direccion || '',
        etiqueta: customer.etiqueta,
        notas: customer.notas || '',
      });
    }
  }, [customer, reset]);

  const tipoCliente = watch('tipo_cliente');

  const onSubmit = async (data: CustomerForm) => {
    if (!customerId) return;
    try {
      setIdentificadorError(null);
      
      const payload = {
        ...data,
        telefono: data.telefono || undefined,
        correo_electronico: data.correo_electronico || undefined,
        direccion: data.direccion || undefined,
        notas: data.notas || undefined,
      };

      await updateCustomer.mutateAsync(payload);
      navigate(`/customers/${customerId}`);
    } catch (error: any) {
      if (error.response?.data?.identificador) {
        setIdentificadorError(error.response.data.identificador[0]);
      } else {
        console.error('Error updating customer:', error);
      }
    }
  };

  if (isLoading) {
    return <div className="p-12 flex justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-blue border-t-transparent"></div></div>;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(`/customers/${customerId}`)}
            className="p-3 rounded-2xl hover:bg-slate-200 border border-transparent hover:border-slate-300 text-slate-500 transition-all bg-white shadow-sm"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Editar Cliente</h1>
            <p className="text-slate-500 mt-1 font-medium">Modifica los datos del cliente</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="bg-white rounded-lg shadow border border-slate-200 p-8">
          <div className="grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-6">
            
            <div className="sm:col-span-3">
              <label htmlFor="tipo_cliente" className="block text-sm font-medium text-gray-700">Tipo de Cliente</label>
              <select
                id="tipo_cliente"
                {...register('tipo_cliente')}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              >
                <option value="PERSONA">Persona Natural (DNI)</option>
                <option value="EMPRESA">Empresa (RUC)</option>
              </select>
            </div>

            <div className="sm:col-span-3">
              <label htmlFor="identificador" className="block text-sm font-medium text-gray-700">
                {tipoCliente === 'PERSONA' ? 'DNI' : 'RUC'} *
              </label>
              <input
                type="text"
                id="identificador"
                {...register('identificador')}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              />
              {errors.identificador && <p className="mt-2 text-sm text-red-500 font-medium">{errors.identificador.message}</p>}
              {identificadorError && <p className="mt-2 text-sm text-red-500 font-medium">{identificadorError}</p>}
            </div>

            <div className="sm:col-span-6">
              <label htmlFor="nombre" className="block text-sm font-medium text-gray-700">
                {tipoCliente === 'PERSONA' ? 'Nombre Completo' : 'Razón Social'} *
              </label>
              <input
                type="text"
                id="nombre"
                {...register('nombre')}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              />
              {errors.nombre && <p className="mt-2 text-sm text-red-500 font-medium">{errors.nombre.message}</p>}
            </div>

            <div className="sm:col-span-3">
              <label htmlFor="telefono" className="block text-sm font-medium text-gray-700">Teléfono / Celular</label>
              <input
                type="text"
                id="telefono"
                {...register('telefono')}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              />
            </div>

            <div className="sm:col-span-3">
              <label htmlFor="correo_electronico" className="block text-sm font-medium text-gray-700">Correo Electrónico</label>
              <input
                type="email"
                id="correo_electronico"
                {...register('correo_electronico')}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              />
              {errors.correo_electronico && <p className="mt-2 text-sm text-red-500 font-medium">{errors.correo_electronico.message}</p>}
            </div>

            <div className="sm:col-span-6">
              <label htmlFor="direccion" className="block text-sm font-medium text-gray-700">Dirección</label>
              <input
                type="text"
                id="direccion"
                {...register('direccion')}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              />
            </div>

            <div className="sm:col-span-3">
              <label htmlFor="etiqueta" className="block text-sm font-medium text-gray-700">Etiqueta del Cliente</label>
              <select
                id="etiqueta"
                {...register('etiqueta')}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              >
                <option value="NUEVO">NUEVO</option>
                <option value="REGULAR">REGULAR</option>
                <option value="FRECUENTE">FRECUENTE</option>
                <option value="VIP">VIP</option>
                <option value="MOROSO">MOROSO</option>
                <option value="ESPECIAL">ESPECIAL</option>
              </select>
            </div>

            <div className="sm:col-span-6">
              <label htmlFor="notas" className="block text-sm font-medium text-gray-700">Notas internas</label>
              <textarea
                id="notas"
                rows={3}
                {...register('notas')}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-x-4">
          <button
            type="button"
            onClick={() => navigate(`/customers/${customerId}`)}
            className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex justify-center items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
          >
            <Save size={18} className="mr-2" />
            {isSubmitting ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      </form>
    </div>
  );
}
