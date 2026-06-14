import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  HomeIcon,
  UsersIcon,
  FolderIcon,
  CalendarDaysIcon,
  UserGroupIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';

const navigation = [
  { name: 'Dashboard', href: '/', icon: HomeIcon },
  { name: 'Timeline', href: '/timeline', icon: CalendarDaysIcon },
  { name: 'People', href: '/people', icon: UsersIcon },
  { name: 'Projects', href: '/projects', icon: FolderIcon },
  { name: 'Teams', href: '/teams', icon: UserGroupIcon },
  { name: 'Settings', href: '/settings', icon: Cog6ToothIcon },
  { name: 'Users', href: '/users', icon: ShieldCheckIcon, adminOnly: true },
];

export default function Layout() {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900 text-white flex flex-col">
        <div className="p-6">
          <h1 className="text-xl font-bold">📊 Utilization</h1>
          <p className="text-gray-400 text-sm mt-1">Resource Planner</p>
        </div>

        <nav className="flex-1 px-3 space-y-1">
          {navigation
            .filter(item => !item.adminOnly || isAdmin)
            .map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              end={item.href === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`
              }
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{user?.name}</p>
              <p className="text-xs text-gray-400">{user?.email}</p>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors"
              title="Logout"
            >
              <ArrowRightOnRectangleIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
