import { useState } from 'react';
import { ArrowLeft, Plus, Wrench } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Label } from '../../components/ui/Label';
import { PageHeader } from '../../components/ui/PageHeader';
import { Select } from '../../components/ui/Select';
import { Textarea } from '../../components/ui/Textarea';
import {
  useCreateService,
  useCreateServiceCategory,
  useServiceCategories,
  useServices,
  PaginatedResponse,
  Service,
} from '../../hooks/useQuotes';

export default function ServiceCatalogPage() {
  const navigate = useNavigate();
  const { data: categories = [] } = useServiceCategories();
  const { data } = useServices({ page_size: 100 });
  const services = data && !Array.isArray(data) && 'results' in data ? (data as PaginatedResponse<Service>).results : Array.isArray(data) ? data : [];
  const createCategory = useCreateServiceCategory();
  const createService = useCreateService();

  const [categoryName, setCategoryName] = useState('');
  const [serviceForm, setServiceForm] = useState({
    category: '',
    nombre: '',
    descripcion: '',
    precio_base: '',
    horas_estimadas: '',
  });

  return (
    <div className="p-8 max-w-[1400px] mx-auto space-y-8">
      <Button variant="ghost" size="sm" onClick={() => navigate('/quotes')}>
        <ArrowLeft size={16} className="mr-2" />
        Volver a cotizaciones
      </Button>

      <PageHeader
        title="Catálogo de Servicios"
        subtitle="Servicios técnicos reutilizables para cotizaciones y trabajos del taller."
      />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Nueva categoría</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Categoría</Label>
              <Input value={categoryName} onChange={(e) => setCategoryName(e.target.value)} placeholder="Ej. Diagnóstico" />
            </div>
            <Button
              onClick={() => {
                if (!categoryName.trim()) return;
                createCategory.mutate({ nombre: categoryName, activo: true }, {
                  onSuccess: () => setCategoryName(''),
                });
              }}
              disabled={createCategory.isPending}
            >
              <Plus size={16} className="mr-2" />
              Crear categoría
            </Button>
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Nuevo servicio</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Categoría</Label>
              <Select
                value={serviceForm.category}
                onChange={(e) => setServiceForm((prev) => ({ ...prev, category: e.target.value }))}
              >
                <option value="">Sin categoría</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.nombre}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Nombre</Label>
              <Input
                value={serviceForm.nombre}
                onChange={(e) => setServiceForm((prev) => ({ ...prev, nombre: e.target.value }))}
                placeholder="Ej. Mantenimiento preventivo"
              />
            </div>
            <div>
              <Label>Precio base</Label>
              <Input
                type="number"
                step="0.01"
                value={serviceForm.precio_base}
                onChange={(e) => setServiceForm((prev) => ({ ...prev, precio_base: e.target.value }))}
              />
            </div>
            <div>
              <Label>Horas estimadas</Label>
              <Input
                type="number"
                step="0.25"
                value={serviceForm.horas_estimadas}
                onChange={(e) => setServiceForm((prev) => ({ ...prev, horas_estimadas: e.target.value }))}
              />
            </div>
            <div className="md:col-span-2">
              <Label>Descripción</Label>
              <Textarea
                rows={3}
                value={serviceForm.descripcion}
                onChange={(e) => setServiceForm((prev) => ({ ...prev, descripcion: e.target.value }))}
              />
            </div>
            <div className="md:col-span-2">
              <Button
                onClick={() => {
                  if (!serviceForm.nombre.trim() || !serviceForm.precio_base) return;
                  createService.mutate({
                    category: serviceForm.category ? parseInt(serviceForm.category) : null,
                    nombre: serviceForm.nombre,
                    descripcion: serviceForm.descripcion,
                    precio_base: parseFloat(serviceForm.precio_base),
                    horas_estimadas: serviceForm.horas_estimadas ? parseFloat(serviceForm.horas_estimadas) : null,
                    activo: true,
                  }, {
                    onSuccess: () => setServiceForm({
                      category: '',
                      nombre: '',
                      descripcion: '',
                      precio_base: '',
                      horas_estimadas: '',
                    }),
                  });
                }}
                disabled={createService.isPending}
              >
                <Plus size={16} className="mr-2" />
                Crear servicio
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <Wrench size={18} className="text-[var(--gray-400)]" />
          <CardTitle>Servicios disponibles</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-[var(--gray-50)] text-[11px] font-bold text-[var(--gray-400)] uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3 text-left">Código</th>
                <th className="px-6 py-3 text-left">Nombre</th>
                <th className="px-6 py-3 text-left">Categoría</th>
                <th className="px-6 py-3 text-right">Precio base</th>
                <th className="px-6 py-3 text-right">Horas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--gray-100)]">
              {services.map((service) => (
                <tr key={service.id}>
                  <td className="px-6 py-3 font-mono">{service.codigo}</td>
                  <td className="px-6 py-3 font-medium">{service.nombre}</td>
                  <td className="px-6 py-3">{service.category_name || '-'}</td>
                  <td className="px-6 py-3 text-right font-bold">S/ {parseFloat(service.precio_base).toFixed(2)}</td>
                  <td className="px-6 py-3 text-right">{service.horas_estimadas || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
