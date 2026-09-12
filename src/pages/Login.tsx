import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ShieldAlert, Lock, ArrowRight, User, GraduationCap, Monitor, ChevronDown, Terminal } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

export default function Login() {
  const [role, setRole] = useState<'admin' | 'teacher' | 'student'>('admin');
  const [password, setPassword] = useState('');
  const [room, setRoom] = useState('809');
  const [pcId, setPcId] = useState('');
  const [error, setError] = useState('');
  const [availableRooms, setAvailableRooms] = useState<string[]>([]);
  const [availablePcs, setAvailablePcs] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    // Clear any stale session data when accessing the login page
    localStorage.removeItem('userRole');
    localStorage.removeItem('userRoom');
    localStorage.removeItem('userId');

    // Fetch available rooms and PCs for dropdowns
    fetch('/api/pcs')
      .then(res => res.json())
      .then(data => {
        const rooms = [...new Set(data.map((pc: any) => pc.room))] as string[];
        setAvailableRooms(rooms.sort());
        if (rooms.length > 0 && !rooms.includes(room)) {
          setRoom(rooms[0]);
        }
        setAvailablePcs(data);
      })
      .catch(err => console.error(err));
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    
    let isValid = false;
    
    if (role === 'admin' && password === 'admin123') {
      isValid = true;
    } else if (role === 'teacher') {
      isValid = true;
    } else if (role === 'student') {
      if (!pcId) {
        setError('Please select your PC');
        return;
      }
      isValid = true;
    }

    if (isValid) {
      localStorage.setItem('userRole', role);
      if (role === 'teacher') localStorage.setItem('userRoom', room);
      if (role === 'student') {
        localStorage.setItem('userRoom', room);
        localStorage.setItem('userId', pcId);
      }
      window.location.href = '/'; // Force reload to update router state
    } else {
      setError(`Invalid password for ${role} mode.`);
    }
  };

  const pcsInRoom = availablePcs.filter(pc => pc.room === room).sort((a, b) => a.ip.localeCompare(b.ip));

  return (
    <div className="min-h-screen bg-[#0a0f1c] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Ambient glowing background */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-500/10 blur-[120px] rounded-full pointer-events-none" />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="max-w-md w-full relative z-10"
      >
        <div className="bg-slate-900/60 backdrop-blur-2xl rounded-3xl shadow-2xl border border-slate-800/50 p-8 sm:p-10 overflow-hidden relative">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500" />
          
          <div className="flex flex-col items-center mb-8">
            <motion.div 
              initial={{ rotate: -10, scale: 0.8 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.1 }}
              className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-indigo-500/20"
            >
              <ShieldAlert className="w-10 h-10 text-white" />
            </motion.div>
            <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400 tracking-tight text-center">
              LabMonitor Pro
            </h1>
            <p className="text-indigo-400 text-sm font-medium mt-2 uppercase tracking-widest">
              DIU Software Engineering
            </p>
          </div>

          {/* Role Selection Tabs */}
          <div className="flex p-1 bg-slate-950/50 rounded-xl mb-8 border border-slate-800/50">
            {[
              { id: 'admin', label: 'Admin', icon: ShieldAlert },
              { id: 'teacher', label: 'Teacher', icon: GraduationCap },
              { id: 'student', label: 'Student', icon: User }
            ].map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  setRole(r.id as any);
                  setError('');
                  setPassword('');
                }}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-lg transition-all",
                  role === r.id 
                    ? "bg-indigo-600 text-white shadow-md" 
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                )}
              >
                <r.icon className="w-4 h-4" />
                {r.label}
              </button>
            ))}
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <AnimatePresence mode="wait">
              {(role === 'teacher' || role === 'student') && (
                <motion.div
                  key="room-select"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <label className="block text-sm font-semibold text-slate-300 mb-2">
                    Select Lab Room
                  </label>
                  <div className="relative group">
                    <select
                      value={room}
                      onChange={(e) => setRoom(e.target.value)}
                      className="w-full bg-slate-900/80 border border-slate-700 hover:border-indigo-500/50 rounded-2xl px-4 py-4 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all appearance-none cursor-pointer shadow-inner"
                    >
                      {availableRooms.map(r => (
                        <option key={r} value={r} className="bg-slate-900">Room {r}</option>
                      ))}
                    </select>
                    <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-slate-500 group-hover:text-indigo-400 transition-colors">
                      <ChevronDown className="w-5 h-5" />
                    </div>
                  </div>
                </motion.div>
              )}

              {role === 'student' && (
                <motion.div
                  key="pc-select"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-5"
                >
                  <label className="block text-sm font-semibold text-slate-300 mb-2">
                    Select Your PC
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Monitor className="h-5 w-5 text-slate-500 group-hover:text-indigo-400 transition-colors" />
                    </div>
                    <select
                      value={pcId}
                      onChange={(e) => setPcId(e.target.value)}
                      className="w-full bg-slate-900/80 border border-slate-700 hover:border-indigo-500/50 rounded-2xl pl-11 pr-10 py-4 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all appearance-none cursor-pointer shadow-inner"
                    >
                      <option value="" className="bg-slate-900">-- Select PC --</option>
                      {pcsInRoom.map((pc, i) => (
                        <option key={pc.id} value={pc.id} className="bg-slate-900">PC {i + 1} ({pc.ip})</option>
                      ))}
                    </select>
                    <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-slate-500 group-hover:text-indigo-400 transition-colors">
                      <ChevronDown className="w-5 h-5" />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {role === 'admin' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <label className="block text-sm font-semibold text-slate-300 mb-2">
                  Administrator Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-slate-500" />
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError('');
                    }}
                    className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl pl-11 pr-4 py-4 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder:text-slate-600 font-medium"
                    placeholder="Enter password..."
                  />
                </div>
              </motion.div>
            )}

            <AnimatePresence>
              {error && (
                <motion.p 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="text-rose-400 text-sm mt-3 font-medium"
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-2xl px-4 py-4 transition-all shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 group"
            >
              Access Dashboard
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </motion.button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-800/60 flex items-center justify-center">
            <Link 
              to="/agent"
              className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-indigo-400 transition-colors"
            >
              <Terminal className="w-4 h-4 text-indigo-500" />
              Setting up student PCs? Open Agent Setup &rarr;
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
