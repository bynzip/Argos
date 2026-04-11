import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { 
  Users, 
  Home, 
  Settings, 
  Briefcase, 
  Package, 
  Ticket, 
  DollarSign,
  UserCircle2
} from 'lucide-react';

type ModuleConfig = {
  name: string;
  path: string;
  icon: React.ReactNode;
  permissionRequired?: string;
};

export default function Sidebar() {
  const { user } = useAuthStore();
  const location = useLocation();

  const hasPermission = (permission?: string) => {
    if (!permission) return true;
    if (user?.permissions?.includes('all')) return true;
    return user?.permissions?.some(p => p.startsWith(permission));
  };

  const menuItems: ModuleConfig[] = [
    { name: 'Dashboard', path: '/', icon: <Home size={20} /> },
    { name: 'Tickets', path: '/tickets', icon: <Ticket size={20} />, permissionRequired: 'tickets' },
    { name: 'Clientes', path: '/customers', icon: <Users size={20} />, permissionRequired: 'customers' },
    { name: 'Inventario', path: '/inventory', icon: <Package size={20} />, permissionRequired: 'inventory' },
    { name: 'Finanzas', path: '/finance', icon: <DollarSign size={20} />, permissionRequired: 'finance' },
    { name: 'RRHH', path: '/hr', icon: <Briefcase size={20} />, permissionRequired: 'hr' },
    { name: 'Usuarios', path: '/users', icon: <Settings size={20} />, permissionRequired: 'users' },
  ];

  return (
    <aside className="surface-card w-[260px] flex-col flex h-[calc(100vh-2rem)] overflow-y-auto p-4 shrink-0">
      {/* Perfil top panel con gradiente simplificado */}
      <div className="rounded-3xl bg-[radial-gradient(circle_at_top_left,rgba(243,182,31,0.18),transparent_24%),linear-gradient(135deg,#2347a5_0%,#2c5fd0_70%,#356fef_100%)] p-5 text-white shadow-[0_24px_60px_rgba(35,71,165,0.24)]">
        <div className="flex flex-col items-center justify-center gap-3 text-center py-2">
          <div className="font-black text-2xl tracking-widest bg-white text-[#2347a5] px-3 py-1.5 rounded-xl shadow-sm">
            ARGOS
          </div>
          <div className="rounded-full border border-white/20 bg-white/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.15em] text-blue-50 mt-2">
            Sede Principal
          </div>
        </div>
      </div>

      <nav className="mt-6 space-y-2 flex-1">
        {menuItems.map((item) => {
          if (!hasPermission(item.permissionRequired)) return null;

          const isActive = location.pathname === item.path || 
                          (item.path !== '/' && location.pathname.startsWith(item.path));

          return (
            <Link
              key={item.name}
              to={item.path}
              className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                isActive
                  ? 'border-blue-200 bg-gradient-to-r from-[#2347a5] to-blue-500 font-bold text-white shadow-[0_18px_34px_rgba(35,71,165,0.18)]'
                  : 'border-slate-200/50 bg-white text-slate-600 hover:border-amber-200 hover:text-[#2347a5]'
              }`}
            >
              {item.icon}
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Info panel bottom */}
      <div className="mt-4 surface-panel p-4 text-sm text-slate-500">
        <div className="flex items-center gap-3">
          <div className="soft-icon p-3 shrink-0">
            <UserCircle2 className="h-5 w-5" />
          </div>
          <div>
            <div className="font-semibold text-slate-900">Argos MVP</div>
            <div className="text-xs">Interfaz corporativa.</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
