import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar from './Navbar';

export default function MainLayout() {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-[var(--surface-page)]">
      {/* Sidebar */}
      <div className="hidden md:block shrink-0">
        <Sidebar />
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        <Navbar />
        <main className="flex-1 overflow-y-auto focus:outline-none p-8">
          <div className="max-w-[1600px] mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
