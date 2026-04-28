import { useQuery } from '@tanstack/react-query';
import api from '../../lib/axios';
import { Plus, MoreVertical } from 'lucide-react';
import { DataTable } from '../../components/ui/DataTable';

interface User {
  id: number;
  username: string;
  email: string;
  nombre: string;
  is_active: boolean;
  role: string;
}

export default function UserListPage() {
  const { data: users, isLoading } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await api.get('/api/users/');
      return response.data.results ?? response.data;
    },
  });

  const columns = [
    {
      header: 'Nombre',
      cell: (user: User) => (
        <div className="flex flex-col">
          <span className="text-sm font-medium text-gray-900">{user.nombre}</span>
          <span className="text-sm text-gray-500">{user.email}</span>
        </div>
      ),
    },
    {
      header: 'Usuario',
      accessorKey: 'username' as keyof User,
    },
    {
      header: 'Rol',
      cell: (user: User) => (
        <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
          {user.role || 'Sin rol'}
        </span>
      ),
    },
    {
      header: 'Estado',
      cell: (user: User) => (
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
          user.is_active 
            ? 'bg-green-100 text-green-800' 
            : 'bg-red-100 text-red-800'
        }`}>
          {user.is_active ? 'Activo' : 'Suspendido'}
        </span>
      ),
    },
    {
      header: '',
      cell: () => (
        <button className="text-gray-400 hover:text-gray-600 flex justify-end w-full">
          <MoreVertical size={20} />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestión de Usuarios</h1>
          <p className="mt-1 text-sm text-gray-500">
            Administra los accesos y roles del personal del sistema.
          </p>
        </div>
        
        <button className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors">
          <Plus size={18} />
          Nuevo Usuario
        </button>
      </div>

      <div className="bg-white rounded-lg shadow">
        <DataTable
          columns={columns}
          data={users || []}
          keyExtractor={(user) => user.id}
          isLoading={isLoading}
          searchPlaceholder="Buscar por nombre o usuario..."
        />
      </div>
    </div>
  );
}
