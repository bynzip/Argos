import React, { useState, useEffect } from 'react';
import { useCajaStatus, useAbrirCaja, useCerrarCaja } from '../../hooks/useFinance';
import { useCajaStore } from '../../store/cajaStore';
import { DollarSign, Lock, Unlock, AlertTriangle } from 'lucide-react';

const CajaPage = () => {
  const { data: caja, isLoading } = useCajaStatus();
  const abrirCajaMutation = useAbrirCaja();
  const cerrarCajaMutation = useCerrarCaja();
  const { setCaja, clearCaja } = useCajaStore();

  const [openingAmount, setOpeningAmount] = useState<string>('0.00');
  const [declaredAmount, setDeclaredAmount] = useState<string>('0.00');
  const [closingNotes, setClosingNotes] = useState<string>('');

  useEffect(() => {
    if (caja && caja.estado === 'OPEN') {
      setCaja(true, parseFloat(caja.opening_amount), caja.total_dia);
    } else {
      clearCaja();
    }
  }, [caja, setCaja, clearCaja]);

  if (isLoading) return <div className="p-6">Cargando estado de caja...</div>;

  const handleOpen = (e: React.FormEvent) => {
    e.preventDefault();
    abrirCajaMutation.mutate(parseFloat(openingAmount));
  };

  const handleClose = (e: React.FormEvent) => {
    e.preventDefault();
    cerrarCajaMutation.mutate({ declaredAmount: parseFloat(declaredAmount), notes: closingNotes });
  };

  if (!caja || caja.estado !== 'OPEN') {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Estado de Caja</h1>
        
        <div className="bg-white p-8 rounded-lg shadow border-t-4 border-amber-400">
          <div className="flex items-center gap-3 text-amber-600 mb-4">
            <Lock className="w-8 h-8" />
            <h2 className="text-xl font-semibold">Tu caja está cerrada</h2>
          </div>
          <p className="text-gray-600 mb-6">Debes abrir tu caja al inicio de tu turno para poder registrar cobros.</p>
          
          <form onSubmit={handleOpen} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Fondo Inicial Declarado (S/)</label>
              <div className="mt-1 relative rounded-md shadow-sm w-48">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-gray-500 sm:text-sm">S/</span>
                </div>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={openingAmount}
                  onChange={(e) => setOpeningAmount(e.target.value)}
                  className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md"
                  placeholder="0.00"
                />
              </div>
            </div>
            
            <button
              type="submit"
              disabled={abrirCajaMutation.isPending}
              className="inline-flex justify-center items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
            >
              <Unlock className="w-4 h-4 mr-2" />
              {abrirCajaMutation.isPending ? 'Abriendo...' : 'Abrir Caja'}
            </button>
            {abrirCajaMutation.isError && (
              <p className="text-red-500 text-sm mt-2">Error al abrir la caja. Verifica tus datos.</p>
            )}
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Gestión de Caja</h1>
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
          <Unlock className="w-4 h-4 mr-2" /> Caja Abierta
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white p-5 rounded-lg shadow border-l-4 border-blue-500">
          <p className="text-sm font-medium text-gray-500">Fondo Inicial</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">S/ {parseFloat(caja.opening_amount).toFixed(2)}</p>
        </div>
        <div className="bg-white p-5 rounded-lg shadow border-l-4 border-green-500">
          <p className="text-sm font-medium text-gray-500">Ingresos del Día</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">S/ {(caja.total_dia || 0).toFixed(2)}</p>
        </div>
        <div className="bg-white p-5 rounded-lg shadow border-l-4 border-amber-500 bg-amber-50">
          <p className="text-sm font-medium text-gray-500">Efectivo Físico Esperado</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            S/ {
              (parseFloat(caja.opening_amount) + 
              (caja.ingresos_por_metodo?.find(i => i.metodo_pago === 'CASH')?.total || 0)).toFixed(2)
            }
          </p>
          <p className="text-xs text-amber-700 mt-1">Solo suma ingresos en efectivo</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b">
          <h2 className="text-lg font-medium text-gray-900">Resumen por Método de Pago</h2>
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
            {caja.ingresos_por_metodo?.map(metodo => (
              <div key={metodo.metodo_pago} className="p-3 bg-gray-50 rounded border">
                <span className="block text-xs text-gray-500 mb-1">{metodo.metodo_pago}</span>
                <span className="font-semibold text-gray-900">S/ {metodo.total.toFixed(2)}</span>
              </div>
            ))}
            {(!caja.ingresos_por_metodo || caja.ingresos_por_metodo.length === 0) && (
              <p className="text-sm text-gray-500 col-span-full">Aún no hay cobros registrados hoy.</p>
            )}
          </div>
        </div>

        <div className="p-6 bg-slate-50">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Cierre de Caja</h2>
          <p className="text-sm text-gray-600 mb-4">
            Al cerrar tu turno, debes declarar cuánto dinero físico exacto hay en el cajón. El sistema calculará cualquier diferencia de forma automática.
          </p>
          
          <form onSubmit={handleClose} className="space-y-4 max-w-sm">
            <div>
              <label className="block text-sm font-medium text-gray-700">Monto Físico Declarado (S/)</label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-gray-500 sm:text-sm">S/</span>
                </div>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={declaredAmount}
                  onChange={(e) => setDeclaredAmount(e.target.value)}
                  className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md"
                  placeholder="0.00"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">Notas (Opcional)</label>
              <textarea
                rows={2}
                value={closingNotes}
                onChange={(e) => setClosingNotes(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                placeholder="Justificación si hay faltante/sobrante..."
              />
            </div>
            
            <button
              type="submit"
              disabled={cerrarCajaMutation.isPending}
              className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-slate-800 hover:bg-slate-900 disabled:opacity-50"
            >
              <Lock className="w-4 h-4 mr-2" />
              {cerrarCajaMutation.isPending ? 'Cerrando caja...' : 'Confirmar Cierre'}
            </button>
            
            {cerrarCajaMutation.isError && (
              <p className="text-red-500 text-sm flex items-center mt-2">
                <AlertTriangle size={14} className="mr-1" />
                No se pudo cerrar la caja.
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};

export default CajaPage;
