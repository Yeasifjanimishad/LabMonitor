import { motion } from 'motion/react';
import { Info, Code2, ShieldCheck, Zap, MonitorPlay, MessageSquare } from 'lucide-react';

export default function About() {
  const features = [
    {
      icon: MonitorPlay,
      title: 'Real-time Monitoring',
      description: 'Track the status, CPU, RAM, and Disk usage of all lab PCs in real-time.'
    },
    {
      icon: ShieldCheck,
      title: 'Software Blacklist',
      description: 'Automatically detect and flag unauthorized software like games or torrent clients.'
    },
    {
      icon: Zap,
      title: 'Remote Power Management',
      description: 'Send shutdown or restart commands to individual PCs or entire labs instantly.'
    },
    {
      icon: MessageSquare,
      title: 'Broadcast Messaging',
      description: 'Send pop-up messages to all students in a lab for important announcements.'
    }
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="max-w-4xl space-y-8 pb-8 mx-auto"
    >
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-900/40 via-slate-900 to-slate-900 border border-indigo-500/20 p-8 sm:p-12 text-center">
        <div className="absolute top-0 right-0 -mt-16 -mr-16 w-64 h-64 bg-indigo-500/20 blur-3xl rounded-full pointer-events-none" />
        <div className="absolute bottom-0 left-0 -mb-16 -ml-16 w-48 h-48 bg-emerald-500/10 blur-3xl rounded-full pointer-events-none" />
        
        <div className="relative z-10 flex flex-col items-center">
          <div className="w-20 h-20 bg-indigo-500/20 rounded-2xl flex items-center justify-center mb-6 border border-indigo-500/30 shadow-xl shadow-indigo-500/10">
            <Info className="w-10 h-10 text-indigo-400" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400 tracking-tight mb-4">
            About LabMonitor Pro
          </h1>
          <p className="text-slate-400 text-lg max-w-2xl leading-relaxed">
            A comprehensive, real-time monitoring and management solution designed specifically for university computer labs. Ensure all machines are online, secure, and ready for students.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {features.map((feature, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.1 }}
            className="bg-slate-900/80 backdrop-blur-xl border border-slate-800/50 rounded-3xl p-6 hover:bg-slate-800/50 transition-colors"
          >
            <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center mb-4">
              <feature.icon className="w-6 h-6 text-indigo-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">{feature.title}</h3>
            <p className="text-slate-400 leading-relaxed">{feature.description}</p>
          </motion.div>
        ))}
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.4 }}
        className="bg-gradient-to-r from-slate-900 to-slate-800 border border-slate-700 rounded-3xl p-8 sm:p-10 flex flex-col sm:flex-row items-center justify-between gap-8 shadow-2xl"
      >
        <div>
          <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-3">
            <Code2 className="w-6 h-6 text-emerald-400" />
            Developer Information
          </h2>
          <p className="text-slate-400 mb-1">Architected and engineered by</p>
          <p className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
            Yeasif Jani Mishad
          </p>
          <div className="mt-4 flex items-center gap-3">
            <div className="flex items-center gap-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-4 py-1.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-sm font-medium tracking-wide">Batch 43</span>
            </div>
            <div className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-4 py-1.5 rounded-full">
              <span className="text-sm font-medium tracking-wide">Software Engineering</span>
            </div>
          </div>
        </div>
        
        <div className="shrink-0">
          <div className="w-32 h-32 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-500 p-1 shadow-xl shadow-emerald-500/20">
            <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center border-4 border-slate-900 overflow-hidden relative">
              <span className="text-4xl font-black text-white absolute z-0">YM</span>
              <img 
                src="/profile.jpg" 
                alt="Yeasif Jani Mishad" 
                className="w-full h-full object-cover relative z-10"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
