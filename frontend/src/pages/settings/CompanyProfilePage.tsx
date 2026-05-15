import { useState } from 'react';

import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Label } from '../../components/ui/Label';
import { PageHeader } from '../../components/ui/PageHeader';
import { useAuditLogs, useCompanyProfile, useUpdateCompanyProfile } from '../../hooks/useCore';

export default function CompanyProfilePage() {
  const { data: profile } = useCompanyProfile();
  const { data: auditLogs } = useAuditLogs({ page_size: 20 });
  const updateProfile = useUpdateCompanyProfile();
  const [form, setForm] = useState<Record<string, string>>({});

  const merged = {
    business_name: form.business_name ?? profile?.business_name ?? '',
    legal_name: form.legal_name ?? profile?.legal_name ?? '',
    ruc: form.ruc ?? profile?.ruc ?? '',
    phone: form.phone ?? profile?.phone ?? '',
    email: form.email ?? profile?.email ?? '',
    address: form.address ?? profile?.address ?? '',
    cochera_grace_days: form.cochera_grace_days ?? String(profile?.cochera_grace_days ?? 3),
    cochera_daily_rate: form.cochera_daily_rate ?? String(profile?.cochera_daily_rate ?? '0.00'),
    credit_grace_days: form.credit_grace_days ?? String(profile?.credit_grace_days ?? 0),
    credit_morosidad_limit: form.credit_morosidad_limit ?? String(profile?.credit_morosidad_limit ?? '0.00'),
  };
  const fields: Array<[keyof typeof merged, string]> = [
    ['business_name', 'Nombre comercial'],
    ['legal_name', 'Razón social'],
    ['ruc', 'RUC'],
    ['phone', 'Teléfono'],
    ['email', 'Email'],
    ['address', 'Dirección'],
    ['cochera_grace_days', 'Días de gracia cochera'],
    ['cochera_daily_rate', 'Tarifa diaria cochera'],
    ['credit_grace_days', 'Días de gracia crédito'],
    ['credit_morosidad_limit', 'Límite morosidad'],
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile.mutate({
      ...merged,
      cochera_grace_days: Number(merged.cochera_grace_days),
      credit_grace_days: Number(merged.credit_grace_days),
    });
  };

  return (
    <div className="p-8 max-w-[1280px] mx-auto space-y-8">
      <PageHeader title="Parámetros del negocio" subtitle="Configuración operativa visible para admin y bitácora reciente." />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card>
          <CardHeader><CardTitle>Perfil de empresa</CardTitle></CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {fields.map(([key, label]) => (
                <div key={key} className={key === 'address' ? 'md:col-span-2' : ''}>
                  <Label>{label}</Label>
                  <Input value={merged[key]} onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))} />
                </div>
              ))}
              <div className="md:col-span-2 pt-2">
                <Button type="submit" disabled={updateProfile.isPending}>
                  {updateProfile.isPending ? 'Guardando...' : 'Guardar parámetros'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Auditoría reciente</CardTitle></CardHeader>
          <CardContent className="pt-6 space-y-3">
            {(auditLogs || []).map((entry: any) => (
              <div key={entry.id} className="p-3 rounded-xl border border-[var(--gray-200)]">
                <div className="flex justify-between gap-3">
                  <span className="font-semibold text-[var(--gray-800)]">
                    {entry.module} · {entry.action}
                  </span>
                  <span className="text-[12px] text-[var(--gray-400)]">
                    {new Date(entry.created_at).toLocaleString()}
                  </span>
                </div>
                <div className="text-[13px] text-[var(--gray-500)] mt-1">
                  {entry.object_repr || entry.model_name} · {entry.user?.nombre || 'Sistema'}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
