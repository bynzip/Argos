import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useCreateCustomer } from '../../hooks/useCustomers';
import { ArrowLeft, Save, User, Fingerprint, MapPin, Tag, MessageSquare } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Label } from '../../components/ui/Label';
import { Select } from '../../components/ui/Select';
import { Textarea } from '../../components/ui/Textarea';
import { getApiErrorMessage } from '../../lib/apiErrors';

const customerSchema = z.object({
  tipo_cliente: z.enum(['PERSONA', 'EMPRESA']),
  identificador: z.string().regex(/^\d+$/, 'Solo debe contener dígitos numéricos'),
  nombre: z.string().min(2, 'El nombre es obligatorio'),
  telefono: z.string().optional(),
  correo_electronico: z.string().email('Correo inválido').optional().or(z.literal('')),
  direccion: z.string().optional(),
  etiqueta: z.enum(['NUEVO', 'REGULAR', 'FRECUENTE', 'VIP', 'MOROSO', 'ESPECIAL']),
  notas: z.string().optional(),
}).superRefine((data, ctx) => {
  const expectedLength = data.tipo_cliente === 'PERSONA' ? 8 : 11;
  const documentName = data.tipo_cliente === 'PERSONA' ? 'DNI' : 'RUC';
  if (data.identificador.length !== expectedLength) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['identificador'],
      message: `El ${documentName} debe tener exactamente ${expectedLength} dígitos`,
    });
  }
});

type CustomerForm = z.infer<typeof customerSchema>;

export default function CustomerFormPage() {
  const navigate = useNavigate();
  const createCustomer = useCreateCustomer();
  const [identificadorError, setIdentificadorError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const identificadorSectionRef = useRef<HTMLDivElement | null>(null);

  const {
    register,
    handleSubmit,
    setFocus,
    watch,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<CustomerForm>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      tipo_cliente: 'PERSONA',
      etiqueta: 'NUEVO',
    },
  });

  const tipoCliente = watch('tipo_cliente');
  const identificador = watch('identificador');
  const identificadorField = register('identificador');

  useEffect(() => {
    const focusTimer = window.setTimeout(() => {
      setFocus('identificador');
    }, 0);
    return () => window.clearTimeout(focusTimer);
  }, [setFocus]);

  useEffect(() => {
    if (!(errors.identificador || identificadorError)) return;
    identificadorSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setFocus('identificador');
  }, [errors.identificador, identificadorError, setFocus]);

  useEffect(() => {
    if (identificador) {
      trigger('identificador');
    }
  }, [identificador, tipoCliente, trigger]);

  const onSubmit = async (data: CustomerForm) => {
    try {
      setIdentificadorError(null);
      setSubmitError(null);
      
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
        setSubmitError(null);
      } else {
        setSubmitError(getApiErrorMessage(error, 'No se pudo crear el cliente.'));
      }
    }
  };

  return (
    <div className="p-8 max-w-[1000px] mx-auto">
      {/* Header & Navigation */}
      <div className="mb-8">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => navigate('/customers')}
          className="mb-4 text-[var(--gray-500)]"
        >
          <ArrowLeft size={16} className="mr-2" />
          Volver al directorio
        </Button>
        <PageHeader 
          title="Nuevo Cliente"
          subtitle="Registra un nuevo cliente en la base de datos de Argos ERP."
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
            <User size={16} /> Información Principal
          </div>
          
          <div className="form-grid-2">
            <div className="form-field">
              <Label required>Tipo de Cliente</Label>
              <Select {...register('tipo_cliente')}>
                <option value="PERSONA">Persona Natural (DNI)</option>
                <option value="EMPRESA">Empresa (RUC)</option>
              </Select>
            </div>

            <div ref={identificadorSectionRef} className="form-field">
              <Label required>
                <div className="flex items-center gap-1.5">
                  <Fingerprint size={14} className="text-[var(--gray-400)]" />
                  {tipoCliente === 'PERSONA' ? 'DNI' : 'RUC'}
                </div>
              </Label>
              <Input
                type="text"
                placeholder={tipoCliente === 'PERSONA' ? 'Ej. 12345678' : 'Ej. 20123456789'}
                error={!!(errors.identificador || identificadorError)}
                {...identificadorField}
                autoFocus
                onChange={(event) => {
                  identificadorField.onChange(event);
                  if (identificadorError) setIdentificadorError(null);
                  if (submitError) setSubmitError(null);
                }}
              />
              {(errors.identificador || identificadorError) && (
                <span className="form-error">
                  {errors.identificador?.message || identificadorError}
                </span>
              )}
            </div>

            <div className="form-field form-grid-full">
              <Label required>
                {tipoCliente === 'PERSONA' ? 'Nombre Completo' : 'Razón Social'}
              </Label>
              <Input
                type="text"
                placeholder="Ej. Juan Pérez García"
                error={!!errors.nombre}
                {...register('nombre')}
              />
              {errors.nombre && <span className="form-error">{errors.nombre.message}</span>}
            </div>
          </div>

          <div className="form-section-title mt-10 flex items-center gap-2">
            <MapPin size={16} /> Contacto y Ubicación
          </div>

          <div className="form-grid-2">
            <div className="form-field">
              <Label>Teléfono / Celular</Label>
              <Input
                type="text"
                placeholder="Ej. 987 654 321"
                {...register('telefono')}
              />
            </div>

            <div className="form-field">
              <Label>Correo Electrónico</Label>
              <Input
                type="email"
                placeholder="ejemplo@correo.com"
                error={!!errors.correo_electronico}
                {...register('correo_electronico')}
              />
              {errors.correo_electronico && <span className="form-error">{errors.correo_electronico.message}</span>}
            </div>

            <div className="form-field form-grid-full">
              <Label>Dirección</Label>
              <Input
                type="text"
                placeholder="Ej. Av. Las Flores 123, Huancayo"
                {...register('direccion')}
              />
            </div>
          </div>

          <div className="form-section-title mt-10 flex items-center gap-2">
            <Tag size={16} /> Clasificación y Notas
          </div>

          <div className="form-grid-2">
            <div className="form-field">
              <Label required>Etiqueta de Cliente</Label>
              <Select {...register('etiqueta')}>
                <option value="NUEVO">Nuevo</option>
                <option value="REGULAR">Regular</option>
                <option value="FRECUENTE">Frecuente</option>
                <option value="VIP">VIP</option>
                <option value="MOROSO">Moroso</option>
                <option value="ESPECIAL">Especial</option>
              </Select>
            </div>

            <div className="form-field form-grid-full">
              <Label>
                <div className="flex items-center gap-1.5">
                  <MessageSquare size={14} className="text-[var(--gray-400)]" />
                  Notas internas
                </div>
              </Label>
              <Textarea
                rows={4}
                placeholder="Observaciones relevantes sobre el cliente..."
                {...register('notas')}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4">
          <Button
            type="button"
            variant="ghost"
            onClick={() => navigate('/customers')}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
            variant="primary"
            className="px-8"
          >
            <Save size={18} className="mr-2" />
            {isSubmitting ? 'Guardando...' : 'Guardar Cliente'}
          </Button>
        </div>
      </form>
    </div>
  );
}
