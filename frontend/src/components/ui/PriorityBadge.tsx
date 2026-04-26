import React from 'react';

const priorityMap: Record<string, { label: string, color: string }> = {
  'LOW': { label: 'Baja', color: 'bg-gray-100 text-gray-800' },
  'MEDIUM': { label: 'Media', color: 'bg-blue-100 text-blue-800' },
  'HIGH': { label: 'Alta', color: 'bg-orange-100 text-orange-800' },
  'CRITICAL': { label: 'Crítica', color: 'bg-red-100 text-red-800' },
};

interface Props {
  priority: string;
}

export const PriorityBadge: React.FC<Props> = ({ priority }) => {
  const config = priorityMap[priority] || { label: priority, color: 'bg-gray-100 text-gray-800' };
  
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
      {config.label}
    </span>
  );
};
