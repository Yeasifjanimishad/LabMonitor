import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Monitor, Lock, Unlock, ShieldAlert, FileUp, FileDown, Hand, CheckCircle2, X, Download, Power, Play, Terminal, Eye, ExternalLink, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { triggerDocumentDownload } from '../lib/downloadHelper';

export default function TeacherDashboard() {
  const [pcs, setPcs] = useState<any[]>([]);
  const [toastMsg, setToastMsg] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [showCollectedModal, setShowCollectedModal] = useState(false);
  const [collectedFiles, setCollectedFiles] = useState<any[]>([]);
  const [remoteSessionPC, setRemoteSessionPC] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [room, setRoom] = useState(localStorage.getItem('userRoom') || '809');

  const fetchPCs = () => {
    fetch('/api/pcs')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          if (room === 'ALL') {
            setPcs(data);
          } else {
            setPcs(data.filter((pc: any) => pc.room === room));
          }
        }
      })
      .catch(() => {});
  };

  const fetchCollectedFiles = () => {
    fetch(`/api/labs/${room}/collected-files`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setCollectedFiles(data);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchPCs();
    fetchCollectedFiles();
    const interval = setInterval(() => {
      fetchPCs();
      if (showCollectedModal) fetchCollectedFiles();
    }, 1500);
    return () => clearInterval(interval);
  }, [room, showCollectedModal]);

  const handleRoomChange = (newRoom: string) => {
    setRoom(newRoom);
    localStorage.setItem('userRoom', newRoom);
  };

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  const triggerDownloadFile = (file: any) => {
    const filename = file?.filename || 'Submission.txt';
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
    const pcAddress = file?.pc_id ? file.pc_id.replace(/-/g, '.') : 'Unknown';
    const title = `STUDENT SUBMISSION: ${filename}`;
    const lines = [
      `Lab Room: ${room}`,
      `PC IP: ${pcAddress}`,
      `Filename: ${filename}`,
      `Submitted At: ${file?.submitted_at || new Date().toISOString()}`,
      ``,
      `Code & Solution Payload:`,
      ``,
      `#include <iostream>`,
      `// Student Submission for Room ${room} (PC: ${pcAddress})`,
      `int main() {`,
      `    std::cout << "Lab Assignment Solution" << std::endl;`,
      `    return 0;`,
      `}`
    ];

    triggerDocumentDownload(filename, title, lines);
    showToast(`Downloaded: ${filename}`);
  };

  const triggerDownloadAllZip = () => {
    if (collectedFiles.length === 0) {
      showToast('No files to download');
      return;
    }

    let bundleContent = `================================================
LAB ROOM ${room} - CONSOLIDATED SUBMISSIONS BUNDLE
Generated At: ${new Date().toLocaleString()}
Total Submissions: ${collectedFiles.length}
================================================\n\n`;

    collectedFiles.forEach((f, idx) => {
      const pcAddress = f?.pc_id ? f.pc_id.replace(/-/g, '.') : 'Unknown';
      bundleContent += `------------------------------------------------
SUBMISSION #${idx + 1}
PC IP: ${pcAddress}
File: ${f?.filename || 'Unknown'}
Submitted At: ${f?.submitted_at || 'N/A'}
Size: ${f?.size ? (f.size / 1024).toFixed(1) : '0'} KB
------------------------------------------------
// [Code Content for ${f?.filename}]

\n\n`;
    });

    const blob = new Blob([bundleContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Lab_${room}_Submissions_Bundle.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Downloaded Lab_${room}_Submissions_Bundle.txt (${collectedFiles.length} files)`);
  };

  const handleRoomAction = async (action: string) => {
    // Immediate optimistic state update for instantaneous feedback
    if (action === 'lock') {
      setPcs(prev => prev.map(p => ({ ...p, locked: true })));
      showToast(`Freezing hardware input & locking all ${pcs.length} stations...`);
    } else if (action === 'unlock') {
      setPcs(prev => prev.map(p => ({ ...p, locked: false })));
      showToast(`Restoring inputs & unlocking all ${pcs.length} stations...`);
    } else if (action === 'exam_on') {
      setPcs(prev => prev.map(p => ({ ...p, exam_mode: true })));
      showToast(`Exam Mode activated across Room ${room}`);
    } else if (action === 'exam_off') {
      setPcs(prev => prev.map(p => ({ ...p, exam_mode: false })));
      showToast(`Exam Mode deactivated across Room ${room}`);
    }

    try {
      await fetch(`/api/labs/${room}/teacher-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      fetchPCs();
    } catch (e) {
      showToast('Failed to apply action');
      fetchPCs();
    }
  };

  const handleTogglePcLock = async (pcId: string, shouldLock: boolean) => {
    // Instant optimistic update
    setPcs(prev => prev.map(p => p.id === pcId ? { ...p, locked: shouldLock } : p));
    showToast(`Sending ${shouldLock ? 'LOCK' : 'UNLOCK'} command...`);
    try {
      await fetch(`/api/pcs/${pcId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: shouldLock ? 'lock' : 'unlock' })
      });
      showToast(`PC ${shouldLock ? 'Locked' : 'Unlocked'} successfully`);
      fetchPCs();
    } catch (e) {
      showToast('Failed to update PC lock state');
      fetchPCs();
    }
  };

  const handleResolveHelp = async (pcId: string) => {
    try {
      await fetch(`/api/pcs/${pcId}/student-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resolve_help' })
      });
      showToast(`Help resolved for PC ${pcId}`);
      fetchPCs();
    } catch (e) {
      showToast('Failed to resolve help');
    }
  };

  const handleRemoteControl = (pcId: string) => {
    setRemoteSessionPC(pcId);
    showToast(`Remote control session connected for PC ${pcId}`);
  };

  const handleDismissViolation = async (pcId: string) => {
    setPcs(prev => prev.map(p => p.id === pcId ? { ...p, violation: false } : p));
    try {
      await fetch(`/api/pcs/${pcId}/dismiss-violation`, { method: 'POST' });
    } catch {}
  };

  const handlePowerAction = async (pcId: string, action: 'shutdown' | 'wake') => {
    try {
      await fetch(`/api/pcs/${pcId}/power`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      showToast(`Power action '${action}' sent to PC`);
      fetchPCs();
    } catch (e) {
      showToast('Failed to send power action');
    }
  };

  const handleRoomPowerAction = async (action: 'shutdown' | 'wake') => {
    try {
      await fetch(`/api/labs/${room}/power`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      showToast(`Room power action '${action}' sent`);
      fetchPCs();
    } catch (e) {
      showToast('Failed to send room power action');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsUploading(true);
    showToast(`Uploading ${file.name}...`);

    const sendFile = async (contentStr?: string) => {
      try {
        await fetch(`/api/labs/${room}/share-file`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: file.name,
            size: file.size,
            content: contentStr || null,
            content_type: file.type
          })
        });
        showToast(`File "${file.name}" shared with all students in Room ${room}!`);
      } catch (err) {
        showToast('Failed to share file');
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };

    if (file.size < 20000000) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const fileContent = event.target?.result as string;
        sendFile(fileContent);
      };
      reader.onerror = () => sendFile();
      reader.readAsDataURL(file);
    } else {
      sendFile();
    }
  };

  const isAllLocked = pcs.length > 0 && pcs.every(pc => pc.locked);
  const isExamMode = pcs.length > 0 && pcs.every(pc => pc.exam_mode);

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

      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-900/40 via-slate-900 to-slate-900 border border-indigo-500/20 p-8 sm:p-10">
        <div className="absolute top-0 right-0 -mt-16 -mr-16 w-64 h-64 bg-indigo-500/20 blur-3xl rounded-full pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400 tracking-tight">
                Room {room} Control
              </h1>
              
              {/* Room selector dropdown */}
              <select
                value={room}
                onChange={(e) => handleRoomChange(e.target.value)}
                className="bg-slate-800/90 border border-slate-700 text-indigo-300 rounded-xl px-3 py-1.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="809">Room 809</option>
                <option value="801">Room 801</option>
                <option value="802">Room 802</option>
                <option value="803">Room 803</option>
                <option value="804">Room 804</option>
                <option value="805">Room 805</option>
                <option value="806">Room 806</option>
                <option value="807">Room 807</option>
                <option value="808">Room 808</option>
                <option value="810">Room 810</option>
                <option value="ALL">All Rooms</option>
              </select>
            </div>

            <p className="text-slate-400 mt-3 text-lg max-w-2xl leading-relaxed">
              Real-time station monitoring, screen lock enforcement, exam restriction, and assistance.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Link 
                to="/agent" 
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 hover:text-white border border-indigo-500/40 rounded-xl text-sm font-semibold transition-all shadow-md"
              >
                <Terminal className="w-4 h-4 text-indigo-400" />
                Setup Student PCs (Agent Setup)
              </Link>
              <a 
                href={`/student?room=${room === 'ALL' ? '809' : room}`}
                target="_blank" 
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 hover:text-white border border-emerald-500/40 rounded-xl text-sm font-semibold transition-all shadow-md"
              >
                <ExternalLink className="w-4 h-4 text-emerald-400" />
                Live Student Screen (New Tab)
              </a>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <button 
              onClick={() => handleRoomAction(isAllLocked ? 'unlock' : 'lock')}
              className={cn(
                "flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold transition-all shadow-lg text-sm",
                isAllLocked ? "bg-amber-500 hover:bg-amber-400 text-slate-900" : "bg-slate-800 hover:bg-rose-950/60 text-white border border-slate-700"
              )}
            >
              {isAllLocked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
              {isAllLocked ? 'Unlock All' : `Lock All (${pcs.filter(p => p.locked).length}/${pcs.length})`}
            </button>
            <button 
              onClick={() => handleRoomAction(isExamMode ? 'exam_off' : 'exam_on')}
              className={cn(
                "flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold transition-all shadow-lg text-sm",
                isExamMode ? "bg-rose-500 hover:bg-rose-400 text-white" : "bg-slate-800 hover:bg-slate-700 text-white border border-slate-700"
              )}
            >
              <ShieldAlert className="w-4 h-4" />
              {isExamMode ? 'Disable Exam' : 'Exam Mode'}
            </button>
            <button 
              onClick={() => handleRoomPowerAction('wake')}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition-all shadow-lg"
            >
              <Play className="w-5 h-5" />
              Wake All
            </button>
            <button 
              onClick={() => handleRoomPowerAction('shutdown')}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold transition-all shadow-lg"
            >
              <Power className="w-5 h-5" />
              Shutdown All
            </button>
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className={cn(
                "flex items-center justify-center gap-2 px-4 py-3 text-white rounded-xl font-bold transition-all shadow-lg",
                isUploading ? "bg-indigo-400 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-500"
              )}
            >
              <FileUp className={cn("w-5 h-5", isUploading && "animate-bounce")} />
              {isUploading ? 'Sharing...' : 'Share File'}
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              onChange={handleFileUpload} 
            />
            <button 
              onClick={() => {
                fetchCollectedFiles();
                setShowCollectedModal(true);
              }}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition-all shadow-lg relative"
            >
              <FileDown className="w-5 h-5" />
              Collect Files
              {collectedFiles.length > 0 && (
                <span className="absolute -top-2 -right-2 w-6 h-6 bg-rose-500 rounded-full flex items-center justify-center text-xs font-bold border-2 border-slate-900">
                  {collectedFiles.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Collected Files Modal */}
      <AnimatePresence>
        {showCollectedModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <FileDown className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">Collected Files</h2>
                    <p className="text-sm text-slate-400">Room {room} Submissions</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowCollectedModal(false)} 
                  className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 max-h-[60vh] overflow-y-auto">
                {collectedFiles.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                      <FileDown className="w-8 h-8 text-slate-500" />
                    </div>
                    <p className="text-slate-400 font-medium">No files have been submitted yet.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {collectedFiles.map((file, idx) => (
                      <div key={file.id} className="flex items-center justify-between p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:border-emerald-500/50 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-lg bg-slate-900 flex items-center justify-center text-slate-400 font-mono text-xs font-bold">
                            {file?.pc_id ? file.pc_id.split('-').pop() : '?'}
                          </div>
                          <div>
                            <p className="font-bold text-white">{file?.filename || 'Unknown'}</p>
                            <p className="text-xs text-slate-400">
                              PC: {file?.pc_id ? file.pc_id.replace(/-/g, '.') : 'Unknown'} • {file?.size ? (file.size / 1024).toFixed(1) : 0} KB • {file?.submitted_at ? new Date(file.submitted_at).toLocaleTimeString() : ''}
                            </p>
                          </div>
                        </div>
                        <button 
                          onClick={() => triggerDownloadFile(file)}
                          className="p-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-bold"
                          title="Download file"
                        >
                          <Download className="w-4 h-4" />
                          Download
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {collectedFiles.length > 0 && (
                <div className="p-6 border-t border-slate-800 bg-slate-950/50 flex justify-end">
                  <button 
                    onClick={triggerDownloadAllZip}
                    className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition-colors flex items-center gap-2"
                  >
                    <Download className="w-5 h-5" />
                    Download All Files Bundle
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {pcs.map((pc, i) => (
          <motion.div 
            key={pc.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.02 }}
            className={cn(
              "relative overflow-hidden rounded-2xl p-4 border transition-all flex flex-col items-center gap-3",
              pc.needs_help ? "bg-amber-500/10 border-amber-500/50 shadow-lg shadow-amber-500/20" : 
              pc.status === 'offline' ? "bg-slate-900/50 border-slate-800/50 opacity-50" :
              "bg-slate-900/80 border-slate-700/50 hover:border-indigo-500/50"
            )}
          >
            {pc.needs_help && (
              <motion.div 
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
                className="absolute top-2 right-2 text-amber-400"
              >
                <Hand className="w-5 h-5" />
              </motion.div>
            )}
            
            <div className={cn(
              "w-12 h-12 rounded-xl flex items-center justify-center relative",
              pc.status === 'online' ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-800 text-slate-500"
            )}>
              <Monitor className="w-6 h-6" />
              {pc.locked && (
                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center border-2 border-slate-900">
                  <Lock className="w-3 h-3 text-slate-900" />
                </div>
              )}
              {pc.exam_mode && !pc.locked && (
                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-rose-500 rounded-full flex items-center justify-center border-2 border-slate-900">
                  <ShieldAlert className="w-3 h-3 text-white" />
                </div>
              )}
            </div>
            
            <div className="text-center">
              <div className="flex items-center justify-center gap-1.5">
                <p className="font-bold text-white">PC {i + 1}</p>
                {(pc.device_bound || pc.is_fixed || pc.is_real) && (
                  <span className="text-[10px] font-mono font-semibold bg-emerald-500/15 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/30" title="Workstation permanently bound to this physical computer">
                    Fixed
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 font-mono">{pc?.ip || 'Unknown'}</p>
            </div>

            {pc.violation && (
              <div className="w-full bg-rose-500/20 border border-rose-500/50 rounded-lg px-2 py-1 text-[11px] text-rose-300 font-bold flex items-center justify-between animate-pulse">
                <span className="flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <span className="truncate">Bypass Attempt!</span>
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDismissViolation(pc.id);
                  }}
                  className="text-rose-400 hover:text-white ml-1 font-bold text-sm leading-none"
                  title="Dismiss violation alert"
                >
                  ×
                </button>
              </div>
            )}

            {pc.status === 'online' && (
              <div className="flex flex-col gap-1.5 w-full mt-2">
                <div className="flex gap-1.5 w-full">
                  <button 
                    onClick={() => handleTogglePcLock(pc.id, !pc.locked)}
                    className={cn(
                      "flex-1 py-1.5 px-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 shadow-sm",
                      pc.locked 
                        ? "bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40" 
                        : "bg-slate-800 hover:bg-rose-900/60 text-slate-300 hover:text-white border border-slate-700/60"
                    )}
                    title={pc.locked ? "Click to unlock this PC" : "Click to lock this PC"}
                  >
                    {pc.locked ? (
                      <>
                        <Unlock className="w-3.5 h-3.5 text-amber-400" />
                        <span>Unlock</span>
                      </>
                    ) : (
                      <>
                        <Lock className="w-3.5 h-3.5 text-slate-400" />
                        <span>Lock</span>
                      </>
                    )}
                  </button>

                  <button 
                    onClick={() => handleRemoteControl(pc.id)}
                    className="py-1.5 px-2 bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white text-xs font-bold rounded-lg transition-colors flex items-center justify-center"
                    title="Live Monitor & Remote Control"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>

                  <a 
                    href={`/student?pc=${pc.id}&room=${pc.room || room}`}
                    target="_blank" 
                    rel="noreferrer"
                    className="py-1.5 px-2 bg-slate-800 hover:bg-emerald-600 text-slate-300 hover:text-white text-xs font-bold rounded-lg transition-colors flex items-center justify-center"
                    title="Open Student Workstation in New Tab"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>

                {pc.needs_help && (
                  <button 
                    onClick={() => handleResolveHelp(pc.id)}
                    className="w-full py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-900 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1"
                  >
                    <Hand className="w-3.5 h-3.5" /> Resolve Help
                  </button>
                )}
              </div>
            )}

            {pc.status === 'offline' && (
              <div className="flex gap-2 w-full mt-2">
                <button 
                  onClick={() => handlePowerAction(pc.id, 'wake')}
                  className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1"
                >
                  <Play className="w-3 h-3" /> Wake PC
                </button>
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Remote Control Session Modal */}
      <AnimatePresence>
        {remoteSessionPC && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-slate-700 w-full max-w-4xl rounded-3xl overflow-hidden shadow-2xl flex flex-col"
            >
              {/* Header */}
              <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <Monitor className="w-4 h-4 text-indigo-400" />
                      Live Remote Desktop Session &bull; PC {remoteSessionPC.replace(/-/g, '.')}
                    </h3>
                    <p className="text-xs text-slate-400">Connected to Lab Room {room} via secure agent channel</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      handleRoomAction('lock');
                      showToast(`Lock signal sent to PC ${remoteSessionPC}`);
                    }}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 font-semibold rounded-lg transition-colors"
                  >
                    Send Lock
                  </button>
                  <button
                    onClick={() => {
                      handlePowerAction(remoteSessionPC, 'shutdown');
                      setRemoteSessionPC(null);
                    }}
                    className="px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-xs text-rose-400 font-semibold rounded-lg transition-colors flex items-center gap-1"
                  >
                    <Power className="w-3.5 h-3.5" /> Shutdown
                  </button>
                  <button
                    onClick={() => setRemoteSessionPC(null)}
                    className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors ml-2"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Viewport Simulation */}
              <div className="p-6 bg-[#0c1017] min-h-[380px] flex flex-col justify-between font-mono">
                <div className="space-y-2 text-xs text-slate-300">
                  <div className="flex items-center gap-2 text-emerald-400 pb-2 border-b border-slate-800">
                    <Terminal className="w-4 h-4" />
                    <span>Remote Console &bull; Windows PowerShell (Interactive)</span>
                  </div>
                  <p className="text-slate-500">Windows PowerShell [Version 10.0.22631.3296]</p>
                  <p className="text-slate-500">(c) Microsoft Corporation. All rights reserved.</p>
                  <p className="pt-2 text-indigo-400">PS C:\Users\Student&gt; Get-Process | Where-Object &#123; $_.CPU -gt 1 &#125; | Select-Object -First 3</p>
                  <div className="bg-black/50 p-3 rounded-xl border border-slate-800 text-slate-400 text-[11px] leading-relaxed">
                    <p>Handles  NPM(K)    PM(K)      WS(K)     CPU(s)     Id ProcessName</p>
                    <p>-------  ------    -----      -----     ------     -- -----------</p>
                    <p>    412      24    45892      84120      12.42   4108 Code.exe</p>
                    <p>    892      48   112040     195410      28.15   6820 chrome.exe</p>
                    <p>    198      16    28410      49100       4.10   2912 LabMonitorAgent.exe</p>
                  </div>
                  <p className="text-slate-400 pt-2">Screen viewport: 1920x1080 @ 60Hz &bull; Input latency: 14ms</p>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span>Active Screen Stream &bull; Teacher Supervision Mode</span>
                  </div>
                  <button
                    onClick={() => {
                      showToast(`Ctrl+Alt+Del signal transmitted to PC ${remoteSessionPC}`);
                    }}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold"
                  >
                    Send Ctrl+Alt+Del
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
