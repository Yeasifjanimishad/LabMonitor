import { useEffect, useState } from 'react';
import { ShieldAlert, CheckCircle2, AlertCircle, Clock, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '../lib/utils';

type Issue = {
  id: number;
  pc_id: string;
  description: string;
  status: 'open' | 'resolved';
  created_at: string;
};

export default function Issues() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [filter, setFilter] = useState<'all' | 'open' | 'resolved'>('all');
  const [search, setSearch] = useState('');
  const [toastMsg, setToastMsg] = useState('');

  useEffect(() => {
    fetchIssues();
  }, []);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  const fetchIssues = () => {
    fetch('/api/issues')
      .then(res => res.json())
      .then(data => setIssues(data))
      .catch(err => console.error(err));
  };

  const handleResolve = async (id: number) => {
    try {
      await fetch(`/api/issues/${id}/resolve`, { method: 'POST' });
      showToast('Issue resolved successfully');
      fetchIssues();
    } catch (err) {
      showToast('Failed to resolve issue');
      console.error(err);
    }
  };

  const filteredIssues = issues.filter(issue => {
    if (filter !== 'all' && issue.status !== filter) return false;
    if (search && !issue.pc_id.toLowerCase().includes(search.toLowerCase()) && !issue.description.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-8 relative">
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 right-6 bg-indigo-600 text-white px-6 py-3 rounded-xl shadow-2xl shadow-indigo-500/20 z-50 font-medium flex items-center gap-2"
          >
            <CheckCircle2 className="w-5 h-5" />
            {toastMsg}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400 tracking-tight">Issue Tracker</h1>
          <p className="text-slate-400 mt-2 text-lg">Manage and resolve reported hardware and software issues.</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row justify-between gap-4 bg-slate-900/50 p-4 rounded-2xl border border-slate-800">
        <div className="flex gap-2">
          {['all', 'open', 'resolved'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f as any)}
              className={cn(
                "px-4 py-2 rounded-xl text-sm font-semibold capitalize transition-all",
                filter === f ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20" : "bg-slate-800 text-slate-400 hover:text-slate-200"
              )}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
          <input
            type="text"
            placeholder="Search issues..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500 w-full sm:w-64"
          />
        </div>
      </div>

      <div className="grid gap-4">
        {filteredIssues.length === 0 ? (
          <div className="text-center py-12 bg-slate-900/50 rounded-3xl border border-slate-800">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-4 opacity-50" />
            <h3 className="text-xl font-bold text-slate-300">No issues found</h3>
            <p className="text-slate-500 mt-2">Everything looks good!</p>
          </div>
        ) : (
          filteredIssues.map((issue, i) => (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              key={issue.id}
              className="bg-slate-900/80 backdrop-blur-xl border border-slate-800/50 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 shadow-xl"
            >
              <div className="flex items-start gap-4">
                <div className={cn(
                  "w-12 h-12 rounded-full flex items-center justify-center shrink-0",
                  issue.status === 'open' ? "bg-amber-500/20 text-amber-500" : "bg-emerald-500/20 text-emerald-500"
                )}>
                  {issue.status === 'open' ? <AlertCircle className="w-6 h-6" /> : <CheckCircle2 className="w-6 h-6" />}
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-lg font-bold text-white">PC {issue.pc_id}</h3>
                    <span className={cn(
                      "px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider",
                      issue.status === 'open' ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    )}>
                      {issue.status}
                    </span>
                  </div>
                  <p className="text-slate-300 text-sm mb-2">{issue.description}</p>
                  <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                    <Clock className="w-3.5 h-3.5" />
                    Reported {formatDistanceToNow(new Date(issue.created_at), { addSuffix: true })}
                  </div>
                </div>
              </div>

              {issue.status === 'open' && (
                <button
                  onClick={() => handleResolve(issue.id)}
                  className="px-5 py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-xl text-sm font-bold transition-colors shrink-0"
                >
                  Mark Resolved
                </button>
              )}
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
