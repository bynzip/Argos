import { useMemo, useState } from 'react';

import { Button } from '../ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';
import { useQuote } from '../../hooks/useQuotes';
import { useCreateReservation, useStockItems } from '../../hooks/useInventory';

type ReservationModalProps = {
  ticketId: string;
  activeQuoteId?: number | null;
  onClose: () => void;
};

export function ReservationModal({ ticketId, activeQuoteId, onClose }: ReservationModalProps) {
  const { data: quote } = useQuote(activeQuoteId || null);
  const { data: stockItemsResponse } = useStockItems({ available_only: 'true', page_size: 100 });
  const createReservation = useCreateReservation();

  const stockItems = stockItemsResponse && !Array.isArray(stockItemsResponse) && 'results' in stockItemsResponse
    ? stockItemsResponse.results
    : Array.isArray(stockItemsResponse) ? stockItemsResponse : [];

  const suggestedProductLines = useMemo(() => (
    quote?.lines.filter((line) => line.line_type === 'PRODUCT' && line.product) || []
  ), [quote]);

  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [selectedStockItem, setSelectedStockItem] = useState<string>('');
  const [cantidad, setCantidad] = useState('1.000');
  const [notas, setNotas] = useState('');

  const availableProducts = useMemo(() => {
    const map = new Map<number, { id: number; label: string }>();
    stockItems.forEach((item) => {
      map.set(item.product, {
        id: item.product,
        label: `${item.product_name} (${item.product_code})`,
      });
    });
    return Array.from(map.values());
  }, [stockItems]);

  const filteredStockItems = selectedProduct
    ? stockItems.filter((item) => item.product === parseInt(selectedProduct))
    : stockItems;

  const useSuggestion = (productId: number | null | undefined, qty: string) => {
    if (!productId) return;
    setSelectedProduct(String(productId));
    setCantidad(parseFloat(qty || '0').toFixed(3));
    const match = stockItems.find((item) => item.product === productId);
    if (match) {
      setSelectedStockItem(String(match.id));
    }
  };

  const handleReserve = async () => {
    if (!selectedStockItem) return;
    await createReservation.mutateAsync({
      ticket_id: ticketId,
      stock_item_id: parseInt(selectedStockItem),
      cantidad,
      notas,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,22,35,0.45)] backdrop-blur-sm p-4">
      <Card className="w-full max-w-3xl shadow-[var(--shadow-modal)]">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Reservar repuestos</CardTitle>
          <Button variant="ghost" onClick={onClose}>Cerrar</Button>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          {suggestedProductLines.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-[var(--gray-700)]">Sugerencias desde la cotización aprobada</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {suggestedProductLines.map((line, index) => (
                  <button
                    key={`${line.product}-${index}`}
                    type="button"
                    className="text-left rounded-xl border border-[var(--gray-200)] bg-[var(--gray-50)] px-4 py-3 hover:border-[var(--color-brand-blue)]"
                    onClick={() => useSuggestion(line.product, line.cantidad)}
                  >
                    <div className="font-bold text-[var(--gray-800)]">{line.product_name || line.descripcion}</div>
                    <div className="text-xs text-[var(--gray-500)]">Cantidad sugerida: {line.cantidad}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Producto</Label>
              <Select value={selectedProduct} onChange={(e) => {
                setSelectedProduct(e.target.value);
                setSelectedStockItem('');
              }}>
                <option value="">Selecciona un producto...</option>
                {availableProducts.map((product) => (
                  <option key={product.id} value={product.id}>{product.label}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Stock por almacén</Label>
              <Select value={selectedStockItem} onChange={(e) => setSelectedStockItem(e.target.value)}>
                <option value="">Selecciona stock...</option>
                {filteredStockItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.warehouse_name} · Disp. {item.disponible}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Cantidad a reservar</Label>
              <Input type="number" step="0.001" value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <Label>Notas</Label>
              <Textarea rows={3} value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Motivo, ubicación o detalle operativo..." />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[var(--gray-100)]">
            <Button variant="secondary" onClick={onClose}>Cancelar</Button>
            <Button onClick={handleReserve} disabled={!selectedStockItem || createReservation.isPending}>
              {createReservation.isPending ? 'Reservando...' : 'Crear reserva'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
