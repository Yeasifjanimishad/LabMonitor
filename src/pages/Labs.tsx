import { useEffect, useState } from 'react';
import { Monitor, Wifi, WifiOff, Cpu, HardDrive, Clock, X, CheckCircle2, XCircle, Download, Globe, Power, RefreshCw, MessageSquare, Camera, AlertTriangle, Play, Square } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

type PC = {
  id: string;
  room: string;
  ip: string;
  status: 'online' | 'offline' | 'issue';
  has_internet: number;
  cpu_usage: number;
  ram_usage: number;
  disk_usage: number;
  last_seen: string;
};

const REQUIRED_SOFTWARE = [
  'Google Chrome',
  'Visual Studio Code',
  'Python',
  'Java SE Development Kit',
  'Git'
];

export default function Labs() {
  const [labs, setLabs] = useState<Record<string, PC[]>>({});
  const [selectedLab, setSelectedLab] = useState<string>('');
  const [selectedPc, setSelectedPc] = useState<string | null>(null);
  const [pcDetails, setPcDetails] = useState<any>(null);
  const [showGlobalDeploy, setShowGlobalDeploy] = useState(false);
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [deployTarget, setDeployTarget] = useState(REQUIRED_SOFTWARE[0]);
  const [toastMsg, setToastMsg] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'map'>('grid');
  const [schedules, setSchedules] = useState<Record<string, any>>({});
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [issueDesc, setIssueDesc] = useState('');
  const [fullScreenPreview, setFullScreenPreview] = useState(false);

  const fetchLabs = () => {
    fetch('/api/labs')
      .then(res => res.json())
      .then(data => {
        setLabs(data);
        const rooms = Object.keys(data);
        if (rooms.length > 0 && !selectedLab) setSelectedLab(rooms[0]);
      });
  };

  useEffect(() => {
    fetchLabs();
      
    fetch('/api/schedules')
      .then(res => res.json())
      .then(data => setSchedules(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedPc) {
      fetch(`/api/pcs/${selectedPc}`)
        .then(res => res.json())
        .then(data => setPcDetails(data));
    } else {
      setPcDetails(null);
    }
  }, [selectedPc]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  const handleInstall = async (pcId: string, softwareName: string) => {
    handleAction(pcId, 'install_software', softwareName);
  };

  const handleAction = async (pcId: string, action: string, target?: string) => {
    try {
      await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pc_id: pcId, action, target })
      });
      showToast(`Action '${action}' queued for ${pcId === 'ALL' ? 'All PCs' : 'PC ' + pcId}`);
      if (pcId === 'ALL') {
        setShowGlobalDeploy(false);
        setShowBroadcastModal(false);
        setBroadcastMsg('');
      }
    } catch (e) {
      console.error(e);
      showToast('Failed to queue action');
    }
  };

  const handlePowerAction = async (pcId: string, action: 'shutdown' | 'restart' | 'wake') => {
    try {
      await fetch(`/api/pcs/${pcId}/power`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      showToast(`Power action '${action}' sent to PC ${pcId}`);
      setSelectedPc(null);
      fetchLabs();
    } catch (e) {
      showToast('Failed to send power action');
    }
  };

  const handleRoomPowerAction = async (room: string, action: 'shutdown' | 'wake') => {
    try {
      await fetch(`/api/labs/${room}/power`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      showToast(`Room ${room} ${action === 'wake' ? 'waking up' : 'shutting down'}`);
      fetchLabs();
    } catch (e) {
      showToast('Failed to send room power action');
    }
  };

  const submitIssue = async () => {
    if (!selectedPc || !issueDesc) return;
    try {
      await fetch('/api/issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pc_id: selectedPc, description: issueDesc })
      });
      showToast('Issue reported successfully');
      setShowIssueModal(false);
      setIssueDesc('');
      setSelectedPc(null);
      fetchLabs();
    } catch (e) {
      showToast('Failed to report issue');
    }
  };

  const rooms = Object.keys(labs);

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.02 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, scale: 0.9 },
    show: { opacity: 1, scale: 1, transition: { type: 'spring', stiffness: 300, damping: 24 } }
  };

  const renderPC = (pc: PC) => (
    <motion.button
      variants={itemVariants}
      whileHover={{ scale: 1.05, y: -2 }}
      whileTap={{ scale: 0.95 }}
      key={pc.id}
      onClick={() => setSelectedPc(pc.id)}
      className={cn(
        "p-4 rounded-2xl border flex flex-col items-center gap-3 transition-colors relative overflow-hidden group",
        pc.status === 'online' ? "bg-emerald-500/5 border-emerald-500/20 hover:bg-emerald-500/10" :
        pc.status === 'issue' ? "bg-amber-500/5 border-amber-500/20 hover:bg-amber-500/10" :
        "bg-slate-800/30 border-slate-700/50 hover:bg-slate-800/50",
        viewMode === 'map' && "w-24 h-24 justify-center mx-auto"
      )}
    >
      {pc.status === 'online' && <div className="absolute top-0 right-0 w-12 h-12 bg-emerald-500/10 blur-xl rounded-full" />}
      {pc.status === 'issue' && <div className="absolute top-0 right-0 w-12 h-12 bg-amber-500/10 blur-xl rounded-full" />}
      
      <Monitor className={cn(
        "w-8 h-8 relative z-10 transition-transform group-hover:scale-110",
        pc.status === 'online' ? "text-emerald-400" :
        pc.status === 'issue' ? "text-amber-400" :
        "text-slate-500"
      )} />
      <div className="text-center relative z-10">
        <p className="text-sm font-bold text-slate-200">{pc.ip.split('.').pop()}</p>
        <p className={cn(
          "text-[10px] uppercase font-bold tracking-wider mt-0.5",
          pc.status === 'online' ? "text-emerald-500" :
          pc.status === 'issue' ? "text-amber-500" :
          "text-slate-500"
        )}>{pc.status}</p>
      </div>
    </motion.button>
  );

  return (
    <div className="space-y-8 relative pb-8">
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 right-6 bg-indigo-600 text-white px-6 py-3 rounded-xl shadow-2xl shadow-indigo-500/20 z-50 font-medium flex items-center gap-2"
          >
            <CheckCircle2 className="w-5 h-5 text-indigo-200" />
            {toastMsg}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400 tracking-tight">Lab Rooms</h1>
          <p className="text-slate-400 mt-2 text-lg">Monitor and manage individual PCs across all {rooms.length} labs.</p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => setShowBroadcastModal(true)}
            className="flex items-center gap-2 px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-semibold transition-all shadow-lg shadow-slate-900/20 hover:-translate-y-0.5"
          >
            <MessageSquare className="w-5 h-5" />
            Broadcast
          </button>
          <button
            onClick={() => setShowGlobalDeploy(true)}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold transition-all shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40 hover:-translate-y-0.5"
          >
            <Globe className="w-5 h-5" />
            Deploy to All PCs
          </button>
        </div>
      </div>

      {/* Lab Selector & View Mode */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex gap-3 overflow-x-auto pb-4 sm:pb-0 scrollbar-hide">
            {rooms.map(room => (
              <button
                key={room}
                onClick={() => setSelectedLab(room)}
                className={cn(
                  "px-6 py-3 rounded-xl text-sm font-bold whitespace-nowrap transition-all duration-300",
                  selectedLab === room 
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20 scale-105" 
                    : "bg-slate-900/80 backdrop-blur-xl border border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                )}
              >
                Room {room}
              </button>
            ))}
        </div>
        <div className="flex items-center gap-4 shrink-0">
          {selectedLab && (
            <div className="flex items-center bg-slate-900/80 border border-slate-800 rounded-xl p-1 shrink-0">
              <button onClick={() => handleRoomPowerAction(selectedLab, 'wake')} className="px-3 py-2 rounded-lg text-sm font-medium text-emerald-400 hover:bg-emerald-500/10 transition-colors flex items-center gap-2" title="Wake All">
                <Play className="w-4 h-4" /> Wake
              </button>
              <button onClick={() => handleRoomPowerAction(selectedLab, 'shutdown')} className="px-3 py-2 rounded-lg text-sm font-medium text-rose-400 hover:bg-rose-500/10 transition-colors flex items-center gap-2" title="Shutdown All">
                <Square className="w-4 h-4" /> Shutdown
              </button>
            </div>
          )}
          <div className="flex items-center bg-slate-900/80 border border-slate-800 rounded-xl p-1 shrink-0">
            <button onClick={() => setViewMode('grid')} className={cn("px-4 py-2 rounded-lg text-sm font-medium transition-colors", viewMode === 'grid' ? "bg-slate-800 text-white shadow-sm" : "text-slate-400 hover:text-slate-200")}>Grid View</button>
            <button onClick={() => setViewMode('map')} className={cn("px-4 py-2 rounded-lg text-sm font-medium transition-colors", viewMode === 'map' ? "bg-slate-800 text-white shadow-sm" : "text-slate-400 hover:text-slate-200")}>Map View</button>
          </div>
        </div>
      </div>

      {/* Class Schedule Banner */}
      {selectedLab && schedules[selectedLab] && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
        >
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center">
              <Clock className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">{schedules[selectedLab].class}</p>
              <p className="text-xs text-indigo-300 font-medium">{schedules[selectedLab].teacher}</p>
            </div>
          </div>
          <div className="px-4 py-2 bg-indigo-500/20 rounded-lg border border-indigo-500/30 text-sm font-bold text-indigo-300">
            {schedules[selectedLab].time}
          </div>
        </motion.div>
      )}

      {/* PC Display */}
      {selectedLab && labs[selectedLab] && (
        <motion.div 
          key={selectedLab}
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="bg-slate-900/80 backdrop-blur-xl border border-slate-800/50 rounded-3xl p-8 shadow-2xl overflow-x-auto"
        >
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-10 gap-4">
              {labs[selectedLab].map(renderPC)}
            </div>
          ) : (
            <div className="flex flex-col md:flex-row justify-center items-center md:items-start gap-12 md:gap-24 min-w-[800px] mx-auto p-8 bg-slate-950/30 rounded-3xl border border-slate-800/30">
              {/* Left Side: 3x3 */}
              <div className="flex flex-col items-center gap-6">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">Left Side (3x3)</div>
                <div className="grid grid-cols-3 gap-6">
                  {labs[selectedLab].slice(0, 9).map(renderPC)}
                </div>
              </div>
              
              {/* Aisle */}
              <div className="hidden md:flex flex-col items-center justify-center w-8 h-full min-h-[400px] border-x border-dashed border-slate-800/50 relative">
                <span className="text-slate-700 font-bold tracking-widest uppercase rotate-90 whitespace-nowrap text-sm absolute">Aisle</span>
              </div>

              {/* Right Side: 4x4 */}
              <div className="flex flex-col items-center gap-6">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">Right Side (4x4)</div>
                <div className="grid grid-cols-4 gap-6">
                  {labs[selectedLab].slice(9, 25).map(renderPC)}
                </div>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* PC Detail Modal */}
      {selectedPc && pcDetails && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
              <div className="flex items-center gap-4">
                <div className={cn(
                  "w-12 h-12 rounded-full flex items-center justify-center",
                  pcDetails.status === 'online' ? "bg-emerald-500/20 text-emerald-400" :
                  pcDetails.status === 'issue' ? "bg-amber-500/20 text-amber-400" :
                  "bg-slate-800 text-slate-400"
                )}>
                  <Monitor className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">PC {pcDetails.ip}</h2>
                  <p className="text-sm text-slate-400">Room {pcDetails.room}</p>
                </div>
              </div>
              <button onClick={() => setSelectedPc(null)} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Hardware Stats */}
              <div className="space-y-6">
                <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Hardware Status</h3>
                
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-400 flex items-center gap-2"><Cpu className="w-4 h-4"/> CPU</span>
                      <span className="text-white font-mono">{pcDetails.cpu_usage}%</span>
                    </div>
                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500" style={{ width: `${pcDetails.cpu_usage}%` }} />
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-400 flex items-center gap-2"><HardDrive className="w-4 h-4"/> RAM</span>
                      <span className="text-white font-mono">{pcDetails.ram_usage}%</span>
                    </div>
                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500" style={{ width: `${pcDetails.ram_usage}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-400 flex items-center gap-2"><HardDrive className="w-4 h-4"/> Disk</span>
                      <span className="text-white font-mono">{pcDetails.disk_usage}%</span>
                    </div>
                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-500" style={{ width: `${pcDetails.disk_usage}%` }} />
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">Internet</span>
                    {pcDetails.has_internet ? (
                      <span className="flex items-center gap-1 text-emerald-400"><Wifi className="w-4 h-4"/> Connected</span>
                    ) : (
                      <span className="flex items-center gap-1 text-rose-400"><WifiOff className="w-4 h-4"/> Disconnected</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">Last Seen</span>
                    <span className="flex items-center gap-1 text-slate-300">
                      <Clock className="w-4 h-4"/> 
                      {formatDistanceToNow(new Date(pcDetails.last_seen), { addSuffix: true })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Software List & Remote Actions */}
              <div className="space-y-8">
                <div>
                  <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4">Live Preview & Actions</h3>
                  
                  {/* Live Screen Preview */}
                  <div className="w-full aspect-video bg-slate-950 rounded-xl border border-slate-800 overflow-hidden relative group mb-4">
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/50 transition-opacity z-20">
                      <button onClick={() => setFullScreenPreview(true)} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 transition-colors text-white rounded-lg text-sm font-bold flex items-center gap-2">
                        <Camera className="w-4 h-4" /> Full Screen
                      </button>
                    </div>
                    {pcDetails.status === 'online' ? (
                      <div className="w-full h-full relative p-2">
                        <div className="w-full h-full border border-slate-800/50 rounded bg-slate-900 relative overflow-hidden">
                          {/* Fake code editor screen */}
                          <div className="h-4 bg-slate-800 flex items-center px-2 gap-1">
                            <div className="w-2 h-2 rounded-full bg-rose-500"></div>
                            <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                          </div>
                          <div className="p-2 text-[8px] font-mono text-emerald-400/70">
                            <p>import React from 'react';</p>
                            <p>function App() {'{'}</p>
                            <p className="pl-2">return &lt;div&gt;Hello World&lt;/div&gt;;</p>
                            <p>{'}'}</p>
                            <p className="mt-2 text-slate-500">// System running normally</p>
                            <p className="text-slate-500">// CPU: {pcDetails.cpu_usage}% | RAM: {pcDetails.ram_usage}%</p>
                          </div>
                          {/* Scanline effect */}
                          <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px] pointer-events-none opacity-20"></div>
                        </div>
                      </div>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-slate-600">
                        <Power className="w-8 h-8 mb-2 opacity-50" />
                        <span className="text-xs font-bold uppercase tracking-widest">No Signal</span>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <button onClick={() => handlePowerAction(pcDetails.id, 'wake')} className="flex items-center justify-center gap-2 px-4 py-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-xl font-medium transition-colors">
                      <Play className="w-4 h-4" /> Wake
                    </button>
                    <button onClick={() => handlePowerAction(pcDetails.id, 'restart')} className="flex items-center justify-center gap-2 px-4 py-3 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded-xl font-medium transition-colors">
                      <RefreshCw className="w-4 h-4" /> Restart
                    </button>
                    <button onClick={() => handlePowerAction(pcDetails.id, 'shutdown')} className="flex items-center justify-center gap-2 px-4 py-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-xl font-medium transition-colors col-span-2">
                      <Power className="w-4 h-4" /> Shutdown
                    </button>
                  </div>
                  <button 
                    onClick={() => setShowIssueModal(true)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 rounded-xl text-sm font-semibold transition-colors"
                  >
                    <AlertTriangle className="w-4 h-4" /> Report Issue
                  </button>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4">Required Software Status</h3>
                <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
                  <ul className="divide-y divide-slate-800 max-h-64 overflow-y-auto">
                    {/* Required Software */}
                    {REQUIRED_SOFTWARE.map((reqSw, i) => {
                      const installed = pcDetails.software?.find((s: any) => s.name === reqSw);
                      return (
                        <li key={`req-${i}`} className="px-4 py-3 flex justify-between items-center hover:bg-slate-900/50">
                          <div className="flex items-center gap-3">
                            {installed ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            ) : (
                              <XCircle className="w-4 h-4 text-rose-400" />
                            )}
                            <span className={cn("text-sm", installed ? "text-slate-200" : "text-rose-400 font-medium")}>
                              {reqSw}
                            </span>
                          </div>
                          {installed ? (
                            <span className="text-xs font-mono text-slate-500">{installed.version}</span>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-rose-400 bg-rose-500/10 px-2 py-1 rounded-md">Missing</span>
                              <button 
                                onClick={() => handleInstall(pcDetails.id, reqSw)}
                                className="flex items-center gap-1 text-xs font-medium text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 px-2 py-1 rounded-md transition-colors"
                              >
                                <Download className="w-3 h-3" />
                                Install
                              </button>
                            </div>
                          )}
                        </li>
                      );
                    })}
                    
                    {/* Extra Software */}
                    {pcDetails.software?.filter((s: any) => !REQUIRED_SOFTWARE.includes(s.name)).map((sw: any, i: number) => (
                      <li key={`extra-${i}`} className="px-4 py-3 flex justify-between items-center hover:bg-slate-900/50">
                        <div className="flex items-center gap-3">
                          <CheckCircle2 className="w-4 h-4 text-slate-500" />
                          <span className="text-sm text-slate-400">{sw.name}</span>
                        </div>
                        <span className="text-xs font-mono text-slate-500">{sw.version}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )}

      {/* Broadcast Modal */}
      {showBroadcastModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-indigo-400" />
                Broadcast Message
              </h2>
              <button onClick={() => setShowBroadcastModal(false)} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-400">
                Send a pop-up message to <strong>ALL</strong> PCs across all labs.
              </p>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Message Content</label>
                <textarea 
                  value={broadcastMsg}
                  onChange={(e) => setBroadcastMsg(e.target.value)}
                  placeholder="e.g., Class is ending in 5 minutes. Please save your work."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 min-h-[100px] resize-none"
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  onClick={() => setShowBroadcastModal(false)}
                  className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-medium transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => handleAction('ALL', 'broadcast', broadcastMsg)}
                  disabled={!broadcastMsg.trim()}
                  className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <MessageSquare className="w-4 h-4" />
                  Send Broadcast
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Issue Modal */}
      {showIssueModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl p-6"
          >
            <h2 className="text-xl font-bold text-white mb-4">Report Issue for PC {selectedPc}</h2>
            <textarea
              value={issueDesc}
              onChange={(e) => setIssueDesc(e.target.value)}
              placeholder="Describe the hardware or software issue..."
              className="w-full h-32 bg-slate-950 border border-slate-800 rounded-xl p-4 text-slate-300 focus:outline-none focus:border-amber-500 mb-6 resize-none"
            />
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setShowIssueModal(false)}
                className="px-4 py-2 text-slate-400 hover:text-slate-200 font-medium"
              >
                Cancel
              </button>
              <button 
                onClick={submitIssue}
                className="px-6 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 rounded-xl font-bold transition-colors"
              >
                Submit Report
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Global Deploy Modal */}
      {showGlobalDeploy && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Globe className="w-5 h-5 text-indigo-400" />
                Global Deployment
              </h2>
              <button onClick={() => setShowGlobalDeploy(false)} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-400">
                Select a software package to install on <strong>ALL</strong> PCs across all labs. The command will be queued and executed when the PCs next ping the server.
              </p>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Select Software</label>
                <select 
                  value={deployTarget}
                  onChange={(e) => setDeployTarget(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500"
                >
                  {REQUIRED_SOFTWARE.map(sw => (
                    <option key={sw} value={sw}>{sw}</option>
                  ))}
                  <option value="Custom">Other (Custom Package)</option>
                </select>
              </div>
              
              {deployTarget === 'Custom' && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Package Name (winget ID)</label>
                  <input 
                    type="text" 
                    placeholder="e.g., Mozilla.Firefox"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500"
                    onChange={(e) => setDeployTarget(e.target.value)}
                  />
                </div>
              )}

              <div className="pt-4 flex gap-3">
                <button 
                  onClick={() => setShowGlobalDeploy(false)}
                  className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-medium transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => handleInstall('ALL', deployTarget)}
                  className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Deploy Now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Full Screen Preview Modal */}
      <AnimatePresence>
        {fullScreenPreview && pcDetails && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 sm:p-8 z-[60]"
          >
            <div className="w-full h-full max-w-6xl relative flex flex-col">
              <div className="flex justify-between items-center mb-4 shrink-0">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Monitor className="w-5 h-5 text-indigo-400" />
                  Live Preview: PC {pcDetails.ip.split('.').pop()} (Lab {pcDetails.room})
                </h2>
                <button 
                  onClick={() => setFullScreenPreview(false)} 
                  className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="flex-1 border border-slate-800 rounded-2xl bg-slate-900 relative overflow-hidden flex flex-col">
                {/* Fake code editor screen */}
                <div className="h-8 bg-slate-800 flex items-center px-4 gap-2 shrink-0">
                  <div className="w-3 h-3 rounded-full bg-rose-500"></div>
                  <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                  <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                  <div className="ml-4 text-xs text-slate-400 font-mono">App.tsx - Visual Studio Code</div>
                </div>
                <div className="p-6 text-sm sm:text-base font-mono text-emerald-400/80 flex-1 overflow-auto">
                  <p><span className="text-pink-400">import</span> React <span className="text-pink-400">from</span> <span className="text-amber-300">'react'</span>;</p>
                  <p className="mt-2"><span className="text-pink-400">function</span> <span className="text-blue-400">App</span>() {'{'}</p>
                  <p className="pl-4 mt-1"><span className="text-pink-400">return</span> (</p>
                  <p className="pl-8">&lt;<span className="text-blue-400">div</span> <span className="text-indigo-300">className</span>=<span className="text-amber-300">"min-h-screen bg-slate-900 text-white flex items-center justify-center"</span>&gt;</p>
                  <p className="pl-12">&lt;<span className="text-blue-400">h1</span> <span className="text-indigo-300">className</span>=<span className="text-amber-300">"text-4xl font-bold"</span>&gt;Hello World&lt;/<span className="text-blue-400">h1</span>&gt;</p>
                  <p className="pl-8">&lt;/<span className="text-blue-400">div</span>&gt;</p>
                  <p className="pl-4">);</p>
                  <p>{'}'}</p>
                  <p className="mt-4"><span className="text-pink-400">export default</span> App;</p>
                  <p className="mt-8 text-slate-500">// System running normally</p>
                  <p className="text-slate-500">// CPU: {pcDetails.cpu_usage}% | RAM: {pcDetails.ram_usage}%</p>
                  <div className="w-2 h-4 bg-emerald-400/80 animate-pulse mt-2 inline-block"></div>
                </div>
                {/* Scanline effect */}
                <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px] pointer-events-none opacity-20"></div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
