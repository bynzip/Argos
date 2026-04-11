import { useNavigate } from 'react-router-dom';
import { LogOut, User as UserIcon } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import api from '../../lib/axios';

export default function Navbar() {
  const { user, clearAuth } = useAuthStore();
  const navigate = useNavigate();

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

  return (
    <header className="flex h-20 shrink-0 items-center justify-between px-6">
      <div className="flex items-center gap-4">
        {/* Placeholder for future mobile menu button */}
      </div>
      
      <div className="surface-panel flex items-center gap-6 px-6 py-2">
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
