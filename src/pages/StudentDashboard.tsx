import React, { useEffect, useState, useRef } from 'react';
import { Monitor, Hand, Upload, Download, AlertTriangle, Lock, ShieldAlert, CheckCircle2, Power, X, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { triggerDocumentDownload } from '../lib/downloadHelper';

export default function StudentDashboard() {
  const [pc, setPc] = useState<any>(null);
  const [toastMsg, setToastMsg] = useState('');
  const [sharedFiles, setSharedFiles] = useState<any[]>([]);
  const [showMaterialsModal, setShowMaterialsModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pcId = localStorage.getItem('userId');
  const [room, setRoom] = useState(localStorage.getItem('userRoom') || '809');

  const fetchPC = () => {
    if (!pcId) {
      window.location.href = '/login';
      return;
    }
    fetch(`/api/pcs/${pcId}`)
      .then(res => {
        if (res.status === 404) {
          localStorage.clear();
          window.location.href = '/login';
          throw new Error('PC not found');
        }
        return res.json();
      })
      .then(data => {
        setPc(data);
        if (data && data.room) {
          setRoom(data.room);
          localStorage.setItem('userRoom', data.room);
        }
      })
      .catch(() => {});
  };

  const fetchFiles = () => {
    if (!room) return;
    fetch(`/api/labs/${room}/files`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setSharedFiles(data);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchPC();
    fetchFiles();
    const interval = setInterval(() => {
      fetchPC();
      fetchFiles();
    }, 2500);
    return () => clearInterval(interval);
  }, [pcId, room]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  const triggerDownload = (file: any) => {
    const filename = file?.filename || 'Class_Material.txt';
    
    if (file?.content) {
      const a = document.createElement('a');
      a.href = file.content;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast(`Downloaded: ${filename}`);
      return;
    }

    const title = `LAB CLASS MATERIAL: ${filename}`;
    const lines = [
      `Room: ${room}`,
      `Shared At: ${file?.shared_at || new Date().toISOString()}`,
      `Downloaded At: ${new Date().toLocaleString()}`,
      ``,
      `Welcome to Room ${room} Computer Laboratory!`,
      `This file was distributed by your instructor.`,
      ``,
      `Course Details:`,
      `- Room: ${room}`,
      `- Document Name: ${filename}`,
      `- File Size: ${file?.size ? (file.size / 1024).toFixed(1) : '512'} KB`,
      ``,
      `Lab Instructions & Task:`,
      `1. Complete the practical exercises specified in this document.`,
      `2. Save your project/solution file locally on your lab station.`,
      `3. Submit your completed lab assignment via the Student Station Dashboard.`,
      ``,
      `Happy Coding!`
    ];

    triggerDocumentDownload(filename, title, lines);
    showToast(`Downloaded: ${filename}`);
  };

  const handleAction = async (action: string) => {
    try {
      await fetch(`/api/pcs/${pcId}/student-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      showToast(`Action '${action}' sent to Teacher`);
      fetchPC();
    } catch (e) {
      showToast('Failed to send action');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsSubmitting(true);
    showToast(`Uploading ${file.name}...`);

    const submitData = async (contentStr?: string) => {
      try {
        await fetch(`/api/labs/${room}/submit-file`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pc_id: pcId,
            filename: file.name,
            size: file.size,
            content: contentStr || null,
            content_type: file.type
          })
        });
        showToast(`Assignment "${file.name}" submitted successfully!`);
      } catch (err) {
        showToast('Failed to submit assignment');
      } finally {
        setIsSubmitting(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };

    if (file.size < 20000000) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const fileContent = event.target?.result as string;
        submitData(fileContent);
      };
      reader.onerror = () => submitData();
      reader.readAsDataURL(file);
    } else {
      submitData();
    }
  };

  if (!pc) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-8 relative">
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

      {/* Full Screen Lock Overlay */}
      <AnimatePresence>
        {pc.locked && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-slate-950 flex flex-col items-center justify-center p-4 text-center"
          >
            <motion.div 
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="w-32 h-32 bg-rose-500/20 rounded-full flex items-center justify-center mb-8"
            >
              <Lock className="w-16 h-16 text-rose-500" />
            </motion.div>
            <h1 className="text-5xl md:text-7xl font-extrabold text-white mb-6 tracking-tight">
              Screen Locked
            </h1>
            <p className="text-2xl md:text-3xl text-slate-400 font-medium">
              Please look at the whiteboard.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Powered Off Overlay */}
      <AnimatePresence>
        {pc.status === 'offline' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center p-4 text-center"
          >
            <div className="w-24 h-24 bg-slate-900 rounded-full flex items-center justify-center mb-6">
              <Power className="w-12 h-12 text-slate-700" />
            </div>
            <h1 className="text-4xl font-bold text-slate-600 mb-2">Powered Off</h1>
            <p className="text-slate-800 font-mono text-sm">Waiting for Wake-on-LAN signal...</p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-900/40 via-slate-900 to-slate-900 border border-indigo-500/20 p-8 sm:p-10">
        <div className="absolute top-0 right-0 -mt-16 -mr-16 w-64 h-64 bg-indigo-500/20 blur-3xl rounded-full pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400 tracking-tight">
              My Station
            </h1>
            <p className="text-slate-400 mt-4 text-lg max-w-2xl leading-relaxed">
              Room {room || 'Unknown'} • PC {pc?.ip ? pc.ip.split('.').pop() : 'Unknown'}
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            {pc.exam_mode && (
              <div className="flex items-center gap-2 px-4 py-2 bg-rose-500/20 text-rose-400 rounded-xl border border-rose-500/30 font-bold animate-pulse">
                <ShieldAlert className="w-5 h-5" />
                Exam Mode Active
              </div>
            )}
            <div className="flex items-center gap-3 px-6 py-3 bg-slate-950/50 rounded-2xl border border-slate-800/50 shadow-inner">
              <div className="w-12 h-12 bg-indigo-500/20 rounded-xl flex items-center justify-center">
                <Monitor className="w-6 h-6 text-indigo-400" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Status</p>
                <p className="text-lg font-bold text-emerald-400">Online</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Raise Hand Card */}
        <motion.div 
          whileHover={{ scale: 1.02 }}
          className={cn(
            "p-8 rounded-3xl border transition-all flex flex-col items-center justify-center text-center gap-4 cursor-pointer",
            pc.needs_help 
              ? "bg-amber-500/20 border-amber-500/50 shadow-xl shadow-amber-500/20" 
              : "bg-slate-900/80 border-slate-800 hover:border-amber-500/50"
          )}
          onClick={() => handleAction(pc.needs_help ? 'resolve_help' : 'help')}
        >
          <div className={cn(
            "w-20 h-20 rounded-full flex items-center justify-center transition-colors",
            pc.needs_help ? "bg-amber-500 text-slate-900" : "bg-slate-800 text-amber-500"
          )}>
            <Hand className="w-10 h-10" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">
              {pc.needs_help ? 'Help Requested' : 'Need Help?'}
            </h2>
            <p className="text-slate-400">
              {pc.needs_help 
                ? 'The teacher has been notified and will assist you shortly. Click to cancel.' 
                : 'Click here to notify the teacher that you need assistance with your task.'}
            </p>
          </div>
        </motion.div>

        {/* Submit Assignment Card */}
        <motion.div 
          whileHover={{ scale: 1.02 }}
          className={cn(
            "p-8 rounded-3xl border transition-all flex flex-col items-center justify-center text-center gap-4 cursor-pointer",
            isSubmitting ? "bg-indigo-500/10 border-indigo-500/50" : "bg-slate-900/80 border-slate-800 hover:border-indigo-500/50"
          )}
          onClick={() => !isSubmitting && fileInputRef.current?.click()}
        >
          <div className="w-20 h-20 rounded-full bg-slate-800 text-indigo-400 flex items-center justify-center">
            <Upload className={cn("w-10 h-10", isSubmitting && "animate-bounce")} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">
              {isSubmitting ? 'Submitting...' : 'Submit Assignment'}
            </h2>
            <p className="text-slate-400">Upload your completed lab task directly to the teacher's dashboard.</p>
          </div>
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            onChange={handleFileUpload} 
          />
        </motion.div>

        {/* Download Materials Card */}
        <motion.div 
          whileHover={{ scale: 1.02 }}
          className={cn(
            "p-8 rounded-3xl border transition-all flex flex-col items-center justify-center text-center gap-4 cursor-pointer",
            sharedFiles.length > 0 
              ? "bg-emerald-500/10 border-emerald-500/50 hover:border-emerald-400 shadow-xl shadow-emerald-500/10" 
              : "bg-slate-900/80 border-slate-800 hover:border-emerald-500/50"
          )}
          onClick={() => {
            if (sharedFiles.length > 0) {
              setShowMaterialsModal(true);
            } else {
              showToast('No class materials shared yet');
            }
          }}
        >
          <div className={cn(
            "w-20 h-20 rounded-full flex items-center justify-center relative",
            sharedFiles.length > 0 ? "bg-emerald-500 text-white" : "bg-slate-800 text-emerald-400"
          )}>
            <Download className="w-10 h-10" />
            {sharedFiles.length > 0 && (
              <div className="absolute -top-2 -right-2 w-8 h-8 bg-rose-500 rounded-full flex items-center justify-center text-white font-bold text-sm border-4 border-slate-900">
                {sharedFiles.length}
              </div>
            )}
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">Class Materials</h2>
            {sharedFiles.length > 0 ? (
              <p className="text-emerald-400 font-medium">
                {sharedFiles.length} file{sharedFiles.length > 1 ? 's' : ''} available (Click to view)
              </p>
            ) : (
              <p className="text-slate-400">Download slides, code snippets, and resources shared by the teacher.</p>
            )}
          </div>
        </motion.div>

        {/* Report Issue Card */}
        <motion.div 
          whileHover={{ scale: 1.02 }}
          className="p-8 rounded-3xl bg-slate-900/80 border border-slate-800 hover:border-rose-500/50 transition-all flex flex-col items-center justify-center text-center gap-4 cursor-pointer"
          onClick={() => showToast('Issue reported to Admin')}
        >
          <div className="w-20 h-20 rounded-full bg-slate-800 text-rose-400 flex items-center justify-center">
            <AlertTriangle className="w-10 h-10" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">Report Hardware Issue</h2>
            <p className="text-slate-400">Mouse not working? No internet? Report it directly to the IT Admin.</p>
          </div>
        </motion.div>
      </div>

      {/* Class Materials Download Modal */}
      <AnimatePresence>
        {showMaterialsModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">Class Materials</h2>
                    <p className="text-sm text-slate-400">Room {room} Shared Resources</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowMaterialsModal(false)} 
                  className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 max-h-[60vh] overflow-y-auto space-y-3">
                {sharedFiles.map((file) => (
                  <div key={file.id} className="flex items-center justify-between p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:border-emerald-500/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-bold text-white">{file.filename}</p>
                        <p className="text-xs text-slate-400">
                          {file?.size ? (file.size / 1024).toFixed(1) : '512'} KB • {file?.shared_at ? new Date(file.shared_at).toLocaleTimeString() : ''}
                        </p>
                      </div>
                    </div>
                    <button 
                      onClick={() => triggerDownload(file)}
                      className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-sm transition-colors shadow-md"
                    >
                      <Download className="w-4 h-4" />
                      Download
                    </button>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
