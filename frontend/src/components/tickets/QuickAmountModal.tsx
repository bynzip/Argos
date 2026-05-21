import { useMemo, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';

import { useAssignQuickAmount } from '../../hooks/useTickets';
import { PaginatedResponse as ProductPaginatedResponse, Product, useProducts } from '../../hooks/useProducts';
import { PaginatedResponse as QuotePaginatedResponse, Service, useServices } from '../../hooks/useQuotes';
import { getApiErrorMessage } from '../../lib/apiErrors';
import { Button } from '../ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { Select } from '../ui/Select';

type QuickLine = {
  line_type: 'PRODUCT' | 'SERVICE';
  product: string;
  service: string;
  cantidad: string;
  precio_unitario: string;
};

const createEmptyLine = (): QuickLine => ({
  line_type: 'SERVICE',
  product: '',
  service: '',
  cantidad: '1',
  precio_unitario: '0',
});

const money = (value: string | number | null | undefined) => {
  const numeric = Number.parseFloat(String(value ?? 0));
  return Number.isFinite(numeric) ? numeric : 0;
};

type QuickAmountModalProps = {
  ticketId: string;
  onClose: () => void;
};

export function QuickAmountModal({ ticketId, onClose }: QuickAmountModalProps) {
  const assignQuickAmount = useAssignQuickAmount();
  const { data: productsResponse } = useProducts({ page_size: 200 });
  const { data: servicesResponse } = useServices({ page_size: 200 });

  const products = productsResponse && !Array.isArray(productsResponse) && 'results' in productsResponse
    ? (productsResponse as ProductPaginatedResponse<Product>).results
    : Array.isArray(productsResponse) ? productsResponse : [];
  const services = servicesResponse && !Array.isArray(servicesResponse) && 'results' in servicesResponse
    ? (servicesResponse as QuotePaginatedResponse<Service>).results
    : Array.isArray(servicesResponse) ? servicesResponse : [];

  const [lines, setLines] = useState<QuickLine[]>([createEmptyLine()]);
  const [descuento, setDescuento] = useState('0');
  const [igvRate, setIgvRate] = useState('18');
  const [submitError, setSubmitError] = useState<string | null>(null);

  const totals = useMemo(() => {
    const subtotal = lines.reduce((acc, line) => {
      return acc + (money(line.cantidad) * money(line.precio_unitario));
    }, 0);
    const descuentoValue = Math.max(0, money(descuento));
    const taxable = Math.max(0, subtotal - descuentoValue);
    const igv = taxable * (Math.max(0, money(igvRate)) / 100);
    return {
      subtotal,
      descuento: descuentoValue,
      igv,
      total: taxable + igv,
    };
  }, [descuento, igvRate, lines]);

  const updateLine = (index: number, partial: Partial<QuickLine>) => {
    setLines((prev) => prev.map((line, lineIndex) => (
      lineIndex === index ? { ...line, ...partial } : line
    )));
  };

  const handleLineTypeChange = (index: number, lineType: 'PRODUCT' | 'SERVICE') => {
    updateLine(index, {
      line_type: lineType,
      product: '',
      service: '',
      precio_unitario: '0',
    });
  };

  const handleReferenceChange = (index: number, value: string) => {
    const line = lines[index];
    if (line.line_type === 'PRODUCT') {
      const product = products.find((item) => String(item.id) === value);
      updateLine(index, {
        product: value,
        precio_unitario: product?.precio_venta || '0',
      });
      return;
    }

    const service = services.find((item) => String(item.id) === value);
    updateLine(index, {
      service: value,
      precio_unitario: service?.precio_base || '0',
    });
  };

  const handleSubmit = async () => {
    setSubmitError(null);

    if (lines.length === 0) {
      setSubmitError('Debes agregar al menos una linea.');
      return;
    }

    for (const line of lines) {
      if (line.line_type === 'PRODUCT' && !line.product) {
        setSubmitError('Todas las lineas de producto deben tener un producto seleccionado.');
        return;
      }
      if (line.line_type === 'SERVICE' && !line.service) {
        setSubmitError('Todas las lineas de servicio deben tener un servicio seleccionado.');
        return;
      }
      if (!/^[1-9]\d*$/.test(String(line.cantidad).trim())) {
        setSubmitError('Cada linea debe tener una cantidad entera positiva.');
        return;
      }
      if (money(line.precio_unitario) < 0) {
        setSubmitError('El precio unitario no puede ser negativo.');
        return;
      }
    }

    try {
      await assignQuickAmount.mutateAsync({
        ticketId,
        payload: {
          descuento,
          igv_rate: igvRate,
          lines: lines.map((line) => ({
            line_type: line.line_type,
            product: line.line_type === 'PRODUCT' ? Number(line.product) : null,
            service: line.line_type === 'SERVICE' ? Number(line.service) : null,
            cantidad: line.cantidad,
            precio_unitario: line.precio_unitario,
            descuento_linea: '0.00',
          })),
        },
      });
      onClose();
    } catch (error: any) {
      setSubmitError(getApiErrorMessage(error, 'No se pudo asignar el monto rapido.'));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,22,35,0.45)] p-4 backdrop-blur-sm">
      <Card className="w-full max-w-6xl">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div className="space-y-1">
            <CardTitle>Asignar monto</CardTitle>
            <p className="text-sm text-[var(--gray-500)]">
              Flujo rapido para dejar el ticket listo para reparar y cobrar.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-[var(--gray-200)] text-[var(--gray-400)] transition-colors hover:border-[var(--gray-300)] hover:text-[var(--gray-700)]"
          >
            <X size={18} />
          </button>
        </CardHeader>

        <CardContent className="space-y-6 pt-6">
          {submitError && (
            <div className="rounded-xl border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] px-4 py-3 text-sm text-[var(--color-danger)]">
              {submitError}
            </div>
          )}

          <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--gray-800)]">Servicios y productos</h3>
                  <p className="text-sm text-[var(--gray-500)]">Por defecto cada linea inicia como servicio.</p>
                </div>
                <Button variant="secondary" size="sm" onClick={() => setLines((prev) => [...prev, createEmptyLine()])}>
                  <Plus size={16} className="mr-1" />
                  Agregar linea
                </Button>
              </div>

              {lines.map((line, index) => (
                <div key={`quick-line-${index}`} className="space-y-4 rounded-xl border border-[var(--gray-200)] p-4">
                  <div className="grid gap-4 md:grid-cols-5">
                    <div>
                      <Label>Tipo</Label>
                      <Select
                        value={line.line_type}
                        onChange={(event) => handleLineTypeChange(index, event.target.value as 'PRODUCT' | 'SERVICE')}
                      >
                        <option value="SERVICE">Servicio</option>
                        <option value="PRODUCT">Producto</option>
                      </Select>
                    </div>

                    <div className="md:col-span-2">
                      <Label>{line.line_type === 'PRODUCT' ? 'Producto' : 'Servicio'}</Label>
                      <Select
                        value={line.line_type === 'PRODUCT' ? line.product : line.service}
                        onChange={(event) => handleReferenceChange(index, event.target.value)}
                      >
                        <option value="">Selecciona...</option>
                        {(line.line_type === 'PRODUCT' ? products : services).map((item: any) => (
                          <option key={item.id} value={item.id}>{item.nombre}</option>
                        ))}
                      </Select>
                    </div>

                    <div>
                      <Label>Cantidad</Label>
                      <Input
                        type="number"
                        min="1"
                        step="1"
                        value={line.cantidad}
                        onChange={(event) => updateLine(index, { cantidad: event.target.value })}
                      />
                    </div>

                    <div>
                      <Label>P. unitario</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.precio_unitario}
                        onChange={(event) => updateLine(index, { precio_unitario: event.target.value })}
                      />
                    </div>
                  </div>

                  {lines.length > 1 && (
                    <div className="flex justify-end">
                      <Button variant="ghost" size="sm" onClick={() => setLines((prev) => prev.filter((_, lineIndex) => lineIndex !== index))}>
                        <Trash2 size={16} className="mr-1" />
                        Quitar
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="space-y-4 rounded-xl border border-[var(--gray-200)] bg-[var(--gray-50)] p-5">
              <div>
                <h3 className="text-sm font-semibold text-[var(--gray-800)]">Resumen comercial</h3>
                <p className="text-sm text-[var(--gray-500)]">El cobro seguira ligado a la cotizacion interna del ticket.</p>
              </div>

              <div>
                <Label>Descuento global</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={descuento}
                  onChange={(event) => setDescuento(event.target.value)}
                />
              </div>

              <div>
                <Label>IGV (%)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={igvRate}
                  onChange={(event) => setIgvRate(event.target.value)}
                />
              </div>

              <div className="space-y-3 rounded-xl border border-[var(--gray-200)] bg-white p-4">
                <div className="flex items-center justify-between text-sm text-[var(--gray-600)]">
                  <span>Subtotal</span>
                  <span className="font-semibold text-[var(--gray-800)]">S/ {totals.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-sm text-[var(--gray-600)]">
                  <span>Descuento</span>
                  <span className="font-semibold text-[var(--gray-800)]">- S/ {totals.descuento.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-sm text-[var(--gray-600)]">
                  <span>IGV</span>
                  <span className="font-semibold text-[var(--gray-800)]">S/ {totals.igv.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between border-t border-[var(--gray-100)] pt-3">
                  <span className="text-sm font-bold text-[var(--gray-800)]">Total</span>
                  <span className="text-2xl font-black text-[var(--color-brand-blue)]">S/ {totals.total.toFixed(2)}</span>
                </div>
              </div>

              <div>
                <Button className="w-full" onClick={handleSubmit} disabled={assignQuickAmount.isPending}>
                  {assignQuickAmount.isPending ? 'Guardando...' : 'Guardar monto'}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
