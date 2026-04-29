import React from 'react';
import { cn } from '../../lib/utils';

const priorityMap: Record<string, { label: string, className: string }> = {
  'LOW': { label: 'Baja', className: 'bg-[#F1F3F7] text-[#6B7896]' },
  'MEDIUM': { label: 'Media', className: 'bg-[#EFF3FF] text-[#2347A5]' },
  'HIGH': { label: 'Alta', className: 'bg-[#FFF7ED] text-[#C2410C]' },
  'CRITICAL': { label: 'Crítica', className: 'bg-[#FEF2F2] text-[#DC2626] font-semibold' },
};

interface Props {
  priority: string;
}

export const PriorityBadge: React.FC<Props> = ({ priority }) => {
  const config = priorityMap[priority] || { label: priority, className: 'bg-[#F1F3F7] text-[#6B7896]' };
  
  return (
    <span className={cn(
      "inline-flex items-center px-2.5 py-0.5 rounded-full text-[12px] font-medium",
      config.className
    )}>
      {config.label}
    </span>
  );
};
