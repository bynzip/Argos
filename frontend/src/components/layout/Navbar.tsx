import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, User as UserIcon, Bell, Check } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import api from '../../lib/axios';
import { useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from '../../hooks/useCore';

export default function Navbar() {
  const { user, clearAuth } = useAuthStore();
  const navigate = useNavigate();
  const [showNotifications, setShowNotifications] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

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

  const handleMarkRead = (id: number) => {
    markReadMutation.mutate(id);
  };

  const handleMarkAllRead = () => {
    markAllReadMutation.mutate();
    setShowNotifications(false);
  };

  // Cierra el panel de notificaciones si haces clic afuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="flex h-20 shrink-0 items-center justify-between px-6">
      <div className="flex items-center gap-4">
        {/* Placeholder for future mobile menu button */}
      </div>
      
      <div className="surface-panel flex items-center gap-4 px-6 py-2 relative">
        
        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button 
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 rounded-full text-slate-600 hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <Bell size={20} />
            {notifications && notifications.length > 0 && (
              <span className="absolute top-1 right-1 flex h-3 w-3 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white ring-2 ring-white">
                {notifications.length > 9 ? '9+' : notifications.length}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-slate-200 z-50 overflow-hidden flex flex-col max-h-96">
              <div className="flex justify-between items-center p-3 border-b bg-slate-50">
                <h3 className="font-semibold text-slate-800 text-sm">Notificaciones</h3>
                {notifications && notifications.length > 0 && (
                  <button 
                    onClick={handleMarkAllRead}
                    disabled={markAllReadMutation.isPending}
                    className="text-xs text-blue-600 hover:text-blue-800 flex items-center"
                  >
                    <Check size={12} className="mr-1" /> Marcar todas leídas
                  </button>
                )}
              </div>
              <div className="overflow-y-auto flex-1 p-2">
                {notifications && notifications.length > 0 ? (
                  notifications.map(notif => (
                    <div key={notif.id} className="p-3 mb-1 bg-blue-50 rounded border border-blue-100 group relative">
                      <p className="text-xs text-slate-800 pr-6">{notif.message}</p>
                      <span className="text-[10px] text-slate-500 mt-1 block">
                        {new Date(notif.created_at).toLocaleString()}
                      </span>
                      <button 
                        onClick={() => handleMarkRead(notif.id)}
                        className="absolute top-2 right-2 p-1 text-slate-400 hover:text-blue-600 bg-white rounded-full opacity-0 group-hover:opacity-100 shadow-sm transition-opacity"
                        title="Marcar como leída"
                      >
                        <Check size={12} />
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="p-4 text-center text-sm text-slate-500">
                    No tienes notificaciones nuevas.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="h-8 w-px bg-slate-200 mx-2"></div>

        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-[#2347a5]">
            <UserIcon size={20} />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold text-slate-800">{user?.nombre}</span>
            <span className="text-xs text-slate-500 font-medium">{user?.role}</span>
          </div>
        </div>
        
        <div className="h-8 w-px bg-slate-200"></div>

        <button
          onClick={handleLogout}
          className="flex items-center gap-2 rounded-xl p-2 text-sm font-semibold text-slate-600 hover:bg-red-50 hover:text-red-600 transition-colors"
          title="Cerrar sesión"
        >
          <LogOut size={18} />
          <span className="hidden sm:inline">Salir</span>
        </button>
      </div>
    </header>
  );
}
