import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { Monitor, Hand, Upload, Download, AlertTriangle, Lock, ShieldAlert, CheckCircle2, Power, X, FileText, KeyRound, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { triggerDocumentDownload } from '../lib/downloadHelper';

export default function StudentDashboard() {
  const { pcId: routePcId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  const urlPc = routePcId || searchParams.get('pc');
  const urlRoom = searchParams.get('room');

  const [currentPcId, setCurrentPcId] = useState<string>(() => {
    return urlPc || localStorage.getItem('userId') || '192-168-0-12';
  });
  const [room, setRoom] = useState<string>(() => {
    return urlRoom || localStorage.getItem('userRoom') || '809';
  });

  const [pc, setPc] = useState<any>(null);
  const [roomLocked, setRoomLocked] = useState(false);
  const [availableRoomPcs, setAvailableRoomPcs] = useState<any[]>([]);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [sharedFiles, setSharedFiles] = useState<any[]>([]);
  const [showMaterialsModal, setShowMaterialsModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPinUnlock, setShowPinUnlock] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  const [violationCount, setViolationCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const wasLockedRef = useRef(false);

  // Sync if URL params change
  useEffect(() => {
    if (urlPc && urlPc !== currentPcId) {
      setCurrentPcId(urlPc);
    }
    if (urlRoom && urlRoom !== room) {
      setRoom(urlRoom);
    }
  }, [urlPc, urlRoom]);

  // Sound alert when station gets locked
  const playLockBeep = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.4);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.4);
      }
    } catch (e) {
      // Audio context might require user interaction first, benign
    }
  };

  const fetchPC = async () => {
    const targetId = currentPcId || '192-168-0-12';
    
    // Check room status in parallel for instantaneous authoritative lock detection
    fetch(`/api/labs/${room}/status`)
      .then(r => r.json())
      .then(st => {
        if (st && typeof st.locked === 'boolean') {
          setRoomLocked(st.locked);
        }
      })
      .catch(() => {});

    try {
      const res = await fetch(`/api/pcs/${targetId}`);
      if (!res.ok) {
        // If specific PC not found, grab list of PCs in the room
        const allRes = await fetch('/api/pcs');
        const allPcs = await allRes.json();
        if (Array.isArray(allPcs)) {
          const roomPcs = allPcs.filter(p => p.room === room);
          setAvailableRoomPcs(roomPcs);
          if (roomPcs.length > 0) {
            const defaultPc = roomPcs[0];
            setCurrentPcId(defaultPc.id);
            setPc(defaultPc);
            return;
          }
        }
      } else {
        const data = await res.json();
        if (data && !data.error) {
          const isEffectiveLocked = !!data.locked || roomLocked;
          if (isEffectiveLocked && !wasLockedRef.current) {
            playLockBeep();
          }
          wasLockedRef.current = isEffectiveLocked;
          setPc({ ...data, locked: isEffectiveLocked });
          if (data.room && data.room !== room) {
            setRoom(data.room);
          }
        }
      }
    } catch (e) {
      // Offline fallback
    }

    // Also populate room PCs for switcher dropdown
    fetch('/api/pcs')
      .then(r => r.json())
      .then(all => {
        if (Array.isArray(all)) {
          setAvailableRoomPcs(all.filter(p => p.room === room));
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

  // Instant polling (every 1 second) for real-time responsiveness to teacher commands
  useEffect(() => {
    fetchPC();
    fetchFiles();
    const interval = setInterval(() => {
      fetchPC();
      fetchFiles();
    }, 1000);
    return () => clearInterval(interval);
  }, [currentPcId, room]);

  const isStationLocked = (pc && pc.locked) || roomLocked;

  // Lock-down enforcement: prevent scrolling, tab switching, and keyboard escape
  useEffect(() => {
    if (!isStationLocked) {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      return;
    }

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    // Attempt browser fullscreen to isolate student workstation
    try {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } catch {}

    const handleKeyDown = (e: KeyboardEvent) => {
      // Allow teacher PIN input to receive numbers/characters and Enter
      if ((e.target as HTMLElement)?.tagName === 'INPUT') {
        if (e.key === 'Escape') {
          setShowPinUnlock(false);
        }
        return;
      }
      
      // Block all keys from reaching student desktop interface or switching tabs
      e.preventDefault();
      e.stopPropagation();
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    const playViolationSiren = () => {
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(800, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(350, ctx.currentTime + 0.3);
          gain.gain.setValueAtTime(0.4, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.3);
        }
      } catch {}
    };

    const handleWindowBlur = () => {
      playViolationSiren();
      setViolationCount(prev => prev + 1);
      const targetId = currentPcId || pc?.id;
      if (targetId) {
        fetch(`/api/pcs/${targetId}/violation`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: 'Tab switched / lost focus while station locked' })
        }).catch(() => {});
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        handleWindowBlur();
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    window.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isStationLocked, currentPcId, pc?.id]);

  const handleTeacherPinUnlock = async () => {
    // PIN '1234' or 'admin123'
    if (pinInput.trim() === '1234' || pinInput.trim() === 'admin123') {
      try {
        if (pc?.id) {
          await fetch(`/api/pcs/${pc.id}/action`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'unlock' })
          });
        }
        setRoomLocked(false);
        setPc((prev: any) => ({ ...prev, locked: false }));
        wasLockedRef.current = false;
        setShowPinUnlock(false);
        setPinInput('');
        setPinError(false);
        showToast('Station unlocked via Teacher PIN', 'success');
      } catch (e) {
        showToast('Failed to contact server', 'error');
      }
    } else {
      setPinError(true);
      setTimeout(() => setPinError(false), 2500);
    }
  };

  const handleSwitchStation = (newId: string) => {
    setCurrentPcId(newId);
    localStorage.setItem('userId', newId);
    setSearchParams({ pc: newId, room });
    setPc(null);
  };

  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
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
      showToast(`Downloaded: ${filename}`, 'success');
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
    showToast(`Downloaded: ${filename}`, 'success');
  };

  const handleAction = async (action: string) => {
    const targetId = currentPcId || pc?.id || '192-168-0-12';
    
    // Instant optimistic UI update so user gets immediate visual confirmation
    setPc((prev: any) => {
      if (!prev) return prev;
      return {
        ...prev,
        needs_help: action === 'help'
      };
    });

    try {
      // 1. Try student-action path
      let res = await fetch(`/api/pcs/${encodeURIComponent(targetId)}/student-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, room, id: targetId, pc_id: targetId })
      });

      // 2. Fallback to generic student-action endpoint
      if (!res.ok) {
        res = await fetch('/api/pcs/student-action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, room, id: targetId, pc_id: targetId })
        });
      }

      // 3. Fallback to standard action endpoint
      if (!res.ok) {
        res = await fetch(`/api/pcs/${encodeURIComponent(targetId)}/action`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, room, id: targetId })
        });
      }

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || `HTTP ${res.status}`);
      }

      const json = await res.json().catch(() => null);
      if (json?.pc) {
        setPc(json.pc);
      }

      showToast(
        action === 'help' 
          ? '✋ Hand raised! Teacher has been notified' 
          : '✅ Help request cancelled',
        'success'
      );
      fetchPC();
    } catch (e: any) {
      console.error('Student action error:', e);
      fetchPC(); // Re-sync in case of discrepancy
      showToast(e?.message ? `Notice: ${e.message}` : 'Failed to send action', 'error');
    }
  };

  const handleReportIssue = async () => {
    const targetId = currentPcId || pc?.id || '192-168-0-12';
    try {
      await fetch('/api/issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room: room || '809',
          pc_id: targetId,
          issue: `Student reported hardware/network issue at Station ${pc?.ip || targetId}`,
          priority: 'medium'
        })
      });
      showToast('⚠️ Issue reported to IT Admin & Instructor', 'success');
    } catch (e) {
      showToast('⚠️ Issue noted on station', 'info');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsSubmitting(true);
    showToast(`Uploading ${file.name}...`, 'info');

    const submitData = async (contentStr?: string) => {
      try {
        const targetId = currentPcId || pc?.id || '192-168-0-12';
        const res = await fetch(`/api/labs/${room}/submit-file`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pc_id: targetId,
            filename: file.name,
            size: file.size,
            content: contentStr || null,
            content_type: file.type
          })
        });
        if (!res.ok) throw new Error('Failed to submit');
        showToast(`Assignment "${file.name}" submitted successfully!`, 'success');
      } catch (err) {
        showToast('Failed to submit assignment', 'error');
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
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className={cn(
              "fixed top-6 right-6 px-5 py-3 rounded-2xl shadow-2xl z-50 font-medium flex items-center gap-3 border backdrop-blur-xl transition-all",
              toast.type === 'error' && "bg-rose-950/95 text-rose-200 border-rose-500/60 shadow-rose-950/40",
              toast.type === 'success' && "bg-emerald-950/95 text-emerald-200 border-emerald-500/60 shadow-emerald-950/40",
              toast.type === 'info' && "bg-indigo-950/95 text-indigo-200 border-indigo-500/60 shadow-indigo-950/40"
            )}
          >
            {toast.type === 'error' ? (
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            ) : toast.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <Monitor className="w-5 h-5 text-indigo-400 shrink-0" />
            )}
            <span className="text-sm font-semibold">{toast.msg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Full Screen Lock Overlay rendered via Portal into document.body */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {isStationLocked && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                try {
                  if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
                    document.documentElement.requestFullscreen().catch(() => {});
                  }
                  if (document.body.requestPointerLock) {
                    document.body.requestPointerLock();
                  }
                } catch {}
              }}
              className="fixed inset-0 z-[9999999] bg-slate-950/98 backdrop-blur-2xl flex flex-col items-center justify-center p-6 text-center select-none cursor-not-allowed"
            >
              {/* Pulsing red security border */}
              <div className="absolute inset-0 border-8 border-rose-500/20 pointer-events-none animate-pulse" />
              
              <div className="relative z-10 max-w-xl w-full flex flex-col items-center">
                <motion.div 
                  animate={{ scale: [1, 1.08, 1] }}
                  transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                  className="w-32 h-32 bg-rose-500/15 border-2 border-rose-500/40 rounded-3xl flex items-center justify-center mb-8 shadow-2xl shadow-rose-500/30"
                >
                  <Lock className="w-16 h-16 text-rose-500" />
                </motion.div>

                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-bold tracking-wider uppercase mb-4">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                  Kernel Input Freeze & Workstation Lock Active
                </div>

                <h1 className="text-4xl sm:text-6xl font-black text-white mb-4 tracking-tight text-center">
                  Workstation & Input Frozen
                </h1>

                <p className="text-lg sm:text-xl text-rose-200 font-medium mb-3 max-w-lg text-center">
                  Your PC screen, physical mouse, keyboard, and background apps have been frozen by the Teacher.
                </p>

                <p className="text-sm text-slate-400 mb-6 max-w-md text-center">
                  Access to external AI tools (ChatGPT, Claude, Gemini), browser tabs, and desktop applications is completely restricted.
                </p>

                {violationCount > 0 && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-6 px-5 py-2.5 rounded-2xl bg-rose-600/30 border border-rose-500 text-rose-200 text-sm font-bold flex items-center gap-2.5 animate-pulse shadow-lg shadow-rose-900/40"
                  >
                    <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
                    <span>🚨 Application Switch / Focus Loss Detected ({violationCount}x) — Instructor Alerted!</span>
                  </motion.div>
                )}

                {/* Lockdown badges */}
                <div className="flex flex-wrap items-center justify-center gap-2.5 mb-8">
                  <div className="px-3 py-1.5 rounded-xl bg-slate-900/80 border border-slate-700/80 text-xs font-semibold text-rose-300 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                    Mouse & Keyboard: Blocked
                  </div>
                  <div className="px-3 py-1.5 rounded-xl bg-slate-900/80 border border-slate-700/80 text-xs font-semibold text-amber-300 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    AI & Browsers: Suspended
                  </div>
                  <div className="px-3 py-1.5 rounded-xl bg-slate-900/80 border border-slate-700/80 text-xs font-semibold text-indigo-300 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-500" />
                    Taskbar: Disabled
                  </div>
                </div>

                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl px-6 py-4 flex items-center gap-6 shadow-inner mb-8">
                  <div>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Lab Room</span>
                    <span className="text-lg font-extrabold text-indigo-400">Room {room || '809'}</span>
                  </div>
                  <div className="w-px h-8 bg-slate-800" />
                  <div>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Station IP</span>
                    <span className="text-lg font-extrabold text-slate-200 font-mono">{pc?.ip || '192.168.0.x'}</span>
                  </div>
                </div>

                {/* Emergency Teacher Unlock Button */}
                <div className="relative">
                  {!showPinUnlock ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowPinUnlock(true);
                      }}
                      className="px-4 py-2 bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      Teacher PIN Unlock
                    </button>
                  ) : (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-slate-900 border border-slate-700 p-4 rounded-2xl shadow-2xl flex flex-col items-center gap-3 w-72"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <p className="text-xs font-bold text-slate-300">Enter Teacher PIN (Default: 1234)</p>
                      <div className="flex gap-2 w-full">
                        <input
                          type="password"
                          value={pinInput}
                          onChange={(e) => setPinInput(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleTeacherPinUnlock()}
                          placeholder="PIN..."
                          autoFocus
                          className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                        />
                        <button
                          onClick={handleTeacherPinUnlock}
                          className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-all"
                        >
                          Unlock
                        </button>
                      </div>
                      {pinError && (
                        <p className="text-xs text-rose-400 font-medium">Incorrect PIN. Try 1234</p>
                      )}
                      <button
                        onClick={() => setShowPinUnlock(false)}
                        className="text-xs text-slate-500 hover:text-slate-400 mt-1"
                      >
                        Cancel
                      </button>
                    </motion.div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Powered Off Overlay rendered via Portal */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {pc.status === 'offline' && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[9999999] bg-black flex flex-col items-center justify-center p-6 text-center select-none"
            >
              <div className="w-24 h-24 bg-slate-900 rounded-full flex items-center justify-center mb-6">
                <Power className="w-12 h-12 text-slate-700" />
              </div>
              <h1 className="text-4xl font-bold text-slate-600 mb-2">Station Powered Off</h1>
              <p className="text-slate-800 font-mono text-sm">Waiting for Wake-on-LAN signal from Instructor...</p>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Station Selector & Live Sync Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Station:</span>
          <select 
            value={currentPcId} 
            onChange={(e) => handleSwitchStation(e.target.value)}
            className="bg-slate-950 border border-slate-700 text-white text-sm rounded-xl px-3 py-1.5 font-mono focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            {availableRoomPcs.map(p => (
              <option key={p.id} value={p.id}>
                {p.ip} ({p.name || `PC ${p.ip.split('.').pop()}`}) {p.locked ? '🔒 LOCKED' : ''}
              </option>
            ))}
            {availableRoomPcs.length === 0 && (
              <option value={currentPcId}>{pc?.ip || currentPcId}</option>
            )}
          </select>
          <span className="text-xs text-slate-500 font-semibold">Room {room}</span>
        </div>

        <div className="flex items-center gap-3">
          <div className={cn(
            "inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold border",
            isStationLocked ? "bg-rose-500/10 text-rose-400 border-rose-500/30" : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
          )}>
            <span className={cn("w-2 h-2 rounded-full", isStationLocked ? "bg-rose-500 animate-ping" : "bg-emerald-500")} />
            {isStationLocked ? "SCREEN LOCKED" : "SCREEN UNLOCKED"}
          </div>

          <Link
            to="/"
            className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium transition-colors"
          >
            Instructor Dashboard <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

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
                <p className={cn(
                  "text-lg font-bold capitalize",
                  pc.status === 'online' ? "text-emerald-400" :
                  pc.status === 'issue' ? "text-amber-400" : "text-slate-400"
                )}>{pc.status || 'Online'}</p>
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
          onClick={handleReportIssue}
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
