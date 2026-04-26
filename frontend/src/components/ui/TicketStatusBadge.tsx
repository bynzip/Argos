import React from 'react';

const statusMap: Record<string, { label: string, color: string }> = {
  'INTAKE': { label: 'Ingreso', color: 'bg-gray-100 text-gray-800' },
  'DIAGNOSTIC': { label: 'Diagnóstico', color: 'bg-blue-100 text-blue-800' },
  'QUOTED': { label: 'Cotizado', color: 'bg-purple-100 text-purple-800' },
  'APPROVED': { label: 'Aprobado', color: 'bg-indigo-100 text-indigo-800' },
  'WAITING_PARTS': { label: 'En espera de repuesto', color: 'bg-orange-100 text-orange-800' },
  'IN_REPAIR': { label: 'En reparación', color: 'bg-yellow-100 text-yellow-800' },
  'IN_TESTING': { label: 'En pruebas', color: 'bg-teal-100 text-teal-800' },
  'READY': { label: 'Listo', color: 'bg-green-100 text-green-800' },
  'DELIVERED': { label: 'Entregado', color: 'bg-emerald-100 text-emerald-800' },
  'CLOSED': { label: 'Cerrado', color: 'bg-slate-100 text-slate-800' },
  'REJECTED': { label: 'Rechazado', color: 'bg-red-100 text-red-800' },
  'STORAGE': { label: 'Cochera', color: 'bg-rose-100 text-rose-800' },
};

interface Props {
  status: string;
}

export const TicketStatusBadge: React.FC<Props> = ({ status }) => {
  const config = statusMap[status] || { label: status, color: 'bg-gray-100 text-gray-800' };
  
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
      {config.label}
    </span>
  );
};
