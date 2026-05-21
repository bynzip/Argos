import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useCreateTicket, useCreateWarrantyTicket, useTicket, useTickets, PaginatedResponse, Ticket } from '../../hooks/useTickets';
import { useCustomers, useCustomer } from '../../hooks/useCustomers';
import { MultiImageUpload } from '../../components/ui/MultiImageUpload';
import { Plus, Trash2, ArrowLeft, User, Smartphone, ClipboardList, Camera, PackagePlus, ShieldAlert } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Label } from '../../components/ui/Label';
import { Select } from '../../components/ui/Select';
import { Textarea } from '../../components/ui/Textarea';
import { getApiErrorMessage, resolveMediaUrl } from '../../lib/apiErrors';

const accessorySchema = z.object({
  nombre: z.string().min(1, 'Requerido'),
  condicion: z.string().optional(),
  notas: z.string().optional(),
});

const formSchema = z.object({
  customer_id: z.string().optional(),
  device_id: z.string().optional(),
  source_ticket_id: z.string().optional(),
  descripcion_problema: z.string().min(5, 'La descripcion debe tener al menos 5 caracteres'),
  prioridad: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  accessories: z.array(accessorySchema).optional(),
});

type TicketFormValues = z.infer<typeof formSchema>;
type PriorityOption = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

const TicketFormPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isWarrantyMode = searchParams.get('mode') === 'warranty';

  const createTicketMutation = useCreateTicket();
  const createWarrantyMutation = useCreateWarrantyTicket();
  const { data: customersResponse } = useCustomers();
  const { data: ticketsResponse, isLoading: isLoadingWarrantyTickets } = useTickets(
    isWarrantyMode ? { page_size: 200 } : undefined,
  );
  const customers = Array.isArray(customersResponse)
    ? customersResponse
    : customersResponse?.results || [];

  const availableWarrantyTickets = useMemo(() => {
    if (!isWarrantyMode) return [];
    const rawTickets = ticketsResponse && typeof ticketsResponse === 'object' && !Array.isArray(ticketsResponse)
      ? (ticketsResponse as PaginatedResponse<Ticket>).results
      : Array.isArray(ticketsResponse) ? ticketsResponse : [];
    return rawTickets.filter((ticket) => !ticket.es_garantia);
  }, [isWarrantyMode, ticketsResponse]);

  const [files, setFiles] = useState<File[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [inheritedEvidences, setInheritedEvidences] = useState<any[]>([]);
  const [selectedInheritedEvidenceIds, setSelectedInheritedEvidenceIds] = useState<number[]>([]);

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<TicketFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      prioridad: 'LOW',
      accessories: [],
      source_ticket_id: '',
      device_id: '',
    },
  });

  const { fields, append, remove, replace } = useFieldArray({
    control,
    name: 'accessories',
  });

  const selectedCustomerId = watch('customer_id');
  const selectedSourceTicketId = watch('source_ticket_id');

  const { data: selectedCustomerDetail } = useCustomer(
    !isWarrantyMode && selectedCustomerId ? parseInt(selectedCustomerId, 10) : null,
  );
  const { data: sourceTicket } = useTicket(isWarrantyMode && selectedSourceTicketId ? selectedSourceTicketId : '');

  const devices = selectedCustomerDetail?.devices || [];
  const isSubmitting = createTicketMutation.isPending || createWarrantyMutation.isPending;

  useEffect(() => {
    if (!isWarrantyMode) return;

    if (!sourceTicket) {
      setValue('customer_id', '');
      setValue('device_id', '');
      replace([]);
      setInheritedEvidences([]);
      setSelectedInheritedEvidenceIds([]);
      return;
    }

    setValue('customer_id', sourceTicket.customer?.id ? String(sourceTicket.customer.id) : '');
    setValue('device_id', sourceTicket.device?.id ? String(sourceTicket.device.id) : '');
    setValue('prioridad', (sourceTicket.prioridad as PriorityOption) || 'LOW');
    replace(
      (sourceTicket.accessories || []).map((accessory: any) => ({
        nombre: accessory.nombre || '',
        condicion: accessory.condicion || '',
        notas: accessory.notas || '',
      })),
    );

    const sourceEvidences = sourceTicket.evidences || [];
    setInheritedEvidences(sourceEvidences);
    setSelectedInheritedEvidenceIds(sourceEvidences.map((evidence: any) => evidence.id));
  }, [isWarrantyMode, replace, setValue, sourceTicket]);

  const toggleInheritedEvidence = (evidenceId: number) => {
    setSelectedInheritedEvidenceIds((prev) =>
      prev.includes(evidenceId) ? prev.filter((id) => id !== evidenceId) : [...prev, evidenceId],
    );
  };

  const onSubmit = async (data: TicketFormValues) => {
    setSubmitError(null);

    if (isWarrantyMode) {
      if (!data.source_ticket_id) {
        setSubmitError('Debes seleccionar un ticket base para la garantia.');
        return;
      }

      const warrantyFormData = new FormData();
      warrantyFormData.append('descripcion_problema', data.descripcion_problema);
      warrantyFormData.append('prioridad', data.prioridad);
      warrantyFormData.append('accessories', JSON.stringify(data.accessories || []));
      warrantyFormData.append('inherited_evidence_ids', JSON.stringify(selectedInheritedEvidenceIds));

      files.forEach((file) => {
        warrantyFormData.append('evidences', file);
      });

      createWarrantyMutation.mutate(
        {
          sourceTicketId: data.source_ticket_id,
          data: warrantyFormData,
        },
        {
          onSuccess: (result) => {
            navigate(`/tickets/${result.id}`);
          },
          onError: (error: any) => {
            setSubmitError(getApiErrorMessage(error, 'No se pudo crear el ticket de garantia.'));
          },
        },
      );
      return;
    }

    if (!data.customer_id) {
      setSubmitError('Debes seleccionar un cliente.');
      return;
    }

    const ticketFormData = new FormData();
    ticketFormData.append('customer_id', data.customer_id);
    ticketFormData.append('descripcion_problema', data.descripcion_problema);
    ticketFormData.append('prioridad', data.prioridad);

    if (data.device_id) {
      ticketFormData.append('device_id', data.device_id);
    }

    if (data.accessories && data.accessories.length > 0) {
      ticketFormData.append('accessories', JSON.stringify(data.accessories));
    }

    files.forEach((file) => {
      ticketFormData.append('evidences', file);
    });

    createTicketMutation.mutate(ticketFormData, {
      onSuccess: (result) => {
        navigate(`/tickets/${result.id}`);
      },
      onError: (error: any) => {
        setSubmitError(getApiErrorMessage(error, 'No se pudo crear el ticket. Verifica los datos e intentalo nuevamente.'));
      },
    });
  };

  return (
    <div className="mx-auto max-w-[1000px] p-8">
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
          title={isWarrantyMode ? 'Nuevo Ticket de Garantia' : 'Nuevo Ticket de Reparacion'}
          subtitle={
            isWarrantyMode
              ? 'Parte de un ticket base, hereda sus datos y te deja ajustarlos antes de registrarlo.'
              : 'Registra el ingreso de un nuevo equipo al taller para diagnostico.'
          }
        />
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {submitError && (
          <div className="rounded-xl border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] px-4 py-3 text-sm font-medium text-[var(--color-danger)]">
            {submitError}
          </div>
        )}

        <div className="form-card">
          <div className="form-section-title flex items-center gap-2">
            {isWarrantyMode ? <ShieldAlert size={16} /> : <User size={16} />}
            {isWarrantyMode ? 'Informacion del Ticket Base' : 'Informacion del Cliente y Equipo'}
          </div>

          <div className="form-grid-2">
            {isWarrantyMode ? (
              <>
                <div className="form-field">
                  <Label required>Ticket base</Label>
                  <Select {...register('source_ticket_id')} disabled={isLoadingWarrantyTickets}>
                    <option value="">Seleccione un ticket...</option>
                    {availableWarrantyTickets.map((ticket) => (
                      <option key={ticket.id} value={ticket.id}>
                        {ticket.folio} - {ticket.customer?.nombre || 'Cliente'} - {ticket.device ? `${ticket.device.marca} ${ticket.device.modelo}` : 'Sin equipo'}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="form-field">
                  <Label required>Prioridad Inicial</Label>
                  <Select {...register('prioridad')}>
                    <option value="LOW">Baja (Normal)</option>
                    <option value="MEDIUM">Media</option>
                    <option value="HIGH">Alta</option>
                    <option value="CRITICAL">Critica (Urgente)</option>
                  </Select>
                </div>
              </>
            ) : (
              <>
                <div className="form-field">
                  <Label required>Cliente / Solicitante</Label>
                  <Select
                    {...register('customer_id')}
                    error={!!errors.customer_id}
                  >
                    <option value="">Seleccione un cliente...</option>
                    {customers?.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.nombre} ({customer.identificador})
                      </option>
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
                    {devices.map((device: any) => (
                      <option key={device.id} value={device.id}>
                        {device.marca} {device.modelo} {device.numero_serie ? `(${device.numero_serie})` : ''}
                      </option>
                    ))}
                  </Select>
                  {!selectedCustomerId && <p className="mt-1 text-[11px] text-[var(--gray-400)]">Primero seleccione un cliente.</p>}
                  {selectedCustomerId && devices.length === 0 && <p className="mt-1 text-[11px] font-medium text-[var(--color-warning)]">Este cliente no tiene equipos registrados.</p>}
                </div>
              </>
            )}

            {isWarrantyMode && sourceTicket && (
              <>
                <div className="rounded-xl border border-[var(--gray-100)] bg-[var(--gray-50)] px-4 py-3">
                  <div className="mb-1 text-[11px] font-bold uppercase text-[var(--gray-400)]">Cliente heredado</div>
                  <div className="font-semibold text-[var(--gray-800)]">{sourceTicket.customer?.nombre || 'Sin cliente'}</div>
                  <div className="truncate text-xs text-[var(--gray-500)]">{sourceTicket.customer?.identificador || 'Sin identificador'}</div>
                </div>

                <div className="rounded-xl border border-[var(--gray-100)] bg-[var(--gray-50)] px-4 py-3">
                  <div className="mb-1 text-[11px] font-bold uppercase text-[var(--gray-400)]">Equipo heredado</div>
                  <div className="font-semibold text-[var(--gray-800)]">
                    {sourceTicket.device ? `${sourceTicket.device.marca} ${sourceTicket.device.modelo}` : 'Sin equipo'}
                  </div>
                  <div className="truncate text-xs text-[var(--gray-500)]">{sourceTicket.device?.numero_serie || 'Sin serie registrada'}</div>
                </div>
              </>
            )}

            <div className="form-field form-grid-full mt-2">
              <Label required>
                <div className="flex items-center gap-1.5">
                  <ClipboardList size={14} className="text-[var(--gray-400)]" />
                  {isWarrantyMode ? 'Descripcion del Problema en Garantia' : 'Descripcion del Problema'}
                </div>
              </Label>
              <Textarea
                {...register('descripcion_problema')}
                placeholder={
                  isWarrantyMode
                    ? 'Ej. El equipo regresa porque la misma falla volvio a presentarse luego de la entrega...'
                    : 'Ej. La pantalla parpadea y el equipo se apaga solo despues de 10 minutos de uso...'
                }
                error={!!errors.descripcion_problema}
                rows={4}
              />
              {errors.descripcion_problema && <span className="form-error">{errors.descripcion_problema.message}</span>}
              <p className="mt-1 text-[11px] text-[var(--gray-400)]">
                {isWarrantyMode
                  ? 'Describe la nueva incidencia o como regreso el equipo. Los demas datos se heredan del ticket base.'
                  : 'Describe fielmente el fallo reportado por el cliente.'}
              </p>
            </div>

            {!isWarrantyMode && (
              <div className="form-field">
                <Label required>Prioridad Inicial</Label>
                <Select {...register('prioridad')}>
                  <option value="LOW">Baja (Normal)</option>
                  <option value="MEDIUM">Media</option>
                  <option value="HIGH">Alta</option>
                  <option value="CRITICAL">Critica (Urgente)</option>
                </Select>
              </div>
            )}
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

          {isWarrantyMode && (
            <p className="mb-4 text-[12px] text-[var(--gray-500)]">
              Los accesorios del ticket base se cargan aqui para que puedas corregirlos, quitar los que ya no llegaron o agregar nuevos.
            </p>
          )}

          <div className="space-y-3">
            {fields.map((field, index) => (
              <div key={field.id} className="flex items-start gap-3 rounded-xl border border-[var(--gray-100)] bg-[var(--gray-50)] p-4 transition-all hover:border-[var(--gray-300)]">
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
                  className="h-9 w-9 shrink-0 text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)]"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {fields.length === 0 && (
              <div className="rounded-2xl border-2 border-dashed border-[var(--gray-200)] bg-[var(--gray-50)]/50 py-10 text-center">
                <p className="text-[13px] font-medium italic text-[var(--gray-400)]">No se han registrado accesorios para este ticket.</p>
              </div>
            )}
          </div>

          <div className="form-section-title mt-12 flex items-center gap-2">
            <Camera size={16} /> Evidencias Fotograficas
          </div>

          {isWarrantyMode && inheritedEvidences.length > 0 && (
            <div className="mb-6 space-y-3 rounded-2xl border border-[var(--gray-200)] bg-[var(--gray-50)] p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-[var(--gray-700)]">
                <ShieldAlert size={15} className="text-[var(--color-brand-blue)]" />
                Evidencias heredadas del ticket base
              </div>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                {inheritedEvidences.map((evidence) => {
                  const isSelected = selectedInheritedEvidenceIds.includes(evidence.id);
                  return (
                    <button
                      key={evidence.id}
                      type="button"
                      onClick={() => toggleInheritedEvidence(evidence.id)}
                      className={`overflow-hidden rounded-xl border text-left transition-all ${
                        isSelected
                          ? 'border-[var(--color-brand-blue)] bg-white shadow-sm'
                          : 'border-[var(--gray-200)] bg-[var(--gray-100)] opacity-65'
                      }`}
                    >
                      <img
                        src={resolveMediaUrl(evidence.archivo)}
                        alt={evidence.nombre_archivo || 'Evidencia heredada'}
                        className="h-28 w-full object-cover"
                      />
                      <div className="space-y-1 px-3 py-2">
                        <div className="truncate text-xs font-medium text-[var(--gray-700)]">
                          {evidence.nombre_archivo || 'Evidencia heredada'}
                        </div>
                        <div className={`text-[11px] font-semibold ${isSelected ? 'text-[var(--color-brand-blue)]' : 'text-[var(--gray-500)]'}`}>
                          {isSelected ? 'Se incluira en la garantia' : 'Excluida de la garantia'}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="p-1">
            <MultiImageUpload onFilesChange={setFiles} maxFiles={15} />
            <p className="mt-3 text-[11px] text-[var(--gray-400)]">
              {isWarrantyMode
                ? 'Puedes mantener las fotos heredadas activas arriba y sumar nuevas evidencias del nuevo ingreso aqui.'
                : 'Puede adjuntar hasta 15 fotos del estado fisico del equipo al ingresar.'}
            </p>
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
            disabled={isSubmitting}
            className="h-11 px-10"
          >
            {isSubmitting
              ? 'Procesando...'
              : isWarrantyMode
                ? 'Crear Ticket de Garantia'
                : 'Crear Ticket de Reparacion'}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default TicketFormPage;
