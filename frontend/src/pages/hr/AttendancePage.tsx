import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { useAttendances, useCorrections, useDecideCorrection, useMarkAttendance } from '../../hooks/useHR';

export default function AttendancePage() {
  const { data: attendances, isLoading } = useAttendances();
  const { data: corrections } = useCorrections();
  const markEntry = useMarkAttendance('mark_entry');
  const startBreak = useMarkAttendance('start_break');
  const endBreak = useMarkAttendance('end_break');
  const markExit = useMarkAttendance('mark_exit');
  const approveCorrection = useDecideCorrection('approve');
  const rejectCorrection = useDecideCorrection('reject');

  return (
    <div className="p-8 max-w-[1200px] mx-auto space-y-8">
      <PageHeader title="RRHH y asistencia" subtitle="Marcación diaria, trazabilidad y correcciones pendientes." />

      <Card>
        <CardHeader>
          <CardTitle>Marcación rápida</CardTitle>
        </CardHeader>
        <CardContent className="pt-6 flex flex-wrap gap-3">
          <Button onClick={() => markEntry.mutate()}>Marcar entrada</Button>
          <Button variant="secondary" onClick={() => startBreak.mutate()}>Iniciar descanso</Button>
          <Button variant="secondary" onClick={() => endBreak.mutate()}>Finalizar descanso</Button>
          <Button variant="ghost" onClick={() => markExit.mutate()}>Marcar salida</Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Asistencia reciente</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {isLoading ? (
              <div className="p-8 text-center text-[var(--gray-500)]">Cargando asistencias...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-[11px] uppercase text-[var(--gray-400)]">
                    <tr>
                      <th className="text-left py-3">Fecha</th>
                      <th className="text-left py-3">Usuario</th>
                      <th className="text-left py-3">Entrada</th>
                      <th className="text-left py-3">Salida</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--gray-100)]">
                    {(attendances || []).slice(0, 15).map((attendance: any) => (
                      <tr key={attendance.id}>
                        <td className="py-3">{attendance.work_date}</td>
                        <td className="py-3 font-semibold">{attendance.user?.nombre || '-'}</td>
                        <td className="py-3">{attendance.clock_in || '-'}</td>
                        <td className="py-3">{attendance.clock_out || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Correcciones pendientes</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            {(corrections || []).length === 0 ? (
              <div className="text-sm text-[var(--gray-500)]">No hay correcciones pendientes.</div>
            ) : (
              (corrections || []).slice(0, 10).map((correction: any) => (
                <div key={correction.id} className="p-4 rounded-xl border border-[var(--gray-200)]">
                  <div className="font-semibold text-[var(--gray-800)]">
                    {correction.attendance?.user?.nombre || 'Empleado'}
                  </div>
                  <div className="text-[12px] text-[var(--gray-500)] mt-1">{correction.motivo}</div>
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" onClick={() => approveCorrection.mutate(correction.id)}>Aprobar</Button>
                    <Button size="sm" variant="ghost" onClick={() => rejectCorrection.mutate(correction.id)}>Rechazar</Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
