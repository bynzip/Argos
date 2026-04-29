import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { 
  Users, 
  Home, 
  Settings, 
  Package, 
  Ticket, 
  DollarSign
} from 'lucide-react';

type ModuleConfig = {
  name: string;
  path: string;
  icon: React.ElementType;
  permissionRequired?: string;
};

export default function Sidebar() {
  const { user } = useAuthStore();
  const location = useLocation();

  const hasPermission = (permission?: string) => {
    if (!permission) return true;
    if (user?.is_superuser) return true;
    // Simplificando lógica de permisos para el MVP basado en el rol o el array de permisos si existe
    if (user?.permissions?.includes('all')) return true;
    return user?.permissions?.some(p => p.startsWith(permission)) || user?.role === 'Administrador';
  };

  const menuItems: ModuleConfig[] = [
    { name: 'Dashboard', path: '/', icon: Home },
    { name: 'Tickets', path: '/tickets', icon: Ticket, permissionRequired: 'tickets' },
    { name: 'Clientes', path: '/customers', icon: Users, permissionRequired: 'customers' },
    { name: 'Inventario', path: '/inventory', icon: Package, permissionRequired: 'inventory' },
    { name: 'Finanzas', path: '/finance', icon: DollarSign, permissionRequired: 'finance' },
    { name: 'Usuarios', path: '/users', icon: Settings, permissionRequired: 'users' },
  ];

  // Helper para las iniciales del usuario
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <aside className="w-[240px] bg-white border-right border-[var(--gray-200)] flex flex-col h-screen shrink-0 shadow-[2px_0_8px_rgba(0,0,0,0.04)] z-20">
      {/* Logo Section */}
      <div className="h-[64px] px-4 flex items-center gap-3 border-bottom border-[var(--gray-100)]">
        <div className="w-9 h-9 rounded-lg bg-brand-gradient flex items-center justify-center text-white font-black text-[14px] shadow-sm">
          AR
        </div>
        <div className="flex flex-col">
          <span className="text-[16px] font-bold text-[var(--gray-800)] leading-tight">Argos</span>
          <span className="text-[11px] font-medium text-[var(--gray-400)] uppercase tracking-[0.08em]">Sede Principal</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {menuItems.map((item) => {
          if (!hasPermission(item.permissionRequired)) return null;

          const isActive = location.pathname === item.path || 
                          (item.path !== '/' && location.pathname.startsWith(item.path));
          
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              to={item.path}
              className={`
                flex items-center gap-3 h-10 px-3 rounded-lg transition-all duration-150
                ${isActive 
                  ? 'bg-[var(--color-info-bg)] text-[var(--color-brand-blue)] font-semibold border-l-[3px] border-[var(--color-brand-blue)] rounded-l-none' 
                  : 'text-[var(--gray-600)] hover:bg-[var(--gray-100)] hover:text-[var(--gray-800)]'
                }
              `}
            >
              <Icon size={18} className={isActive ? 'text-[var(--color-brand-blue)]' : 'text-[var(--gray-400)]'} />
              <span className="text-[14px]">{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* User Section */}
      <div className="p-4 border-t border-[var(--gray-200)] bg-[var(--gray-50)]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-brand-gradient flex items-center justify-center text-white text-[11px] font-bold shadow-sm">
            {user ? getInitials(user.nombre) : '??'}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[13px] font-semibold text-[var(--gray-700)] truncate">
              {user?.nombre || 'Usuario'}
            </span>
            <span className="text-[11px] text-[var(--gray-400)] font-medium truncate">
              {user?.role || 'Personal'}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}
