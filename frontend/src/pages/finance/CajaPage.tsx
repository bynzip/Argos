import { useEffect, useState } from 'react';
import { AlertTriangle, CreditCard, DollarSign, History, Info, Landmark, Lock, Smartphone, Unlock } from 'lucide-react';

import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Label } from '../../components/ui/Label';
import { PageHeader } from '../../components/ui/PageHeader';
import { Textarea } from '../../components/ui/Textarea';
import { useAbrirCaja, useCajaStatus, useCerrarCaja } from '../../hooks/useFinance';
import { getApiErrorMessage } from '../../lib/apiErrors';
import { cn } from '../../lib/utils';
import { useCajaStore } from '../../store/cajaStore';

export default function CajaPage() {
  const { data: caja, isLoading, refetch } = useCajaStatus();
  const abrirCajaMutation = useAbrirCaja();
  const cerrarCajaMutation = useCerrarCaja();
  const { setCaja, clearCaja } = useCajaStore();

  const [openingAmount, setOpeningAmount] = useState<string>('0.00');
  const [declaredAmount, setDeclaredAmount] = useState<string>('0.00');
  const [closingNotes, setClosingNotes] = useState<string>('');
  const [closingError, setClosingError] = useState<string | null>(null);

  useEffect(() => {
    if (caja && caja.estado === 'OPEN') {
      setCaja(true, parseFloat(caja.opening_amount), caja.total_dia);
    } else {
      clearCaja();
    }
  }, [caja, clearCaja, setCaja]);

  if (isLoading) {
    return <div className="p-12 text-center">Cargando estado de caja...</div>;
  }

  const handleOpen = (e: React.FormEvent) => {
    e.preventDefault();
    abrirCajaMutation.mutate(parseFloat(openingAmount), {
      onSuccess: () => refetch()
    });
  };

  const handleClose = (e: React.FormEvent) => {
    e.preventDefault();
    setClosingError(null);
    cerrarCajaMutation.mutate(
      { declaredAmount: parseFloat(declaredAmount), notes: closingNotes },
      {
        onSuccess: () => refetch(),
        onError: (error: any) => {
          setClosingError(getApiErrorMessage(error, 'No se pudo completar el cierre de caja.'));
        },
      }
    );
  };

  const getMethodIcon = (method: string) => {
    switch (method) {
      case 'CASH':
        return <DollarSign size={16} />;
      case 'YAPE':
      case 'PLIN':
        return <Smartphone size={16} />;
      case 'TRANSFER':
        return <Landmark size={16} />;
      case 'CARD':
        return <CreditCard size={16} />;
      default:
        return <DollarSign size={16} />;
    }
  };

  const getMethodColor = (method: string) => {
    switch (method) {
      case 'CASH':
        return 'bg-[#16A34A]';
      case 'YAPE':
      case 'PLIN':
        return 'bg-[#7C3AED]';
      case 'TRANSFER':
        return 'bg-[#2347A5]';
      case 'CARD':
        return 'bg-[#EF5B2A]';
      default:
        return 'bg-[var(--gray-400)]';
    }
  };

  const cashExpected = caja
    ? parseFloat(caja.opening_amount) + (caja.ingresos_por_metodo?.find((i) => i.metodo_pago === 'CASH')?.total || 0)
    : 0;
  const declaredAmountNumber = parseFloat(declaredAmount || '0');
  const hasDifference = !Number.isNaN(declaredAmountNumber) && declaredAmountNumber !== cashExpected;

  if (!caja || caja.estado !== 'OPEN') {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <PageHeader title="Gestión de Caja" subtitle="Controla el flujo de dinero de tu turno." />

        <div className="flex justify-center py-12">
          <Card className="w-full max-w-lg shadow-[var(--shadow-lg)] border-t-4 border-t-[var(--color-brand-orange)]">
            <CardContent className="pt-8 flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-[var(--color-warning-bg)] rounded-full flex items-center justify-center text-[var(--color-warning)] mb-6">
                <Lock size={32} />
              </div>
              <h2 className="text-xl font-bold text-[var(--gray-800)] mb-2">Tu caja está cerrada</h2>
              <p className="text-[var(--gray-500)] mb-8 max-w-sm">
                Para comenzar a registrar cobros, debes abrir tu caja declarando el fondo inicial del turno.
              </p>

              <form onSubmit={handleOpen} className="w-full max-w-xs space-y-6 text-left">
                <div className="space-y-1.5">
                  <Label>Fondo Inicial (S/)</Label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--gray-400)] font-bold">S/</span>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={openingAmount}
                      onChange={(e) => setOpeningAmount(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>

                <Button type="submit" variant="primary" className="w-full h-11" disabled={abrirCajaMutation.isPending}>
                  <Unlock size={18} className="mr-2" />
                  {abrirCajaMutation.isPending ? 'Abriendo...' : 'Abrir Caja de Turno'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-[1200px] mx-auto">
      <PageHeader
        title="Gestión de Caja"
        subtitle={`Turno activo desde las ${new Date(caja.opened_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
        actions={
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-bold bg-[var(--color-success-bg)] text-[var(--color-success)] border border-[var(--color-success-border)]">
            <div className="w-2 h-2 rounded-full bg-current animate-pulse" />
            CAJA ABIERTA
          </span>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card className="p-5 flex flex-col gap-1 border-l-4 border-l-[var(--color-brand-blue)]">
          <span className="text-[11px] font-bold text-[var(--gray-400)] uppercase">Fondo Apertura</span>
          <span className="text-2xl font-black text-[var(--gray-800)]">S/ {parseFloat(caja.opening_amount).toFixed(2)}</span>
        </Card>
        <Card className="p-5 flex flex-col gap-1 border-l-4 border-l-[var(--color-success)]">
          <span className="text-[11px] font-bold text-[var(--gray-400)] uppercase">Ingresos Confirmados</span>
          <span className="text-2xl font-black text-[var(--color-success)]">S/ {(caja.total_dia || 0).toFixed(2)}</span>
        </Card>
        <Card className="p-5 flex flex-col gap-1 border-l-4 border-l-[var(--color-warning)]">
          <span className="text-[11px] font-bold text-[var(--gray-400)] uppercase">Ingresos Pendientes</span>
          <span className="text-2xl font-black text-[var(--color-warning)]">S/ {(caja.pending_total || 0).toFixed(2)}</span>
        </Card>
        <Card className="p-5 flex flex-col gap-1 border-l-4 border-l-[var(--color-brand-orange)] bg-[var(--color-warning-bg)]">
          <span className="text-[11px] font-bold text-[var(--color-warning)] uppercase">Efectivo Esperado</span>
          <span className="text-2xl font-black text-[var(--color-brand-orange)]">S/ {cashExpected.toFixed(2)}</span>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Ingresos por Método de Pago</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <p className="mb-5 text-[12px] text-[var(--gray-500)]">
                Esta sección solo cuenta cobros confirmados. Los pagos digitales pendientes aparecen aparte y no impactan el efectivo esperado ni el saldo final del ticket.
              </p>
              <div className="space-y-6">
                {caja.ingresos_por_metodo && caja.ingresos_por_metodo.length > 0 ? (
                  caja.ingresos_por_metodo.map((metodo) => {
                    const percentage = (metodo.total / (caja.total_dia || 1)) * 100;
                    return (
                      <div key={metodo.metodo_pago} className="space-y-2">
                        <div className="flex justify-between items-end">
                          <div className="flex items-center gap-2">
                            <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center text-white', getMethodColor(metodo.metodo_pago))}>
                              {getMethodIcon(metodo.metodo_pago)}
                            </div>
                            <span className="text-sm font-bold text-[var(--gray-700)] uppercase tracking-wide">{metodo.metodo_pago}</span>
                          </div>
                          <span className="text-sm font-black text-[var(--gray-800)]">S/ {metodo.total.toFixed(2)}</span>
                        </div>
                        <div className="h-2 bg-[var(--gray-100)] rounded-full overflow-hidden">
                          <div className={cn('h-full rounded-full transition-all duration-1000', getMethodColor(metodo.metodo_pago))} style={{ width: `${Math.max(percentage, 2)}%` }} />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-12 text-center">
                    <Info size={32} className="mx-auto text-[var(--gray-200)] mb-3" />
                    <p className="text-[var(--gray-400)] text-sm font-medium">No hay cobros confirmados en este turno.</p>
                  </div>
                )}
              </div>

              {Boolean(caja.pending_total) && (
                <div className="mt-6 p-4 bg-[var(--color-warning-bg)] border border-[var(--color-warning-border)] rounded-xl">
                  <p className="text-[12px] text-[var(--color-warning)] font-medium">
                    Hay S/ {(caja.pending_total || 0).toFixed(2)} en pagos pendientes de confirmación.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="mt-8">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Últimos Cobros del Turno</CardTitle>
              <History size={16} className="text-[var(--gray-300)]" />
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[var(--gray-50)] text-[11px] font-bold text-[var(--gray-400)] uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-3 text-left">Hora</th>
                      <th className="px-6 py-3 text-left">Folio</th>
                      <th className="px-6 py-3 text-left">Método</th>
                      <th className="px-6 py-3 text-right">Monto</th>
                      <th className="px-6 py-3 text-center">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--gray-100)]">
                    {caja.receipts && caja.receipts.length > 0 ? (
                      caja.receipts.slice().reverse().map((r: any) => (
                        <tr key={r.id} className="hover:bg-[var(--gray-50)] transition-colors">
                          <td className="px-6 py-3 text-[var(--gray-500)]">
                            {new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="px-6 py-3 font-bold text-[var(--color-brand-blue)]">{r.folio}</td>
                          <td className="px-6 py-3">
                            <div className="flex items-center gap-2">
                              <div className={cn('w-5 h-5 rounded flex items-center justify-center text-white scale-75', getMethodColor(r.metodo_pago))}>
                                {getMethodIcon(r.metodo_pago)}
                              </div>
                              <span className="text-[12px] font-medium">{r.metodo_pago}</span>
                            </div>
                          </td>
                          <td className="px-6 py-3 text-right font-black text-[var(--gray-800)]">S/ {parseFloat(r.amount).toFixed(2)}</td>
                          <td className="px-6 py-3 text-center">
                            <span
                              className={cn(
                                'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold border',
                                r.estado === 'CONFIRMED'
                                  ? 'bg-[var(--color-success-bg)] text-[var(--color-success)] border-[var(--color-success-border)]'
                                  : 'bg-[var(--color-warning-bg)] text-[var(--color-warning)] border-[var(--color-warning-border)]'
                              )}
                            >
                              {r.estado}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-6 py-10 text-center text-[var(--gray-400)] italic">
                          No hay cobros registrados.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-5">
          <Card className="border-[var(--gray-200)] shadow-[var(--shadow-md)]">
            <CardHeader className="bg-[var(--gray-50)]">
              <CardTitle>Cierre de Caja de Turno</CardTitle>
            </CardHeader>
            <CardContent className="pt-8 space-y-6">
              <p className="text-[13px] text-[var(--gray-500)] leading-relaxed bg-[var(--color-info-bg)] p-4 rounded-xl border border-[var(--color-info-border)] text-[var(--color-brand-blue)] font-medium">
                Al cerrar tu turno, debes declarar cuánto dinero físico exacto hay en el cajón. El sistema calcula el efectivo esperado solo con pagos en efectivo confirmados.
              </p>

              <form onSubmit={handleClose} className="space-y-6">
                <div className="space-y-1.5">
                  <Label required>Efectivo Físico Declarado (S/)</Label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--gray-400)] font-bold">S/</span>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={declaredAmount}
                      onChange={(e) => setDeclaredAmount(e.target.value)}
                      className="pl-9 h-11 text-lg font-bold"
                      placeholder="0.00"
                    />
                  </div>
                  <p className="text-[11px] text-[var(--gray-400)]">
                    Esperado: <span className="font-bold">S/ {cashExpected.toFixed(2)}</span>
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label required={hasDifference}>Notas de Cierre {hasDifference ? '(Obligatoria por diferencia)' : '(Opcional)'}</Label>
                  <Textarea
                    rows={3}
                    value={closingNotes}
                    onChange={(e) => setClosingNotes(e.target.value)}
                    placeholder="Escribe alguna observación relevante sobre el turno..."
                  />
                </div>

                <Button
                  type="submit"
                  variant="secondary"
                  className="w-full h-12 bg-[var(--gray-800)] text-white hover:bg-[var(--gray-900)] border-none"
                  disabled={cerrarCajaMutation.isPending}
                >
                  <Lock size={18} className="mr-2" />
                  {cerrarCajaMutation.isPending ? 'Procesando Cierre...' : 'Cerrar Caja de Turno'}
                </Button>

                {closingError && (
                  <div className="p-3 bg-[var(--color-danger-bg)] border border-[var(--color-danger-border)] rounded-lg flex gap-2 items-center text-[var(--color-danger)] text-xs font-medium">
                    <AlertTriangle size={16} />
                    {closingError}
                  </div>
                )}
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
