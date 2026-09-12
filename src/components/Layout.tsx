import { useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Monitor, Terminal, LogOut, ShieldAlert, ListTodo, Info, Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem('userRole');
    localStorage.removeItem('userRoom');
    localStorage.removeItem('userId');
    navigate('/login');
  };

  const userRole = localStorage.getItem('userRole');
  const userRoom = localStorage.getItem('userRoom');

  const navItems = userRole === 'admin' ? [
    { to: '/', icon: LayoutDashboard, label: 'Overview' },
    { to: '/labs', icon: Monitor, label: 'Lab Rooms' },
    { to: '/tickets', icon: ShieldAlert, label: 'Tickets' },
    { to: '/tasks', icon: ListTodo, label: 'Task Queue' },
    { to: '/agent', icon: Terminal, label: 'Agent Setup' },
    { to: '/about', icon: Info, label: 'About' },
  ] : userRole === 'teacher' ? [
    { to: '/', icon: LayoutDashboard, label: 'My Lab' },
    { to: '/agent', icon: Terminal, label: 'Agent Setup' },
    { to: '/tickets', icon: ShieldAlert, label: 'Tickets' },
    { to: '/about', icon: Info, label: 'About' },
  ] : [
    { to: '/', icon: LayoutDashboard, label: 'My Station' },
    { to: '/about', icon: Info, label: 'About' },
  ];

  return (
    <div className="min-h-screen bg-[#0a0f1c] text-slate-200 flex relative overflow-hidden">
      {/* Background ambient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-indigo-500/10 blur-[120px] rounded-full pointer-events-none" />

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-slate-900/80 backdrop-blur-xl border-b border-slate-800/50 z-40 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <ShieldAlert className="w-4 h-4 text-white" />
          </div>
          <h1 className="font-extrabold text-lg text-white tracking-tight">LabMonitor</h1>
        </div>
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 text-slate-400 hover:text-white transition-colors"
        >
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed lg:static inset-y-0 left-0 w-72 border-r border-slate-800/50 bg-slate-900/95 lg:bg-slate-900/40 backdrop-blur-xl flex flex-col z-50 shadow-2xl transition-transform duration-300 ease-in-out",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        <div className="p-8 flex items-center gap-4 border-b border-slate-800/50">
          <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <ShieldAlert className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-extrabold text-xl text-white tracking-tight">LabMonitor</h1>
            <p className="text-xs font-medium text-indigo-400 uppercase tracking-wider mt-0.5">
              {userRole === 'admin' ? 'Pro Edition' : userRole === 'teacher' ? `Teacher (Room ${userRoom})` : 'Student Mode'}
            </p>
          </div>
        </div>

        <nav className="flex-1 p-6 space-y-3">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setIsMobileMenuOpen(false)}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-4 px-5 py-3.5 rounded-2xl text-sm font-semibold transition-all duration-300 relative group",
                  isActive 
                    ? "text-white" 
                    : "text-slate-400 hover:text-slate-200"
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.div
                      layoutId="activeNav"
                      className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 to-purple-500/10 border border-indigo-500/20 rounded-2xl"
                      initial={false}
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                  )}
                  <item.icon className={cn("w-5 h-5 relative z-10 transition-colors", isActive ? "text-indigo-400" : "group-hover:text-indigo-400")} />
                  <span className="relative z-10">{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="p-6 border-t border-slate-800/50">
          <button
            onClick={handleLogout}
            className="flex items-center gap-4 px-5 py-3.5 w-full rounded-2xl text-sm font-semibold text-slate-400 hover:bg-rose-500/10 hover:text-rose-400 transition-all duration-300 group"
          >
            <LogOut className="w-5 h-5 group-hover:scale-110 transition-transform" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-screen relative z-10 w-full lg:w-auto pt-16 lg:pt-0">
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 lg:p-12 scroll-smooth">
          <div className="max-w-7xl mx-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </main>
    </div>
  );
}
