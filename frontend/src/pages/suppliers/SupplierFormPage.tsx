import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { ArrowLeft, Building2, Mail, MapPin, Phone, Save, UserRound } from 'lucide-react';

import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Label } from '../../components/ui/Label';
import { Textarea } from '../../components/ui/Textarea';
import { getApiErrorMessage } from '../../lib/apiErrors';
import { useCreateSupplier, useSupplier, useUpdateSupplier } from '../../hooks/useSuppliers';

const supplierSchema = z.object({
  nombre: z.string().min(2, 'El nombre es obligatorio'),
  ruc: z.string().regex(/^\d{11}$/, 'El RUC debe tener exactamente 11 dígitos'),
  contacto: z.string().optional(),
  telefono: z.string().optional(),
  correo: z.string().email('Correo inválido').optional().or(z.literal('')),
  direccion: z.string().optional(),
});

type SupplierFormValues = z.infer<typeof supplierSchema>;

export default function SupplierFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const supplierId = id ? Number(id) : null;
  const isEditing = supplierId !== null;

  const { data: supplier, isLoading } = useSupplier(supplierId);
  const createSupplier = useCreateSupplier();
  const updateSupplier = useUpdateSupplier();
  const [rucError, setRucError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierSchema),
    defaultValues: {
      nombre: '',
      ruc: '',
      contacto: '',
      telefono: '',
      correo: '',
      direccion: '',
    },
  });

  useEffect(() => {
    if (!supplier) return;
    reset({
      nombre: supplier.nombre,
      ruc: supplier.ruc,
      contacto: supplier.contacto || '',
      telefono: supplier.telefono || '',
      correo: supplier.correo || '',
      direccion: supplier.direccion || '',
    });
  }, [supplier, reset]);

  const onSubmit = async (data: SupplierFormValues) => {
    setRucError(null);
    setSubmitError(null);
    const payload = {
      nombre: data.nombre.trim(),
      ruc: data.ruc.trim(),
      contacto: data.contacto?.trim() || undefined,
      telefono: data.telefono?.trim() || undefined,
      correo: data.correo?.trim() || undefined,
      direccion: data.direccion?.trim() || undefined,
    };

    try {
      if (isEditing && supplierId) {
        await updateSupplier.mutateAsync({ id: supplierId, ...payload });
      } else {
        await createSupplier.mutateAsync(payload);
      }
      navigate('/suppliers');
    } catch (error: any) {
      if (error.response?.data?.ruc) {
        setRucError(error.response.data.ruc[0]);
      } else {
        setSubmitError(getApiErrorMessage(error, 'No se pudo guardar el proveedor.'));
      }
    }
  };

  if (isEditing && isLoading) {
    return (
      <div className="p-20 flex justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-brand-blue)] border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-[1000px] mx-auto">
      <div className="mb-8">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/suppliers')}
          className="mb-4 text-[var(--gray-500)]"
        >
          <ArrowLeft size={16} className="mr-2" />
          Volver a proveedores
        </Button>
        <PageHeader
          title={isEditing ? 'Editar Proveedor' : 'Nuevo Proveedor'}
          subtitle={isEditing ? `Actualiza los datos de ${supplier?.nombre || 'este proveedor'}.` : 'Registra un nuevo proveedor para el flujo de compras.'}
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
            <Building2 size={16} /> Información Principal
          </div>

          <div className="form-grid-2">
            <div className="form-field">
              <Label required>Nombre / Razón social</Label>
              <Input
                type="text"
                placeholder="Ej. Distribuidora Andina"
                error={!!errors.nombre}
                {...register('nombre')}
              />
              {errors.nombre && <span className="form-error">{errors.nombre.message}</span>}
            </div>

            <div className="form-field">
              <Label required>RUC</Label>
              <Input
                type="text"
                placeholder="Ej. 20111111111"
                error={!!(errors.ruc || rucError)}
                {...register('ruc', {
                  onChange: () => {
                    if (rucError) setRucError(null);
                    if (submitError) setSubmitError(null);
                  },
                })}
              />
              {(errors.ruc || rucError) && <span className="form-error">{errors.ruc?.message || rucError}</span>}
            </div>
          </div>

          <div className="form-section-title mt-10 flex items-center gap-2">
            <UserRound size={16} /> Contacto Comercial
          </div>

          <div className="form-grid-2">
            <div className="form-field">
              <Label>
                <div className="flex items-center gap-1.5">
                  <UserRound size={14} className="text-[var(--gray-400)]" />
                  Contacto
                </div>
              </Label>
              <Input type="text" placeholder="Ej. Rosa Díaz" {...register('contacto')} />
            </div>

            <div className="form-field">
              <Label>
                <div className="flex items-center gap-1.5">
                  <Phone size={14} className="text-[var(--gray-400)]" />
                  Teléfono
                </div>
              </Label>
              <Input type="text" placeholder="Ej. 964000111" {...register('telefono')} />
            </div>

            <div className="form-field form-grid-full">
              <Label>
                <div className="flex items-center gap-1.5">
                  <Mail size={14} className="text-[var(--gray-400)]" />
                  Correo
                </div>
              </Label>
              <Input
                type="email"
                placeholder="compras@proveedor.pe"
                error={!!errors.correo}
                {...register('correo')}
              />
              {errors.correo && <span className="form-error">{errors.correo.message}</span>}
            </div>
          </div>

          <div className="form-section-title mt-10 flex items-center gap-2">
            <MapPin size={16} /> Ubicación
          </div>

          <div className="form-field form-grid-full">
            <Label>Dirección</Label>
            <Textarea
              rows={4}
              placeholder="Ej. Av. Industrial 456, Huancayo"
              {...register('direccion')}
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4">
          <Button type="button" variant="ghost" onClick={() => navigate('/suppliers')}>
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting || createSupplier.isPending || updateSupplier.isPending}
            variant="primary"
            className="px-8"
          >
            <Save size={18} className="mr-2" />
            {isEditing ? 'Guardar Cambios' : 'Guardar Proveedor'}
          </Button>
        </div>
      </form>
    </div>
  );
}
