import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useCreateTicket } from '../../hooks/useTickets';
import { useCustomers, useCustomer } from '../../hooks/useCustomers';
import { MultiImageUpload } from '../../components/ui/MultiImageUpload';
import { Plus, Trash2 } from 'lucide-react';

const accessorySchema = z.object({
  nombre: z.string().min(1, 'Requerido'),
  condicion: z.string().optional(),
  notas: z.string().optional()
});

const formSchema = z.object({
  customer_id: z.string().min(1, 'Debe seleccionar un cliente'),
  device_id: z.string().optional(),
  descripcion_problema: z.string().min(5, 'La descripción debe tener al menos 5 caracteres'),
  prioridad: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  accessories: z.array(accessorySchema).optional()
});

type FormData = z.infer<typeof formSchema>;

const TicketFormPage = () => {
  const navigate = useNavigate();
  const createMutation = useCreateTicket();
  const { data: customers } = useCustomers();
  const [files, setFiles] = useState<File[]>([]);
  
  const { register, control, handleSubmit, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      prioridad: 'LOW',
      accessories: []
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "accessories"
  });

  const selectedCustomerId = watch("customer_id");
  // Fetch detailed customer info to get devices
  const { data: selectedCustomerDetail } = useCustomer(
    selectedCustomerId ? parseInt(selectedCustomerId) : null
  );
  
  const devices = selectedCustomerDetail?.devices || [];

  const onSubmit = async (data: FormData) => {
    const formData = new FormData();
    formData.append('customer_id', data.customer_id);
    formData.append('descripcion_problema', data.descripcion_problema);
    formData.append('prioridad', data.prioridad);
    
    if (data.device_id) {
      formData.append('device_id', data.device_id);
    }
    
    if (data.accessories && data.accessories.length > 0) {
      formData.append('accessories', JSON.stringify(data.accessories));
    }
    
    files.forEach(file => {
      formData.append('evidences', file);
    });

    createMutation.mutate(formData, {
      onSuccess: (result) => {
        navigate(`/tickets/${result.id}`);
      }
    });
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Nuevo Ticket de Reparación</h1>
      
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 bg-white p-6 rounded-lg shadow">
        
        {/* Información Principal */}
        <div className="space-y-4">
          <h2 className="text-lg font-medium text-gray-900 border-b pb-2">Información del Cliente y Equipo</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Cliente *</label>
              <select 
                {...register('customer_id')}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="">Seleccione un cliente</option>
                {customers?.map(c => (
                  <option key={c.id} value={c.id}>{c.nombre} ({c.identificador})</option>
                ))}
              </select>
              {errors.customer_id && <p className="mt-1 text-sm text-red-600">{errors.customer_id.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Dispositivo (Opcional)</label>
              <select 
                {...register('device_id')}
                disabled={!selectedCustomerId || devices.length === 0}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100"
              >
                <option value="">Seleccione un dispositivo</option>
                {devices.map(d => (
                  <option key={d.id} value={d.id}>{d.marca} {d.modelo} {d.numero_serie ? `(${d.numero_serie})` : ''}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Descripción del Problema (En palabras del cliente) *</label>
            <textarea 
              {...register('descripcion_problema')}
              rows={4}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
            {errors.descripcion_problema && <p className="mt-1 text-sm text-red-600">{errors.descripcion_problema.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Prioridad</label>
            <select 
              {...register('prioridad')}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="LOW">Baja</option>
              <option value="MEDIUM">Media</option>
              <option value="HIGH">Alta</option>
              <option value="CRITICAL">Crítica</option>
            </select>
          </div>
        </div>

        {/* Accesorios */}
        <div className="space-y-4">
          <div className="flex justify-between items-center border-b pb-2">
            <h2 className="text-lg font-medium text-gray-900">Accesorios Entregados</h2>
            <button
              type="button"
              onClick={() => append({ nombre: '', condicion: '', notas: '' })}
              className="inline-flex items-center px-3 py-1 border border-transparent text-sm leading-4 font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200"
            >
              <Plus className="mr-1 h-4 w-4" /> Agregar Accesorio
            </button>
          </div>
          
          {fields.map((field, index) => (
            <div key={field.id} className="flex gap-4 items-start bg-gray-50 p-3 rounded-md">
              <div className="flex-1">
                <input
                  {...register(`accessories.${index}.nombre` as const)}
                  placeholder="Ej: Cargador original"
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
                {errors.accessories?.[index]?.nombre && (
                  <p className="mt-1 text-xs text-red-600">{errors.accessories[index]?.nombre?.message}</p>
                )}
              </div>
              <div className="flex-1">
                <input
                  {...register(`accessories.${index}.condicion` as const)}
                  placeholder="Ej: Cable pelado"
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
              </div>
              <button
                type="button"
                onClick={() => remove(index)}
                className="p-2 text-red-600 hover:bg-red-50 rounded-md"
              >
                <Trash2 className="h-5 w-5" />
              </button>
            </div>
          ))}
          {fields.length === 0 && <p className="text-sm text-gray-500 italic">No se han registrado accesorios.</p>}
        </div>

        {/* Evidencias (Fotos) */}
        <div className="space-y-4">
          <h2 className="text-lg font-medium text-gray-900 border-b pb-2">Evidencias Fotográficas</h2>
          <MultiImageUpload onFilesChange={setFiles} maxFiles={15} />
        </div>

        {/* Submit */}
        <div className="flex justify-end pt-4 border-t">
          <button
            type="button"
            onClick={() => navigate('/tickets')}
            className="mr-3 px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="inline-flex justify-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
          >
            {createMutation.isPending ? 'Guardando...' : 'Crear Ticket'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default TicketFormPage;
