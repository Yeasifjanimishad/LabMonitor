import { useEffect, useState } from 'react';
import { Activity, MonitorOff, WifiOff, AlertTriangle, MonitorPlay, CheckCircle2, Server, HardDrive, Cpu, Clock, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { cn } from '../lib/utils';

type PC = {
  id: string;
  room: string;
  ip: string;
  status: 'online' | 'offline' | 'issue';
  cpu_usage: number;
  ram_usage: number;
};

type ListFilter = 'all' | 'online' | 'offline' | 'issue' | null;

export default function Dashboard() {
  const [stats, setStats] = useState({ total: 0, online: 0, offline: 0, issues: 0 });
  const [labsData, setLabsData] = useState<any[]>([]);
  const [rawPcs, setRawPcs] = useState<PC[]>([]);
  const [recentIssues, setRecentIssues] = useState<any[]>([]);
  const [listFilter, setListFilter] = useState<ListFilter>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [statsData, labsRaw, issuesData] = await Promise.all([
        fetch('/api/stats').then(res => res.json()),
        fetch('/api/labs').then(res => res.json()),
        fetch('/api/issues').then(res => res.json())
      ]);
      
      setStats(statsData);
      setRecentIssues(issuesData.filter((i: any) => i.status === 'open').slice(0, 5));
      
      // Process labs data for the chart
      const chartData = Object.keys(labsRaw).map(room => {
        const pcs: PC[] = labsRaw[room];
        const onlinePcs = pcs.filter(pc => pc.status === 'online');
        const avgCpu = onlinePcs.length ? Math.round(onlinePcs.reduce((acc, pc) => acc + (pc.cpu_usage || 0), 0) / onlinePcs.length) : 0;
        const avgRam = onlinePcs.length ? Math.round(onlinePcs.reduce((acc, pc) => acc + (pc.ram_usage || 0), 0) / onlinePcs.length) : 0;
        
        return {
          name: `Lab ${room}`,
          Online: pcs.filter(pc => pc.status === 'online').length,
          Offline: pcs.filter(pc => pc.status === 'offline').length,
          Issues: pcs.filter(pc => pc.status === 'issue').length,
          AvgCPU: avgCpu,
          AvgRAM: avgRam,
        };
      });
      setLabsData(chartData);
      
      // Store raw PCs for the modal
      const allPcs = Object.values(labsRaw).flat() as PC[];
      setRawPcs(allPcs);
    } catch (error) {
      console.error("Failed to fetch dashboard data", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleResolve = async (pcId: string) => {
    try {
      await fetch(`/api/pcs/${pcId}/resolve`, { method: 'POST' });
      // Refresh data after resolving
      fetchData();
    } catch (error) {
      console.error("Failed to resolve issue", error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
          <p className="text-slate-400 font-medium animate-pulse">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const cards = [
    { 
      title: 'Total PCs Monitored', 
      value: stats.total, 
      icon: Server, 
      color: 'text-blue-400', 
      bg: 'bg-blue-500/10', 
      border: 'border-blue-500/20', 
      shadow: 'shadow-blue-500/10',
      onClick: () => setListFilter('all'),
      interactive: true
    },
    { 
      title: 'Online & Active', 
      value: stats.online, 
      icon: CheckCircle2, 
      color: 'text-emerald-400', 
      bg: 'bg-emerald-500/10', 
      border: 'border-emerald-500/20', 
      shadow: 'shadow-emerald-500/10',
      onClick: () => setListFilter('online'),
      interactive: true
    },
    { 
      title: 'Offline PCs', 
      value: stats.offline, 
      icon: MonitorOff, 
      color: 'text-slate-400', 
      bg: 'bg-slate-500/10', 
      border: 'border-slate-500/20', 
      shadow: 'shadow-slate-500/10',
      onClick: () => setListFilter('offline'),
      interactive: true
    },
    { 
      title: 'Network/Hardware Issues', 
      value: stats.issues, 
      icon: AlertTriangle, 
      color: 'text-rose-400', 
      bg: 'bg-rose-500/10', 
      border: 'border-rose-500/20', 
      shadow: 'shadow-rose-500/10',
      onClick: () => setListFilter('issue'),
      interactive: true
    },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
  };

  const filteredPcs = listFilter === 'all' ? rawPcs : rawPcs.filter(pc => pc.status === listFilter);
  
  const modalTitles = {
    all: { title: 'All Monitored PCs', icon: Server, color: 'text-blue-400' },
    online: { title: 'Online & Active PCs', icon: CheckCircle2, color: 'text-emerald-400' },
    offline: { title: 'Offline PCs', icon: MonitorOff, color: 'text-slate-400' },
    issue: { title: 'PCs with Issues', icon: AlertTriangle, color: 'text-rose-400' }
  };

  const currentModalInfo = listFilter ? modalTitles[listFilter] : null;

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-8 pb-8"
    >
      <motion.div variants={itemVariants} className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-900/40 via-slate-900 to-slate-900 border border-indigo-500/20 p-8 sm:p-10">
        <div className="absolute top-0 right-0 -mt-16 -mr-16 w-64 h-64 bg-indigo-500/20 blur-3xl rounded-full pointer-events-none" />
        <div className="absolute bottom-0 left-0 -mb-16 -ml-16 w-48 h-48 bg-emerald-500/10 blur-3xl rounded-full pointer-events-none" />
        
        <div className="relative z-10">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400 tracking-tight">
            System Overview
          </h1>
          <p className="text-slate-400 mt-4 text-lg max-w-2xl leading-relaxed">
            Real-time status and health monitoring of all university lab computers. Keep track of connectivity, hardware issues, and software deployments from a single pane of glass.
          </p>
        </div>
      </motion.div>

      <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card, i) => (
          <motion.div 
            key={i} 
            whileHover={{ y: -4, scale: 1.02 }}
            onClick={card.onClick}
            className={`relative overflow-hidden bg-slate-900/80 backdrop-blur-xl border ${card.border} rounded-2xl p-6 flex flex-col gap-4 shadow-lg ${card.shadow} transition-all duration-300 ${card.interactive ? 'cursor-pointer hover:ring-2 hover:ring-rose-500/50' : ''}`}
          >
            <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white/5 blur-2xl rounded-full pointer-events-none" />
            <div className="flex items-center justify-between">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${card.bg}`}>
                <card.icon className={`w-6 h-6 ${card.color}`} />
              </div>
              <span className="text-4xl font-black text-white tracking-tighter">{card.value}</span>
            </div>
            <p className="text-sm font-semibold text-slate-400 uppercase tracking-wider">{card.title}</p>
            {card.interactive && (
              <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-rose-500/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            )}
          </motion.div>
        ))}
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div variants={itemVariants} className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Activity className="w-5 h-5 text-indigo-400" />
                Lab Status Distribution
              </h3>
              <p className="text-sm text-slate-400 mt-1">Live breakdown of PC statuses across all rooms</p>
            </div>
          </div>
          
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={labsData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  cursor={{ fill: '#1e293b', opacity: 0.4 }}
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px', color: '#f8fafc' }}
                  itemStyle={{ fontSize: '14px', fontWeight: 500 }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }} />
                <Bar dataKey="Online" stackId="a" fill="#34d399" radius={[0, 0, 4, 4]} />
                <Bar dataKey="Issues" stackId="a" fill="#fbbf24" />
                <Bar dataKey="Offline" stackId="a" fill="#475569" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Cpu className="w-5 h-5 text-indigo-400" />
                Average Resource Usage
              </h3>
              <p className="text-sm text-slate-400 mt-1">CPU & RAM usage by lab (Online PCs)</p>
            </div>
          </div>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={labsData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} unit="%" />
                <Tooltip 
                  cursor={{ fill: '#1e293b', opacity: 0.4 }}
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px', color: '#f8fafc' }}
                  itemStyle={{ fontSize: '14px', fontWeight: 500 }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }} />
                <Bar dataKey="AvgCPU" name="Avg CPU %" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="AvgRAM" name="Avg RAM %" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div variants={itemVariants} className="space-y-6">
          <div className="bg-gradient-to-br from-amber-900/20 to-slate-900 border border-amber-500/20 rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 blur-3xl rounded-full pointer-events-none" />
            <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
              <WifiOff className="w-5 h-5 text-amber-400" />
              Connectivity Alerts
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed mb-4">
              {stats.issues > 0 
                ? `There are currently ${stats.issues} PCs experiencing network or hardware issues. Immediate attention may be required.` 
                : 'All online PCs currently have stable internet connectivity. No active alerts.'}
            </p>
            <div className="w-full bg-slate-950/50 rounded-full h-2 mb-2 overflow-hidden">
              <div 
                className="bg-amber-400 h-2 rounded-full transition-all duration-1000" 
                style={{ width: `${stats.total > 0 ? (stats.issues / stats.total) * 100 : 0}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-slate-400 font-medium">
              <span>Issue Rate</span>
              <span>{stats.total > 0 ? ((stats.issues / stats.total) * 100).toFixed(1) : 0}%</span>
            </div>
          </div>

          <div className="bg-gradient-to-br from-rose-900/20 to-slate-900 border border-rose-500/20 rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/10 blur-3xl rounded-full pointer-events-none" />
            <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-400" />
              Maintenance Required
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              {stats.offline > 0 
                ? `${stats.offline} PCs are currently offline and unreachable. They may be powered down or disconnected from the network.` 
                : 'All monitored PCs are currently online and responding to pings.'}
            </p>
            <div className="mt-6 flex items-center gap-4 text-sm font-medium text-slate-400">
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-slate-500" />
                <span>Last updated just now</span>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-indigo-900/20 to-slate-900 border border-indigo-500/20 rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 blur-3xl rounded-full pointer-events-none" />
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-indigo-400" />
              Recent Open Issues
            </h3>
            <div className="space-y-3">
              {recentIssues.length === 0 ? (
                <p className="text-sm text-slate-400">No open issues at the moment.</p>
              ) : (
                recentIssues.map(issue => (
                  <div key={issue.id} className="bg-slate-950/50 rounded-xl p-3 border border-slate-800/50">
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-sm font-bold text-slate-200">PC {issue.pc_id}</span>
                      <span className="text-xs text-slate-500">{new Date(issue.created_at).toLocaleDateString()}</span>
                    </div>
                    <p className="text-xs text-slate-400 line-clamp-2">{issue.description}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Dynamic List Modal */}
      <AnimatePresence>
        {listFilter && currentModalInfo && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[80vh]"
            >
              <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/50 shrink-0">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <currentModalInfo.icon className={`w-5 h-5 ${currentModalInfo.color}`} />
                  {currentModalInfo.title} ({filteredPcs.length})
                </h2>
                <button 
                  onClick={() => setListFilter(null)} 
                  className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 overflow-y-auto flex-1">
                <div className="space-y-4">
                  {filteredPcs.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <CheckCircle2 className="w-8 h-8 text-slate-400" />
                      </div>
                      <p className="text-slate-300 font-medium text-lg">No PCs found</p>
                      <p className="text-slate-500 mt-1">There are no PCs matching this status.</p>
                    </div>
                  ) : (
                    filteredPcs.map(pc => (
                      <motion.div 
                        layout
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        key={pc.id} 
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-800/30 border border-slate-700/50 hover:bg-slate-800/50 p-4 rounded-2xl transition-colors"
                      >
                        <div>
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-8 h-8 rounded-lg flex items-center justify-center",
                              pc.status === 'online' ? "bg-emerald-500/10" :
                              pc.status === 'issue' ? "bg-rose-500/10" :
                              "bg-slate-500/10"
                            )}>
                              <MonitorPlay className={cn(
                                "w-4 h-4",
                                pc.status === 'online' ? "text-emerald-400" :
                                pc.status === 'issue' ? "text-rose-400" :
                                "text-slate-400"
                              )} />
                            </div>
                            <span className="font-bold text-slate-200">PC {pc.ip.split('.').pop()}</span>
                            <span className="text-xs font-bold text-indigo-400 bg-indigo-500/10 px-2 py-1 rounded-md">Lab {pc.room}</span>
                          </div>
                          <p className="text-sm text-slate-400 mt-2 ml-11">
                            Status: <span className="capitalize">{pc.status}</span>
                            {pc.status === 'issue' && ' (Needs attention)'}
                          </p>
                        </div>
                        {pc.status === 'issue' && (
                          <button
                            onClick={() => handleResolve(pc.id)}
                            className="px-4 py-2.5 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 rounded-xl text-sm font-bold transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2 sm:w-auto w-full"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            Mark Resolved
                          </button>
                        )}
                      </motion.div>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
