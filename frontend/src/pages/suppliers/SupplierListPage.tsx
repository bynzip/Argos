import { useState } from 'react';

import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Label } from '../../components/ui/Label';
import { PageHeader } from '../../components/ui/PageHeader';
import { useCreateSupplier, useSuppliers } from '../../hooks/useSuppliers';

export default function SupplierListPage() {
  const { data: suppliers, isLoading } = useSuppliers();
  const createSupplier = useCreateSupplier();
  const [nombre, setNombre] = useState('');
  const [ruc, setRuc] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createSupplier.mutate(
      { nombre, ruc, telefono, email },
      {
        onSuccess: () => {
          setNombre('');
          setRuc('');
          setTelefono('');
          setEmail('');
        },
      },
    );
  };

  return (
    <div className="p-8 max-w-[1200px] mx-auto space-y-8">
      <PageHeader
        title="Proveedores"
        subtitle="Base operativa de compras para el cierre de Fase 1."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Nuevo proveedor</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <Label required>Nombre</Label>
                <Input value={nombre} onChange={(e) => setNombre(e.target.value)} required />
              </div>
              <div>
                <Label>RUC</Label>
                <Input value={ruc} onChange={(e) => setRuc(e.target.value)} />
              </div>
              <div>
                <Label>Teléfono</Label>
                <Input value={telefono} onChange={(e) => setTelefono(e.target.value)} />
              </div>
              <div>
                <Label>Email</Label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <Button type="submit" className="w-full" disabled={createSupplier.isPending}>
                {createSupplier.isPending ? 'Guardando...' : 'Crear proveedor'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Listado</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {isLoading ? (
              <div className="p-8 text-center text-[var(--gray-500)]">Cargando proveedores...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-[11px] uppercase text-[var(--gray-400)]">
                    <tr>
                      <th className="text-left py-3">Nombre</th>
                      <th className="text-left py-3">RUC</th>
                      <th className="text-left py-3">Contacto</th>
                      <th className="text-left py-3">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--gray-100)]">
                    {(suppliers || []).map((supplier: any) => (
                      <tr key={supplier.id}>
                        <td className="py-3 font-semibold text-[var(--gray-800)]">{supplier.nombre}</td>
                        <td className="py-3">{supplier.ruc || '-'}</td>
                        <td className="py-3">{supplier.telefono || supplier.email || '-'}</td>
                        <td className="py-3">
                          <span className="inline-flex px-2 py-1 rounded-full bg-[var(--color-success-bg)] text-[var(--color-success)] text-[11px] font-bold">
                            {supplier.activo ? 'ACTIVO' : 'INACTIVO'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
