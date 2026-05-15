import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { LogOut, Bell, Check, ChevronDown, User as UserIcon } from 'lucide-react';

import api from '../../lib/axios';
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications } from '../../hooks/useCore';
import { useAuthStore } from '../../store/authStore';

export default function Navbar() {
  const { user, clearAuth } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const { data: notifications } = useNotifications(true);
  const markReadMutation = useMarkNotificationRead();
  const markAllReadMutation = useMarkAllNotificationsRead();

  const handleLogout = async () => {
    try {
      await api.post('/api/auth/logout/');
    } catch (e) {
      console.error('Error logging out on server', e);
    } finally {
      clearAuth();
      navigate('/login');
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getBreadcrumb = () => {
    const path = location.pathname;
    if (path === '/') return 'Dashboard';
    if (path.startsWith('/tickets')) return 'Gestion de Tickets';
    if (path.startsWith('/customers')) return 'Directorio de Clientes';
    if (path.startsWith('/inventory')) return 'Control de Inventario';
    if (path.startsWith('/finance')) return 'Gestion de Finanzas';
    if (path.startsWith('/suppliers')) return 'Compras y Proveedores';
    if (path.startsWith('/hr')) return 'RRHH y Asistencia';
    if (path.startsWith('/reports')) return 'Reportes Operativos';
    if (path.startsWith('/settings')) return 'Parametros del Negocio';
    if (path.startsWith('/users')) return 'Administracion de Usuarios';
    return 'Argos ERP';
  };

  const getInitials = (name: string) => {
    return name.split(' ').map((n) => n[0]).join('').toUpperCase().substring(0, 2);
  };

  return (
    <header className="h-[64px] bg-white border-b border-[var(--gray-200)] px-8 flex items-center justify-between sticky top-0 z-10">
      <div className="flex items-center">
        <h2 className="text-[15px] font-semibold text-[var(--gray-700)]">{getBreadcrumb()}</h2>
      </div>

      <div className="flex items-center gap-6">
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-1.5 rounded-lg text-[var(--gray-400)] hover:bg-[var(--gray-100)] hover:text-[var(--gray-700)] transition-colors relative"
          >
            <Bell size={22} />
            {notifications && notifications.length > 0 && (
              <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--color-danger)] text-[9px] font-bold text-white border-2 border-white">
                {notifications.length > 9 ? '9+' : notifications.length}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-[var(--shadow-lg)] border border-[var(--gray-200)] z-50 overflow-hidden flex flex-col max-h-[480px]">
              <div className="flex justify-between items-center p-4 border-b border-[var(--gray-100)] bg-[var(--gray-50)]">
                <h3 className="font-bold text-[var(--gray-800)] text-sm">Notificaciones</h3>
                {notifications && notifications.length > 0 && (
                  <button
                    onClick={() => {
                      markAllReadMutation.mutate();
                      setShowNotifications(false);
                    }}
                    className="text-[11px] font-semibold text-[var(--color-brand-blue)] hover:underline flex items-center gap-1"
                  >
                    <Check size={12} /> Marcar todo
                  </button>
                )}
              </div>
              <div className="overflow-y-auto flex-1 p-2">
                {notifications && notifications.length > 0 ? (
                  notifications.map((notif) => (
                    <div key={notif.id} className="p-3 mb-1 bg-[var(--color-info-bg)] rounded-lg border border-[var(--color-info-border)] group relative">
                      <p className="text-[12px] text-[var(--gray-800)] pr-6 leading-normal">{notif.message}</p>
                      <span className="text-[10px] text-[var(--gray-500)] mt-1.5 block font-medium">
                        {new Date(notif.created_at).toLocaleString()}
                      </span>
                      <button
                        onClick={() => markReadMutation.mutate(notif.id)}
                        className="absolute top-2 right-2 p-1 text-[var(--gray-400)] hover:text-[var(--color-brand-blue)] bg-white rounded-md opacity-0 group-hover:opacity-100 shadow-sm transition-all"
                      >
                        <Check size={12} />
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="py-8 text-center">
                    <div className="text-[var(--gray-300)] mb-2 flex justify-center">
                      <Bell size={32} />
                    </div>
                    <p className="text-xs text-[var(--gray-500)] font-medium">No hay notificaciones nuevas</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="h-6 w-px bg-[var(--gray-200)]"></div>

        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-3 p-1 rounded-lg hover:bg-[var(--gray-50)] transition-colors group"
          >
            <div className="w-8 h-8 rounded-full bg-[var(--color-info-bg)] flex items-center justify-center text-[var(--color-brand-blue)] text-[11px] font-bold shadow-sm border border-[var(--color-info-border)]">
              {user ? getInitials(user.nombre) : '??'}
            </div>
            <div className="hidden md:flex flex-col items-start text-left">
              <span className="text-[13px] font-bold text-[var(--gray-800)] leading-tight">{user?.nombre}</span>
              <span className="text-[11px] font-medium text-[var(--gray-400)]">{user?.role}</span>
            </div>
            <ChevronDown size={14} className={`text-[var(--gray-400)] transition-transform duration-200 ${showUserMenu ? 'rotate-180' : ''}`} />
          </button>

          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-[var(--shadow-lg)] border border-[var(--gray-200)] z-50 overflow-hidden py-1">
              <div className="px-4 py-3 border-b border-[var(--gray-100)] bg-[var(--gray-50)]">
                <p className="text-xs font-medium text-[var(--gray-500)]">Sesion iniciada como</p>
                <p className="text-[13px] font-bold text-[var(--gray-800)] truncate">{user?.email}</p>
              </div>

              <Link to="/settings" className="flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--gray-600)] hover:bg-[var(--gray-50)] hover:text-[var(--gray-900)] transition-colors">
                <UserIcon size={16} className="text-[var(--gray-400)]" />
                <span>Parametros</span>
              </Link>

              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)] transition-colors"
              >
                <LogOut size={16} />
                <span className="font-medium">Cerrar sesion</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
