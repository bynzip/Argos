import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar from './Navbar';

export default function MainLayout() {
  return (
    <div className="app-shell flex h-screen w-full overflow-hidden">
      <div className="p-4 pr-0 hidden md:block shrink-0">
        <Sidebar />
      </div>
      <div className="flex w-0 flex-1 flex-col overflow-hidden">
        <Navbar />
        <main className="relative flex-1 overflow-y-auto focus:outline-none p-4 sm:p-6 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
