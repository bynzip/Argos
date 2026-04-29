import { useQuery } from '@tanstack/react-query';
import api from '../../lib/axios';
import { Plus, Eye, Shield, User as UserIcon } from 'lucide-react';
import { DataTable } from '../../components/ui/DataTable';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { useNavigate } from 'react-router-dom';
import { cn } from '../../lib/utils';

interface User {
  id: number;
  username: string;
  email: string;
  nombre: string;
  is_active: boolean;
  role: string;
}

export default function UserListPage() {
  const navigate = useNavigate();
  const { data: users, isLoading } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await api.get('/api/users/');
      return response.data.results ?? response.data;
    },
  });

  const columns = [
    {
      header: 'Usuario / Personal',
      cell: (user: User) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[var(--gray-50)] flex items-center justify-center text-[var(--gray-400)] border border-[var(--gray-200)] shrink-0">
            <UserIcon size={18} />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-[var(--gray-800)] leading-tight">{user.nombre}</span>
            <span className="text-[12px] text-[var(--gray-400)] font-medium">{user.email}</span>
          </div>
        </div>
      ),
    },
    {
      header: 'Username',
      cell: (user: User) => (
        <span className="font-mono text-[13px] bg-[var(--gray-50)] px-2 py-0.5 rounded border border-[var(--gray-200)] text-[var(--gray-600)]">
          {user.username}
        </span>
      ),
    },
    {
      header: 'Rol / Permisos',
      cell: (user: User) => (
        <div className="flex items-center gap-2">
          <Shield size={14} className="text-[var(--color-brand-blue)]" />
          <span className="text-[13px] font-semibold text-[var(--gray-700)]">
            {user.role || 'Sin rol asignado'}
          </span>
        </div>
      ),
    },
    {
      header: 'Estado',
      cell: (user: User) => (
        <span className={cn(
          "inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border",
          user.is_active 
            ? 'bg-[var(--color-success-bg)] text-[var(--color-success)] border-[var(--color-success-border)]' 
            : 'bg-[var(--color-danger-bg)] text-[var(--color-danger)] border-[var(--color-danger-border)]'
        )}>
          <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5" />
          {user.is_active ? 'Activo' : 'Suspendido'}
        </span>
      ),
    },
    {
      header: '',
      cell: (user: User) => (
        <div className="flex justify-end">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 text-[var(--gray-400)] hover:text-[var(--color-brand-blue)]"
            onClick={() => navigate(`/users/edit/${user.id}`)}
          >
            <Eye size={16} />
          </Button>
        </div>
      ),
      className: "w-[50px]"
    },
  ];

  return (
    <div className="p-8 max-w-[1400px] mx-auto">
      <PageHeader 
        title="Administración de Usuarios"
        subtitle="Gestiona los accesos, roles y permisos del personal de Argos ERP."
        actions={
          <Button variant="primary" onClick={() => navigate('/users/new')}>
            <Plus size={18} />
            Nuevo Usuario
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={users || []}
        keyExtractor={(user) => user.id}
        isLoading={isLoading}
        searchPlaceholder="Buscar por nombre, correo o usuario..."
      />
    </div>
  );
}
