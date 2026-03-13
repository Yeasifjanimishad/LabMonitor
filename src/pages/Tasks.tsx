import { useEffect, useState } from 'react';
import { Terminal, CheckCircle2, Clock, XCircle, PlayCircle, Server, Power, RefreshCw, MessageSquare, Camera } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

type Task = {
  id: number;
  pc_id: string;
  action: string;
  target: string;
  status: 'pending' | 'completed' | 'failed';
  created_at: string;
};

export default function Tasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTasks = () => {
      fetch('/api/tasks')
        .then(res => res.json())
        .then(data => {
          setTasks(data);
          setLoading(false);
        });
    };

    fetchTasks();
    const interval = setInterval(fetchTasks, 5000); // Poll every 5 seconds
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
          <p className="text-slate-400 font-medium animate-pulse">Loading tasks...</p>
        </div>
      </div>
    );
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.05 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <div className="space-y-8 pb-8">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-900/40 via-slate-900 to-slate-900 border border-indigo-500/20 p-8 sm:p-10">
        <div className="absolute top-0 right-0 -mt-16 -mr-16 w-64 h-64 bg-indigo-500/20 blur-3xl rounded-full pointer-events-none" />
        <div className="relative z-10">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400 tracking-tight">
            Task Queue
          </h1>
          <p className="text-slate-400 mt-4 text-lg max-w-2xl leading-relaxed">
            Monitor the status of software deployments and commands sent to lab PCs. Tasks are executed when PCs ping the server.
          </p>
        </div>
      </div>

      <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800/50 rounded-3xl overflow-hidden shadow-2xl">
        <div className="p-6 border-b border-slate-800/50 bg-slate-950/50 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Terminal className="w-5 h-5 text-indigo-400" />
            Recent Deployments
          </h2>
          <div className="flex items-center gap-2 text-sm text-slate-400 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            Live Updates
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-900/50 text-slate-400 border-b border-slate-800/50">
              <tr>
                <th className="px-6 py-4 font-semibold">Target PC</th>
                <th className="px-6 py-4 font-semibold">Action</th>
                <th className="px-6 py-4 font-semibold">Software/Payload</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold text-right">Time</th>
              </tr>
            </thead>
            <motion.tbody 
              variants={containerVariants}
              initial="hidden"
              animate="show"
              className="divide-y divide-slate-800/50"
            >
              {tasks.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    No tasks in the queue.
                  </td>
                </tr>
              ) : (
                tasks.map((task) => (
                  <motion.tr 
                    variants={itemVariants}
                    key={task.id} 
                    className="hover:bg-slate-800/30 transition-colors group"
                  >
                    <td className="px-6 py-4 font-medium text-slate-300">
                      <div className="flex items-center gap-2">
                        <Server className="w-4 h-4 text-slate-500 group-hover:text-indigo-400 transition-colors" />
                        {task.pc_id === 'ALL' ? (
                          <span className="text-indigo-400 font-bold bg-indigo-500/10 px-2 py-0.5 rounded-md">ALL PCs</span>
                        ) : (
                          task.pc_id
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-400">
                      <span className="bg-slate-800 px-2 py-1 rounded-md font-mono text-xs flex items-center gap-1.5 w-fit">
                        {task.action === 'shutdown' && <Power className="w-3 h-3 text-rose-400" />}
                        {task.action === 'restart' && <RefreshCw className="w-3 h-3 text-amber-400" />}
                        {task.action === 'broadcast' && <MessageSquare className="w-3 h-3 text-indigo-400" />}
                        {task.action === 'snapshot' && <Camera className="w-3 h-3 text-emerald-400" />}
                        {task.action}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-300 font-medium">{task.target}</td>
                    <td className="px-6 py-4">
                      <div className={cn(
                        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider",
                        task.status === 'completed' ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                        task.status === 'failed' ? "bg-rose-500/10 text-rose-400 border border-rose-500/20" :
                        "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                      )}>
                        {task.status === 'completed' && <CheckCircle2 className="w-3.5 h-3.5" />}
                        {task.status === 'failed' && <XCircle className="w-3.5 h-3.5" />}
                        {task.status === 'pending' && <PlayCircle className="w-3.5 h-3.5 animate-pulse" />}
                        {task.status}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right text-slate-500 whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        {formatDistanceToNow(new Date(task.created_at), { addSuffix: true })}
                      </div>
                    </td>
                  </motion.tr>
                ))
              )}
            </motion.tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
