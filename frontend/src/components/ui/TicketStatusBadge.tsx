import React from 'react';
import { cn } from '../../lib/utils';

const statusMap: Record<string, { label: string, className: string }> = {
  'INTAKE': { label: 'Ingreso', className: 'bg-[#F1F3F7] text-[#6B7896] border-[#E4E8F0]' },
  'DIAGNOSTIC': { label: 'Diagnóstico', className: 'bg-[#EFF3FF] text-[#2347A5] border-[#BFCFFF]' },
  'QUOTED': { label: 'Cotizado', className: 'bg-[#F5F3FF] text-[#7C3AED] border-[#DDD6FE]' },
  'APPROVED': { label: 'Aprobado', className: 'bg-[#F0FDF4] text-[#16A34A] border-[#BBF7D0]' },
  'WAITING_PARTS': { label: 'En espera de repuesto', className: 'bg-[#FFF7ED] text-[#C2410C] border-[#FDBA74]' },
  'IN_REPAIR': { label: 'En reparación', className: 'bg-[#FFFBEB] text-[#D97706] border-[#FDE68A]' },
  'IN_TESTING': { label: 'En pruebas', className: 'bg-[#F0FDFA] text-[#0D9488] border-[#99F6E4]' },
  'READY': { label: 'Listo', className: 'bg-[#F0FDF4] text-[#16A34A] border-[#BBF7D0]' },
  'DELIVERED': { label: 'Entregado', className: 'bg-[#F0FDF4] text-[#15803D] border-[#86EFAC]' },
  'CLOSED': { label: 'Cerrado', className: 'bg-[#F1F3F7] text-[#6B7896] border-[#E4E8F0]' },
  'REJECTED': { label: 'Rechazado', className: 'bg-[#FEF2F2] text-[#DC2626] border-[#FECACA]' },
  'STORAGE': { label: 'Cochera', className: 'bg-[#F1F3F7] text-[#6B7896] border-[#E4E8F0]' },
};

interface Props {
  status: string;
}

export const TicketStatusBadge: React.FC<Props> = ({ status }) => {
  const config = statusMap[status] || { label: status, className: 'bg-[#F1F3F7] text-[#6B7896] border-[#E4E8F0]' };
  
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[12px] font-medium border whitespace-nowrap",
      config.className
    )}>
      <span className="w-1.5 h-1.5 rounded-full bg-currentColor" style={{ backgroundColor: 'currentColor' }} />
      {config.label}
    </span>
  );
};
