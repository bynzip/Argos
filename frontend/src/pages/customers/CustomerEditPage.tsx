import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useCustomer, useUpdateCustomer } from '../../hooks/useCustomers';
import { ArrowLeft, Save, User, Fingerprint, MapPin, Tag, MessageSquare } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Label } from '../../components/ui/Label';
import { Select } from '../../components/ui/Select';
import { Textarea } from '../../components/ui/Textarea';

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
    return (
      <div className="p-20 flex justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-brand-blue)] border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-[1000px] mx-auto">
      {/* Header & Navigation */}
      <div className="mb-8">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => navigate(`/customers/${customerId}`)}
          className="mb-4 text-[var(--gray-500)]"
        >
          <ArrowLeft size={16} className="mr-2" />
          Volver al cliente
        </Button>
        <PageHeader 
          title="Editar Cliente"
          subtitle={`Modifica los datos de ${customer?.nombre || 'este cliente'}.`}
        />
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
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

            <div className="form-field">
              <Label required>
                <div className="flex items-center gap-1.5">
                  <Fingerprint size={14} className="text-[var(--gray-400)]" />
                  {tipoCliente === 'PERSONA' ? 'DNI' : 'RUC'}
                </div>
              </Label>
              <Input
                type="text"
                error={!!(errors.identificador || identificadorError)}
                {...register('identificador')}
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
                {...register('telefono')}
              />
            </div>

            <div className="form-field">
              <Label>Correo Electrónico</Label>
              <Input
                type="email"
                error={!!errors.correo_electronico}
                {...register('correo_electronico')}
              />
              {errors.correo_electronico && <span className="form-error">{errors.correo_electronico.message}</span>}
            </div>

            <div className="form-field form-grid-full">
              <Label>Dirección</Label>
              <Input
                type="text"
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
                {...register('notas')}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4">
          <Button
            type="button"
            variant="ghost"
            onClick={() => navigate(`/customers/${customerId}`)}
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
            {isSubmitting ? 'Guardando...' : 'Guardar Cambios'}
          </Button>
        </div>
      </form>
    </div>
  );
}
