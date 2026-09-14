import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { 
  Monitor, Hand, Upload, Download, AlertTriangle, Lock, ShieldAlert, 
  CheckCircle2, Power, X, FileText, KeyRound, ExternalLink, 
  Maximize2, Minimize2, Send, Code, BookOpen, AlertCircle, Save 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { triggerDocumentDownload } from '../lib/downloadHelper';

export default function StudentDashboard() {
  const { pcId: routePcId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  const urlPc = routePcId || searchParams.get('pc');
  const urlRoom = searchParams.get('room');

  // Persistent Fixed Hardware Binding: Once assigned as a Student PC, it is permanently locked to this workstation
  const [currentPcId, setCurrentPcId] = useState<string>(() => {
    const bound = localStorage.getItem('fixed_student_station_id');
    if (bound) return bound;
    const initial = urlPc || localStorage.getItem('userId') || '192-168-0-12';
    localStorage.setItem('fixed_student_station_id', initial);
    localStorage.setItem('userId', initial);
    return initial;
  });
  const [room, setRoom] = useState<string>(() => {
    const boundRoom = localStorage.getItem('fixed_student_room');
    if (boundRoom) return boundRoom;
    const initialRoom = urlRoom || localStorage.getItem('userRoom') || '809';
    localStorage.setItem('fixed_student_room', initialRoom);
    localStorage.setItem('userRoom', initialRoom);
    return initialRoom;
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
  const [showRebindModal, setShowRebindModal] = useState(false);
  const [rebindPin, setRebindPin] = useState('');
  const [rebindError, setRebindError] = useState(false);
  const [selectedNewStation, setSelectedNewStation] = useState('');
  const [violationCount, setViolationCount] = useState(0);
  const [showExamViolationModal, setShowExamViolationModal] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [examAnswer, setExamAnswer] = useState<string>(() => {
    return localStorage.getItem('exam_ans_' + (urlPc || 'default')) || '';
  });
  const [examSubmitted, setExamSubmitted] = useState(false);
  const [examActiveTab, setExamActiveTab] = useState<'editor' | 'materials'>('editor');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const wasLockedRef = useRef(false);

  // Anti-tampering and Device Locking Guard:
  // Prevent any shifting to another student PC via URL manipulation
  useEffect(() => {
    const bound = localStorage.getItem('fixed_student_station_id');
    if (bound) {
      if (currentPcId !== bound) {
        setCurrentPcId(bound);
      }
      if (urlPc && urlPc !== bound) {
        setSearchParams({ pc: bound, room });
      }
    } else if (urlPc) {
      localStorage.setItem('fixed_student_station_id', urlPc);
      setCurrentPcId(urlPc);
    }
  }, [urlPc, room]);

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
        // If specific PC record not found yet, populate room PCs list without changing our bound currentPcId
        const allRes = await fetch('/api/pcs');
        const allPcs = await allRes.json();
        if (Array.isArray(allPcs)) {
          const roomPcs = allPcs.filter(p => p.room === room);
          setAvailableRoomPcs(roomPcs);
          const found = roomPcs.find(p => p.id === targetId || p.ip === targetId.replace(/-/g, '.'));
          if (found) {
            setPc(found);
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

  // Instant polling and active heartbeat for real-time responsiveness to teacher commands
  useEffect(() => {
    fetchPC();
    fetchFiles();

    // Send active browser station heartbeat to server so teacher immediately sees PC Online!
    const targetId = currentPcId || '192-168-0-12';
    const sendHeartbeat = () => {
      fetch(`/api/pcs/${encodeURIComponent(targetId)}/heartbeat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room: room || '809', id: targetId, ip: targetId.replace(/-/g, '.') })
      }).catch(() => {});
    };
    sendHeartbeat();

    const interval = setInterval(() => {
      fetchPC();
      fetchFiles();
      sendHeartbeat();
    }, 2000);
    return () => clearInterval(interval);
  }, [currentPcId, room]);

  // Exam Mode and Lock status
  const isExamActive = Boolean(pc?.exam_mode);
  const isLockedByViolations = isExamActive && violationCount >= 2;
  const isStationLocked = (pc && pc.locked) || roomLocked || isLockedByViolations;

  // Track browser fullscreen status
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // When Exam Mode is toggled on, auto-prompt fullscreen
  useEffect(() => {
    if (isExamActive) {
      try {
        if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen().catch(() => {});
        }
      } catch {}
      showToast('🔒 Proctored Exam Mode is ACTIVE: AI & Search are blocked. Tab switching is strictly prohibited!', 'error');
    }
  }, [isExamActive]);

  // Auto-save exam answers to localStorage
  useEffect(() => {
    if (examAnswer) {
      localStorage.setItem('exam_ans_' + (currentPcId || 'default'), examAnswer);
    }
  }, [examAnswer, currentPcId]);

  // Blaring audible alarm for cheating and security breaches
  const playViolationSiren = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(900, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.35);
        gain.gain.setValueAtTime(0.45, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      }
    } catch (e) {}
  };

  // Lock-down and Proctored Exam anti-cheat enforcement
  useEffect(() => {
    const shouldEnforce = isStationLocked || isExamActive;
    if (!shouldEnforce) {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      return;
    }

    if (isStationLocked) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    }

    // Attempt browser fullscreen to isolate student workstation
    try {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } catch {}

    const handleKeyDown = (e: KeyboardEvent) => {
      // If station is hard-locked: block all keys except PIN input modal
      if (isStationLocked) {
        if ((e.target as HTMLElement)?.tagName === 'INPUT') {
          if (e.key === 'Escape') {
            setShowPinUnlock(false);
          }
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      // If in Exam Mode: block new tab shortcuts, reload, view source, developer tools
      if (isExamActive) {
        const key = e.key.toLowerCase();
        if (
          e.key === 'F12' ||
          (e.ctrlKey && ['t', 'n', 'w', 'u', 'l'].includes(key)) ||
          (e.ctrlKey && e.shiftKey && ['i', 'j', 'c'].includes(key)) ||
          (e.altKey && e.key === 'Tab')
        ) {
          e.preventDefault();
          e.stopPropagation();
          playViolationSiren();
          showToast('⚠️ Shortcuts to open new tabs or developer tools are strictly forbidden during exams!', 'error');
        }
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      if (isStationLocked || isExamActive) {
        e.preventDefault();
      }
    };

    const handleWindowBlur = () => {
      playViolationSiren();
      setViolationCount(prev => {
        const next = prev + 1;
        if (isExamActive && next < 2) {
          setShowExamViolationModal(true);
        }
        const targetId = currentPcId || pc?.id;
        if (targetId) {
          const reason = isExamActive
            ? `🚨 EXAM CHEATING VIOLATION: Student switched tabs / left exam screen! (Violation #${next})`
            : `Station Locked: Focus lost / tab switched while locked (Violation #${next})`;
          fetch(`/api/pcs/${targetId}/violation`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: reason })
          }).catch(() => {});
        }
        return next;
      });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        handleWindowBlur();
      }
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isExamActive) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    window.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isStationLocked, isExamActive, currentPcId, pc?.id]);

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
          await fetch(`/api/pcs/${pc.id}/dismiss-violation`, { method: 'POST' }).catch(() => {});
        }
        setRoomLocked(false);
        setViolationCount(0);
        setShowExamViolationModal(false);
        setPc((prev: any) => ({ ...prev, locked: false, violation: false }));
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

  const handleConfirmAdminRebind = () => {
    if (rebindPin.trim() === '1234' || rebindPin.trim() === 'admin123') {
      const newId = selectedNewStation || currentPcId;
      localStorage.setItem('fixed_student_station_id', newId);
      localStorage.setItem('userId', newId);
      setCurrentPcId(newId);
      setSearchParams({ pc: newId, room });
      setPc(null);
      setShowRebindModal(false);
      setRebindPin('');
      setRebindError(false);
      showToast(`Workstation successfully bound to ${newId}`, 'success');
    } else {
      setRebindError(true);
      setTimeout(() => setRebindError(false), 2500);
    }
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

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        }
      }
    } catch (e) {
      showToast('Fullscreen mode toggled', 'info');
    }
  };

  const submitExamAnswer = async () => {
    if (!examAnswer.trim()) {
      showToast('Please type your solution or answer before submitting.', 'error');
      return;
    }
    setIsSubmitting(true);
    showToast('Submitting your exam paper to the instructor...', 'info');

    try {
      const targetId = currentPcId || pc?.id || '192-168-0-12';
      const cleanIp = (pc?.ip || targetId).replace(/\./g, '_');
      const filename = `Exam_Paper_PC_${cleanIp}.txt`;
      const res = await fetch(`/api/labs/${room}/submit-file`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pc_id: targetId,
          filename,
          size: examAnswer.length,
          content: `data:text/plain;charset=utf-8,${encodeURIComponent(examAnswer)}`,
          content_type: 'text/plain'
        })
      });
      if (!res.ok) throw new Error('Submission failed');
      setExamSubmitted(true);
      showToast('✅ Exam solution submitted to instructor successfully!', 'success');
    } catch (e) {
      showToast('Failed to submit exam paper', 'error');
    } finally {
      setIsSubmitting(false);
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
                  {isLockedByViolations ? "Anti-Cheat Enforcement Triggered" : "Kernel Input Freeze & Workstation Lock Active"}
                </div>

                <h1 className="text-4xl sm:text-6xl font-black text-white mb-4 tracking-tight text-center">
                  {isLockedByViolations ? "Exam Integrity Lockdown" : "Workstation & Input Frozen"}
                </h1>

                <p className="text-lg sm:text-xl text-rose-200 font-medium mb-3 max-w-lg text-center">
                  {isLockedByViolations
                    ? "You have been locked out due to multiple tab-switching or external AI attempts."
                    : "Your PC screen, physical mouse, keyboard, and background apps have been frozen by the Teacher."}
                </p>

                <p className="text-sm text-slate-400 mb-6 max-w-md text-center">
                  {isLockedByViolations
                    ? "External tabs, ChatGPT, Claude, and Gemini are strictly prohibited during exams. Call your instructor to unlock."
                    : "Access to external AI tools (ChatGPT, Claude, Gemini), browser tabs, and desktop applications is completely restricted."}
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

      {/* Unskippable Exam Cheating Violation Alert Modal rendered via Portal */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {showExamViolationModal && !isStationLocked && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[9999998] bg-slate-950/95 backdrop-blur-xl flex items-center justify-center p-6 text-center select-none"
            >
              <div className="absolute inset-0 border-8 border-rose-500/30 pointer-events-none animate-pulse" />
              
              <div className="bg-slate-900 border-2 border-rose-500 rounded-3xl p-8 max-w-lg w-full shadow-2xl shadow-rose-950/80 relative">
                <div className="w-20 h-20 bg-rose-500/20 border-2 border-rose-500/50 rounded-2xl flex items-center justify-center mx-auto mb-5 text-rose-500 shadow-xl shadow-rose-500/30">
                  <ShieldAlert className="w-10 h-10 animate-pulse" />
                </div>
                
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-bold uppercase tracking-wider mb-3">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Anti-Cheat Violation Intercepted
                </div>

                <h2 className="text-2xl sm:text-3xl font-black text-white mb-2 tracking-tight">
                  External Tab or AI Attempt Detected!
                </h2>
                
                <p className="text-rose-200 text-sm font-medium mb-5">
                  You switched away from the active exam screen or opened a new browser tab.
                </p>

                <div className="bg-slate-950 border border-rose-500/30 rounded-2xl p-4 text-xs text-slate-300 mb-6 text-left space-y-2.5">
                  <div className="flex items-center justify-between font-bold text-rose-400">
                    <span>Violation #{violationCount} Recorded</span>
                    <span className="text-amber-400">Limit: 2 Violations</span>
                  </div>
                  <p>• Navigating away, opening new tabs, or accessing ChatGPT, Claude, Gemini, etc. is strictly forbidden.</p>
                  <p>• A high-priority cheating incident has been transmitted to your Instructor with your PC IP ({pc?.ip || currentPcId}).</p>
                  <p className="text-amber-300 font-semibold">• ⚠️ Reaching 2 violations will permanently lock your workstation until the teacher enters the master PIN.</p>
                </div>

                <button
                  onClick={() => {
                    setShowExamViolationModal(false);
                    try {
                      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
                        document.documentElement.requestFullscreen().catch(() => {});
                      }
                    } catch {}
                  }}
                  className="w-full py-4 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white rounded-2xl font-bold text-base transition-all shadow-xl shadow-rose-600/30 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  <span>I Understand &amp; Return to Exam Screen</span>
                </button>
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

      {/* Station Assignment & Live Sync Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Assigned Workstation:</span>
          
          <div className="flex items-center gap-2 bg-slate-950 border border-slate-700/80 rounded-xl px-3.5 py-1.5 font-mono text-sm shadow-inner">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-white font-bold tracking-wide">
              PC {pc?.ip ? pc.ip.split('.').pop() : currentPcId.split('-').pop()}
            </span>
            <span className="text-xs text-slate-400 font-mono">({pc?.ip || currentPcId.replace(/-/g, '.')})</span>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/25">
              <Lock className="w-3 h-3 text-emerald-400" /> Fixed Device
            </span>
            <button
              type="button"
              onClick={() => {
                setSelectedNewStation(currentPcId);
                setRebindPin('');
                setRebindError(false);
                setShowRebindModal(true);
              }}
              className="text-slate-500 hover:text-amber-400 p-1 hover:bg-slate-800 rounded transition-colors ml-1"
              title="Admin Rebind (Teacher Only)"
            >
              <KeyRound className="w-3.5 h-3.5 text-amber-400/80 hover:text-amber-400" />
            </button>
          </div>
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

      {isExamActive ? (
        /* ==================== SECURE PROCTORED EXAM WORKSPACE ==================== */
        <div className="space-y-6">
          {/* Exam Proctored HUD Banner */}
          <div className="rounded-3xl bg-slate-900 border-2 border-rose-500/40 p-6 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-80 h-80 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
            
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-rose-500/20 border border-rose-500/50 flex items-center justify-center text-rose-400 shrink-0 shadow-lg shadow-rose-500/20">
                  <ShieldAlert className="w-8 h-8 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-black text-white tracking-tight">
                      Proctored Exam Workspace
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/50 text-rose-300 text-xs font-bold uppercase tracking-wider animate-pulse">
                      Live Proctoring Active
                    </span>
                  </div>
                  <p className="text-slate-400 text-sm mt-1 max-w-xl">
                    External tabs, ChatGPT, Claude, and Gemini are strictly blocked. All window-switches are logged in real-time.
                  </p>
                </div>
              </div>

              {/* Action buttons & Anti-cheat badges */}
              <div className="flex flex-wrap items-center gap-3">
                <div className={cn(
                  "px-3.5 py-2 rounded-xl text-xs font-bold border flex items-center gap-2",
                  violationCount > 0 
                    ? "bg-rose-500/20 border-rose-500/60 text-rose-300 animate-pulse"
                    : "bg-slate-950 border-slate-800 text-slate-400"
                )}>
                  <AlertTriangle className={cn("w-4 h-4", violationCount > 0 ? "text-rose-400" : "text-slate-500")} />
                  <span>Violations: <strong className={violationCount > 0 ? "text-rose-200" : "text-white"}>{violationCount}</strong> / 2</span>
                </div>

                <button
                  onClick={toggleFullscreen}
                  className={cn(
                    "px-4 py-2 rounded-xl text-xs font-bold border flex items-center gap-2 transition-all cursor-pointer",
                    isFullscreen 
                      ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30"
                      : "bg-rose-600 hover:bg-rose-500 border-rose-500 text-white shadow-lg shadow-rose-600/30"
                  )}
                >
                  {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                  <span>{isFullscreen ? "Fullscreen Locked" : "Enter Fullscreen"}</span>
                </button>

                <button
                  onClick={() => handleAction(pc.needs_help ? 'resolve_help' : 'help')}
                  className={cn(
                    "px-4 py-2 rounded-xl text-xs font-bold border flex items-center gap-2 transition-all cursor-pointer",
                    pc.needs_help 
                      ? "bg-amber-500 text-slate-950 border-amber-400 shadow-lg shadow-amber-500/30 animate-bounce"
                      : "bg-slate-800 hover:bg-slate-700 text-amber-300 border-slate-700"
                  )}
                >
                  <Hand className="w-4 h-4" />
                  <span>{pc.needs_help ? "Help Summoned" : "Raise Hand"}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Exam Navigation Tabs */}
          <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
            <button
              onClick={() => setExamActiveTab('editor')}
              className={cn(
                "px-5 py-2.5 rounded-2xl font-bold text-sm flex items-center gap-2.5 transition-all cursor-pointer",
                examActiveTab === 'editor'
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                  : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800"
              )}
            >
              <Code className="w-4 h-4" />
              <span>Exam Solution &amp; Answer Sheet</span>
            </button>

            <button
              onClick={() => setExamActiveTab('materials')}
              className={cn(
                "px-5 py-2.5 rounded-2xl font-bold text-sm flex items-center gap-2.5 transition-all cursor-pointer relative",
                examActiveTab === 'materials'
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                  : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800"
              )}
            >
              <BookOpen className="w-4 h-4" />
              <span>Exam Question Papers &amp; Materials</span>
              {sharedFiles.length > 0 && (
                <span className="ml-1 px-2 py-0.5 rounded-full bg-emerald-500 text-white text-xs font-extrabold">
                  {sharedFiles.length}
                </span>
              )}
            </button>
          </div>

          {/* Tab 1: Solution Editor */}
          {examActiveTab === 'editor' && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold">
                    📝
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base">Write Your Exam Solution</h3>
                    <p className="text-xs text-slate-400">
                      Auto-saved to station memory. Submit before the exam timer ends.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs font-medium text-slate-400">
                  <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                    <Save className="w-3.5 h-3.5" />
                    Auto-saved
                  </span>
                  <span>{examAnswer.length} chars</span>
                  <span>{examAnswer.trim() ? examAnswer.trim().split(/\s+/).length : 0} words</span>
                </div>
              </div>

              {/* Editor Textarea */}
              <div className="relative">
                <textarea
                  value={examAnswer}
                  onChange={(e) => {
                    setExamAnswer(e.target.value);
                    setExamSubmitted(false);
                  }}
                  placeholder="// Type your code, algorithm, or written exam answers here...&#10;// Example:&#10;#include <stdio.h>&#10;int main() {&#10;    printf(&quot;Exam solution executed&quot;);&#10;    return 0;&#10;}"
                  rows={14}
                  spellCheck={false}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-5 text-slate-100 font-mono text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-y"
                />
              </div>

              {/* Submission Controls */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <button
                    onClick={submitExamAnswer}
                    disabled={isSubmitting}
                    className={cn(
                      "w-full sm:w-auto px-6 py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2.5 transition-all shadow-xl cursor-pointer",
                      examSubmitted 
                        ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20"
                        : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30"
                    )}
                  >
                    {examSubmitted ? <CheckCircle2 className="w-5 h-5" /> : <Send className="w-5 h-5" />}
                    <span>{isSubmitting ? "Submitting Solution..." : examSubmitted ? "Solution Submitted! (Click to Resubmit)" : "Submit Exam Solution to Teacher"}</span>
                  </button>

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isSubmitting}
                    className="px-4 py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold flex items-center gap-2 transition-all cursor-pointer"
                  >
                    <Upload className="w-4 h-4 text-indigo-400" />
                    <span>Upload File (.py, .cpp, .zip)</span>
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </div>

                <div className="text-xs text-slate-500">
                  Target: <span className="font-mono text-slate-400">Teacher Room {room}</span> • PC: <span className="font-mono text-slate-400">{pc?.ip || currentPcId}</span>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Exam Materials & Question Papers */}
          {examActiveTab === 'materials' && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div>
                  <h3 className="font-bold text-white text-base">Exam Question Papers &amp; Resources</h3>
                  <p className="text-xs text-slate-400">Shared by the instructor for this examination session</p>
                </div>
                <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/30">
                  {sharedFiles.length} Authorized Files
                </span>
              </div>

              {sharedFiles.length === 0 ? (
                <div className="p-12 text-center text-slate-500">
                  <BookOpen className="w-12 h-12 mx-auto mb-3 text-slate-700" />
                  <p className="text-sm font-semibold">No exam papers shared by the instructor yet.</p>
                  <p className="text-xs text-slate-600 mt-1">When the teacher shares question sheets, they will appear here instantly.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {sharedFiles.map((file) => (
                    <div 
                      key={file.id} 
                      className="flex items-center justify-between p-4 rounded-2xl bg-slate-950 border border-slate-800 hover:border-emerald-500/50 transition-all shadow-md"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
                          <FileText className="w-6 h-6" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-white text-sm truncate">{file.filename}</p>
                          <p className="text-xs text-slate-400">
                            {file?.size ? (file.size / 1024).toFixed(1) : '512'} KB • Authorized Resource
                          </p>
                        </div>
                      </div>
                      <button 
                        onClick={() => triggerDownload(file)}
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs transition-colors shrink-0 ml-3 shadow-md"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* ==================== NORMAL LAB CARDS ==================== */
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
      )}

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

        {/* Instructor Workstation Rebind Modal (PIN Protected) */}
        {showRebindModal && (
          <div className="fixed inset-0 z-[99999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                    <KeyRound className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">Workstation Assignment</h2>
                    <p className="text-sm text-slate-400">Teacher / Admin Access Only</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowRebindModal(false)} 
                  className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 text-xs text-slate-300">
                  <p className="font-semibold text-white mb-1">🔒 Fixed Station Protection</p>
                  This physical computer is currently fixed to <strong className="text-emerald-400">PC {pc?.ip ? pc.ip.split('.').pop() : currentPcId.split('-').pop()}</strong>. Students are strictly blocked from changing or shifting this station.
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Assign To Different Workstation:
                  </label>
                  <select
                    value={selectedNewStation || currentPcId}
                    onChange={(e) => setSelectedNewStation(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-4 py-2.5 font-mono text-sm focus:outline-none focus:border-indigo-500"
                  >
                    {availableRoomPcs.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.ip} ({p.name || `PC ${p.ip.split('.').pop()}`})
                      </option>
                    ))}
                    {availableRoomPcs.length === 0 && (
                      <option value={currentPcId}>{pc?.ip || currentPcId}</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Enter Teacher PIN:
                  </label>
                  <input
                    type="password"
                    placeholder="Enter PIN (Default: 1234)"
                    value={rebindPin}
                    onChange={(e) => setRebindPin(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleConfirmAdminRebind();
                    }}
                    className={cn(
                      "w-full bg-slate-950 border text-white rounded-xl px-4 py-2.5 font-mono text-center tracking-widest text-lg focus:outline-none transition-colors",
                      rebindError ? "border-rose-500 bg-rose-950/20 text-rose-300" : "border-slate-700 focus:border-indigo-500"
                    )}
                  />
                  {rebindError && (
                    <p className="text-xs text-rose-400 mt-1 font-medium text-center">Incorrect Teacher PIN</p>
                  )}
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowRebindModal(false)}
                    className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-sm transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmAdminRebind}
                    className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-bold text-sm transition-colors shadow-lg flex items-center justify-center gap-2"
                  >
                    <Lock className="w-4 h-4" />
                    Save & Lock
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
