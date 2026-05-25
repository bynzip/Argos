export const PURCHASE_ORDER_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Borrador',
  SENT: 'Enviada',
  PARTIALLY_RECEIVED: 'Recepcion parcial',
  CLOSED_INCOMPLETE: 'Cerrada incompleta',
  RECEIVED: 'Recibida',
  CANCELLED: 'Cancelada',
};

export const formatPurchaseDate = (value?: string | null) => {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('es-PE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
};

export const formatInteger = (value: string | number | null | undefined) => {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed.toFixed(0) : '0';
};

export const clampIntegerInput = (value: string, fallback = '0', minimum = 0) => {
  if (value.trim() === '') return '';
  const parsed = Math.floor(Number(value));
  if (!Number.isFinite(parsed)) return fallback;
  return String(Math.max(minimum, parsed));
};
