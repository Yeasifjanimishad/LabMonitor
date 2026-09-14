import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ShieldAlert, Lock, ArrowRight, User, GraduationCap, Monitor, ChevronDown, Terminal, KeyRound, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

export default function Login() {
  const existingFixedId = localStorage.getItem('fixed_student_station_id') || localStorage.getItem('userId');
  const existingFixedRoom = localStorage.getItem('fixed_student_room') || localStorage.getItem('userRoom') || '809';

  const [role, setRole] = useState<'admin' | 'teacher' | 'student'>(existingFixedId ? 'student' : 'admin');
  const [password, setPassword] = useState('');
  const [room, setRoom] = useState(existingFixedRoom);
  const [pcId, setPcId] = useState(existingFixedId || '');
  const [isStationFixed, setIsStationFixed] = useState(!!existingFixedId);
  const [error, setError] = useState('');
  const [availableRooms, setAvailableRooms] = useState<string[]>([]);
  const [availablePcs, setAvailablePcs] = useState<any[]>([]);
  const [showAdminUnlock, setShowAdminUnlock] = useState(false);
  const [adminPin, setAdminPin] = useState('');
  const [pinError, setPinError] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Preserve fixed device binding if it exists
    const boundId = localStorage.getItem('fixed_student_station_id') || localStorage.getItem('userId');
    const boundRoom = localStorage.getItem('fixed_student_room') || localStorage.getItem('userRoom');
    
    if (boundId) {
      setPcId(boundId);
      setIsStationFixed(true);
      setRole('student');
    }
    if (boundRoom) {
      setRoom(boundRoom);
    }

    // Fetch available rooms and PCs for dropdowns
    fetch('/api/pcs')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          const rooms = [...new Set(data.map((pc: any) => pc.room))] as string[];
          setAvailableRooms(rooms.sort());
          if (rooms.length > 0 && !boundRoom && !rooms.includes(room)) {
            setRoom(rooms[0]);
          }
          setAvailablePcs(data);

          // If not fixed yet and no pcId set, auto-default to the first available PC
          if (!boundId && data.length > 0) {
            const firstInRoom = data.find((p: any) => p.room === (boundRoom || room || '809'));
            if (firstInRoom) {
              setPcId(firstInRoom.id);
            }
          }
        }
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
        setError('Please assign a PC to this workstation');
        return;
      }
      // Permanently bind this physical computer to this PC ID
      localStorage.setItem('fixed_student_station_id', pcId);
      localStorage.setItem('fixed_student_room', room);
      setIsStationFixed(true);
      isValid = true;
    }

    if (isValid) {
      localStorage.setItem('userRole', role);
      if (role === 'teacher') localStorage.setItem('userRoom', room);
      if (role === 'student') {
        localStorage.setItem('userRoom', room);
        localStorage.setItem('userId', pcId);
        // Direct redirect to student portal
        window.location.href = `/student?pc=${encodeURIComponent(pcId)}&room=${encodeURIComponent(room)}`;
        return;
      }
      window.location.href = '/'; // Force reload to update router state
    } else {
      setError(`Invalid password for ${role} mode.`);
    }
  };

  const handleAdminUnlockFixedPC = () => {
    if (adminPin.trim() === '1234' || adminPin.trim() === 'admin123') {
      localStorage.removeItem('fixed_student_station_id');
      setIsStationFixed(false);
      setShowAdminUnlock(false);
      setAdminPin('');
      setPinError(false);
    } else {
      setPinError(true);
      setTimeout(() => setPinError(false), 2500);
    }
  };

  const pcsInRoom = availablePcs.filter(pc => pc.room === room).sort((a, b) => a.ip.localeCompare(b.ip));
  const activePcInfo = availablePcs.find(p => p.id === pcId || p.ip === pcId.replace(/-/g, '.'));
  const activePcNumber = activePcInfo ? activePcInfo.name || `PC ${activePcInfo.ip.split('.').pop()}` : (pcId ? `PC ${pcId.split('-').pop()}` : 'PC 1');

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
              {role === 'teacher' && (
                <motion.div
                  key="room-select-teacher"
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

              {role === 'student' && isStationFixed && (
                <motion.div
                  key="pc-fixed"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-3"
                >
                  <div className="bg-slate-950/80 border border-emerald-500/40 rounded-2xl p-4 shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
                    
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        Fixed Workstation
                      </span>
                      <span className="text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Lock className="w-2.5 h-2.5" /> Hardware Locked
                      </span>
                    </div>

                    <div className="flex items-center justify-between mt-1">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                          <Monitor className="w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="text-xl font-extrabold text-white leading-tight">
                            {activePcNumber}
                          </h3>
                          <p className="text-xs text-slate-400 font-mono">
                            {activePcInfo?.ip || pcId.replace(/-/g, '.')} &bull; Room {room}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setShowAdminUnlock(!showAdminUnlock);
                          setAdminPin('');
                          setPinError(false);
                        }}
                        className="text-slate-500 hover:text-amber-400 p-2 hover:bg-slate-900 rounded-lg transition-colors"
                        title="Instructor Workstation Unlock"
                      >
                        <KeyRound className="w-4 h-4 text-amber-400/80 hover:text-amber-400" />
                      </button>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center gap-2 text-xs text-slate-400">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span>This physical computer is permanently assigned. No switching allowed.</span>
                    </div>

                    {showAdminUnlock && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="mt-3 pt-3 border-t border-slate-800 space-y-2 bg-slate-900/60 p-3 rounded-xl border"
                      >
                        <p className="text-xs text-amber-300 font-medium">Instructor Unlock (Enter PIN to unbind this PC):</p>
                        <div className="flex gap-2">
                          <input 
                            type="password"
                            placeholder="Teacher PIN (1234)"
                            value={adminPin}
                            onChange={(e) => setAdminPin(e.target.value)}
                            className="flex-1 bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs font-mono focus:outline-none focus:border-amber-500"
                          />
                          <button
                            type="button"
                            onClick={handleAdminUnlockFixedPC}
                            className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition-colors"
                          >
                            Unlock
                          </button>
                        </div>
                        {pinError && <p className="text-[11px] text-rose-400 font-semibold">Incorrect Teacher PIN</p>}
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              )}

              {role === 'student' && !isStationFixed && (
                <motion.div
                  key="pc-setup-first-time"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-4"
                >
                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">
                      Select Lab Room
                    </label>
                    <div className="relative group">
                      <select
                        value={room}
                        onChange={(e) => setRoom(e.target.value)}
                        className="w-full bg-slate-900/80 border border-slate-700 hover:border-indigo-500/50 rounded-2xl px-4 py-3.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all appearance-none cursor-pointer shadow-inner"
                      >
                        {availableRooms.map(r => (
                          <option key={r} value={r} className="bg-slate-900">Room {r}</option>
                        ))}
                      </select>
                      <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-slate-500 group-hover:text-indigo-400 transition-colors">
                        <ChevronDown className="w-5 h-5" />
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-semibold text-slate-300">
                        Initial Setup: Assign This Computer
                      </label>
                      <span className="text-[10px] text-amber-400 font-semibold bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
                        One-Time Bind
                      </span>
                    </div>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Monitor className="h-5 w-5 text-slate-500 group-hover:text-indigo-400 transition-colors" />
                      </div>
                      <select
                        value={pcId}
                        onChange={(e) => setPcId(e.target.value)}
                        className="w-full bg-slate-900/80 border border-slate-700 hover:border-indigo-500/50 rounded-2xl pl-11 pr-10 py-3.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all appearance-none cursor-pointer shadow-inner"
                      >
                        <option value="" className="bg-slate-900">-- Choose PC to bind to this machine --</option>
                        {pcsInRoom.map((pc, i) => (
                          <option key={pc.id} value={pc.id} className="bg-slate-900">PC {i + 1} ({pc.ip})</option>
                        ))}
                      </select>
                      <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-slate-500 group-hover:text-indigo-400 transition-colors">
                        <ChevronDown className="w-5 h-5" />
                      </div>
                    </div>
                    <p className="text-xs text-slate-400 mt-2 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                      Once logged in, this computer will be permanently fixed to this PC.
                    </p>
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
              {role === 'student' 
                ? (isStationFixed ? `Enter Station (${activePcNumber})` : 'Lock to This PC & Enter') 
                : (role === 'teacher' ? 'Access Teacher Dashboard' : 'Access Admin Dashboard')}
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
