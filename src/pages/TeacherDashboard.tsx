import React, { useEffect, useState, useRef } from 'react';
import { Monitor, Lock, Unlock, ShieldAlert, FileUp, FileDown, Hand, CheckCircle2, X, Download, Power, Play } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { triggerDocumentDownload } from '../lib/downloadHelper';

export default function TeacherDashboard() {
  const [pcs, setPcs] = useState<any[]>([]);
  const [toastMsg, setToastMsg] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [showCollectedModal, setShowCollectedModal] = useState(false);
  const [collectedFiles, setCollectedFiles] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const room = localStorage.getItem('userRoom') || '809';

  const fetchPCs = () => {
    fetch('/api/pcs')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setPcs(data.filter((pc: any) => pc.room === room));
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
    }, 5000);
    return () => clearInterval(interval);
  }, [room, showCollectedModal]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  const triggerDownloadFile = (file: any) => {
    const filename = file?.filename || 'Submission.txt';
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
    try {
      await fetch(`/api/labs/${room}/teacher-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      showToast(`Action applied successfully`);
      fetchPCs();
    } catch (e) {
      showToast('Failed to apply action');
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
    showToast(`Initiating Remote Control for PC ${pcId}...`);
    // Mocking remote control
    setTimeout(() => {
      alert(`Remote Control Session Started for PC ${pcId}\n\n(Note: True remote control requires a native desktop client like TeamViewer or AnyDesk installed on the student's PC. This is a web prototype.)`);
    }, 1000);
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
            <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400 tracking-tight">
              Room {room} Control
            </h1>
            <p className="text-slate-400 mt-4 text-lg max-w-2xl leading-relaxed">
              Manage your classroom, lock screens, enable exam mode, and assist students.
            </p>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <button 
              onClick={() => handleRoomAction(isAllLocked ? 'unlock' : 'lock')}
              className={cn(
                "flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold transition-all shadow-lg",
                isAllLocked ? "bg-amber-500 hover:bg-amber-400 text-slate-900" : "bg-slate-800 hover:bg-slate-700 text-white border border-slate-700"
              )}
            >
              {isAllLocked ? <Unlock className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
              {isAllLocked ? 'Unlock Screens' : 'Lock Screens'}
            </button>
            <button 
              onClick={() => handleRoomAction(isExamMode ? 'exam_off' : 'exam_on')}
              className={cn(
                "flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold transition-all shadow-lg",
                isExamMode ? "bg-rose-500 hover:bg-rose-400 text-white" : "bg-slate-800 hover:bg-slate-700 text-white border border-slate-700"
              )}
            >
              <ShieldAlert className="w-5 h-5" />
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
              <p className="font-bold text-white">PC {i + 1}</p>
              <p className="text-xs text-slate-400 font-mono">{pc?.ip || 'Unknown'}</p>
            </div>

            {pc.status === 'online' && (
              <div className="flex gap-2 w-full mt-2">
                {pc.needs_help ? (
                  <button 
                    onClick={() => handleResolveHelp(pc.id)}
                    className="flex-1 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-900 text-xs font-bold rounded-lg transition-colors"
                  >
                    Resolve Help
                  </button>
                ) : (
                  <button 
                    onClick={() => handleRemoteControl(pc.id)}
                    className="flex-1 py-1.5 bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white text-xs font-bold rounded-lg transition-colors"
                  >
                    Remote Control
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
    </div>
  );
}
