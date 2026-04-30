import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useCreateTicket } from '../../hooks/useTickets';
import { useCustomers, useCustomer } from '../../hooks/useCustomers';
import { MultiImageUpload } from '../../components/ui/MultiImageUpload';
import { Plus, Trash2, ArrowLeft, User, Smartphone, ClipboardList, Camera, PackagePlus } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Label } from '../../components/ui/Label';
import { Select } from '../../components/ui/Select';
import { Textarea } from '../../components/ui/Textarea';
// import { cn } from '../../lib/utils';

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
  const { data: customersResponse } = useCustomers();
  const customers = Array.isArray(customersResponse) 
    ? customersResponse 
    : customersResponse?.results || [];
    
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
    <div className="p-8 max-w-[1000px] mx-auto">
      <div className="mb-8">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => navigate('/tickets')}
          className="mb-4 text-[var(--gray-500)]"
        >
          <ArrowLeft size={16} className="mr-2" />
          Volver a la lista
        </Button>
        <PageHeader 
          title="Nuevo Ticket de Reparación"
          subtitle="Registra el ingreso de un nuevo equipo al taller para diagnóstico."
        />
      </div>
      
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        
        <div className="form-card">
          <div className="form-section-title flex items-center gap-2">
            <User size={16} /> Información del Cliente y Equipo
          </div>
          
          <div className="form-grid-2">
            <div className="form-field">
              <Label required>Cliente / Solicitante</Label>
              <Select 
                {...register('customer_id')}
                error={!!errors.customer_id}
              >
                <option value="">Seleccione un cliente...</option>
                {customers?.map(c => (
                  <option key={c.id} value={c.id}>{c.nombre} ({c.identificador})</option>
                ))}
              </Select>
              {errors.customer_id && <span className="form-error">{errors.customer_id.message}</span>}
            </div>

            <div className="form-field">
              <Label>
                <div className="flex items-center gap-1.5">
                  <Smartphone size={14} className="text-[var(--gray-400)]" />
                  Dispositivo (Opcional)
                </div>
              </Label>
              <Select 
                {...register('device_id')}
                disabled={!selectedCustomerId || devices.length === 0}
              >
                <option value="">Seleccione un dispositivo...</option>
                {devices.map(d => (
                  <option key={d.id} value={d.id}>{d.marca} {d.modelo} {d.numero_serie ? `(${d.numero_serie})` : ''}</option>
                ))}
              </Select>
              {!selectedCustomerId && <p className="text-[11px] text-[var(--gray-400)] mt-1">Primero seleccione un cliente.</p>}
              {selectedCustomerId && devices.length === 0 && <p className="text-[11px] text-[var(--color-warning)] mt-1 font-medium">Este cliente no tiene equipos registrados.</p>}
            </div>

            <div className="form-field form-grid-full mt-2">
              <Label required>
                <div className="flex items-center gap-1.5">
                  <ClipboardList size={14} className="text-[var(--gray-400)]" />
                  Descripción del Problema
                </div>
              </Label>
              <Textarea 
                {...register('descripcion_problema')}
                placeholder="Ej. La pantalla parpadea y el equipo se apaga solo después de 10 minutos de uso..."
                error={!!errors.descripcion_problema}
                rows={4}
              />
              {errors.descripcion_problema && <span className="form-error">{errors.descripcion_problema.message}</span>}
              <p className="text-[11px] text-[var(--gray-400)] mt-1">Describa fielmente el fallo reportado por el cliente.</p>
            </div>

            <div className="form-field">
              <Label required>Prioridad Inicial</Label>
              <Select {...register('prioridad')}>
                <option value="LOW">Baja (Normal)</option>
                <option value="MEDIUM">Media</option>
                <option value="HIGH">Alta</option>
                <option value="CRITICAL">Crítica (Urgente)</option>
              </Select>
            </div>
          </div>

          <div className="form-section-title mt-12 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PackagePlus size={16} /> Accesorios Entregados
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => append({ nombre: '', condicion: '', notas: '' })}
              className="h-8 text-xs font-bold"
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Agregar Fila
            </Button>
          </div>

          <div className="space-y-3">
            {fields.map((field, index) => (
              <div key={field.id} className="flex gap-3 items-start p-4 bg-[var(--gray-50)] rounded-xl border border-[var(--gray-100)] group transition-all hover:border-[var(--gray-300)]">
                <div className="flex-1 space-y-1.5">
                  <Input
                    {...register(`accessories.${index}.nombre` as const)}
                    placeholder="Ej. Cargador original"
                    error={!!errors.accessories?.[index]?.nombre}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="flex-1 space-y-1.5">
                  <Input
                    {...register(`accessories.${index}.condicion` as const)}
                    placeholder="Estado (ej. Rayado)"
                    className="h-9 text-sm"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => remove(index)}
                  className="text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)] h-9 w-9 shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {fields.length === 0 && (
              <div className="text-center py-10 border-2 border-dashed border-[var(--gray-200)] rounded-2xl bg-[var(--gray-50)]/50">
                <p className="text-[13px] text-[var(--gray-400)] font-medium italic">No se han registrado accesorios para este ticket.</p>
              </div>
            )}
          </div>

          <div className="form-section-title mt-12 flex items-center gap-2">
            <Camera size={16} /> Evidencias Fotográficas
          </div>
          <div className="p-1">
            <MultiImageUpload onFilesChange={setFiles} maxFiles={15} />
            <p className="text-[11px] text-[var(--gray-400)] mt-3">Puede adjuntar hasta 15 fotos del estado físico del equipo al ingresar.</p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4">
          <Button
            type="button"
            variant="ghost"
            onClick={() => navigate('/tickets')}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={createMutation.isPending}
            className="px-10 h-11"
          >
            {createMutation.isPending ? 'Procesando...' : '💾 Crear Ticket de Reparación'}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default TicketFormPage;
