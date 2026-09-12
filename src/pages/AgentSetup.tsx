import { Terminal, Copy, CheckCircle2, Server, Code2, Download, Play, RefreshCw, AlertTriangle, Monitor, Sparkles } from 'lucide-react';
import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

export default function AgentSetup() {
  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  
  // Dynamic settings for script generation
  const defaultUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/api/agent/ping` 
    : 'http://localhost:3000/api/agent/ping';
    
  const [serverUrl, setServerUrl] = useState(defaultUrl);
  const [roomNumber, setRoomNumber] = useState('809');
  const [pollInterval, setPollInterval] = useState('200');
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  const [scriptContent, setScriptContent] = useState<string>('# Loading LabMonitor Pro Agent Script from Server...');

  // Automatically fetch synchronized agent script directly from backend API
  useEffect(() => {
    const fetchScript = async () => {
      try {
        const query = new URLSearchParams({
          room: roomNumber.trim(),
          server: serverUrl.trim(),
          interval: pollInterval
        });
        const res = await fetch(`/api/agent/script?${query.toString()}`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.script) {
            setScriptContent(data.script);
            return;
          }
        }
        const textRes = await fetch(`/agent.ps1?${query.toString()}`);
        if (textRes.ok) {
          const text = await textRes.text();
          setScriptContent(text);
        }
      } catch {
        setScriptContent(`# LabMonitor Pro Agent\n$serverUrl = "${serverUrl}"\n$room = "${roomNumber}"\n`);
      }
    };
    fetchScript();
  }, [serverUrl, roomNumber, pollInterval]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(scriptContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadScript = () => {
    const blob = new Blob([scriptContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'agent.ps1';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 2000);
  };

  const downloadBatLauncher = () => {
    const params = new URLSearchParams({
      room: roomNumber,
      interval: pollInterval,
      server: serverUrl
    });
    window.location.href = `/install-agent.bat?${params.toString()}`;
  };

  const sendTestPing = async (customIp?: string) => {
    setTesting(true);
    setTestStatus(null);
    try {
      const targetIp = customIp || '192.168.0.12';
      const payload = {
        room: roomNumber,
        ip: targetIp,
        has_internet: true,
        cpu_usage: Math.floor(Math.random() * 25) + 15,
        ram_usage: 46,
        disk_usage: 48,
        software: [
          { name: 'Windows PowerShell', version: '5.1' },
          { name: 'Google Chrome', version: '122.0' },
          { name: 'Visual Studio Code', version: '1.87' }
        ]
      };

      const res = await fetch('/api/agent/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setTestStatus(`Success! Heartbeat registered for IP ${targetIp} in Room ${roomNumber}. Server responded: "${data.message || 'OK'}"`);
    } catch (e: any) {
      setTestStatus(`Failed to send test ping: ${e.message}. Check that the URL is correct and server is accessible.`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="max-w-4xl space-y-8 pb-8"
    >
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-900/40 via-slate-900 to-slate-900 border border-indigo-500/20 p-8 sm:p-10">
        <div className="absolute top-0 right-0 -mt-16 -mr-16 w-64 h-64 bg-indigo-500/20 blur-3xl rounded-full pointer-events-none" />
        <div className="relative z-10">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400 tracking-tight">
            Agent Setup & Deployment
          </h1>
          <p className="text-slate-400 mt-4 text-lg max-w-2xl leading-relaxed">
            Deploy this PowerShell script to any physical computer on your local network to make it an active student PC. The agent sends real-time hardware telemetry and automatically receives remote commands like shutdown, restart, and broadcast announcements.
          </p>
        </div>
      </div>

      {/* Live Browser Agent Card for Immediate Connection */}
      <div className="bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900 border border-emerald-500/30 rounded-3xl p-6 sm:p-8 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-semibold mb-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              Connected Machine Status
            </div>
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              PC 192.168.0.12 Active in Room 809
            </h3>
            <p className="text-sm text-slate-400 mt-1 max-w-xl">
              This machine is configured as an online workstation in Room 809. Click below to push an immediate hardware heartbeat update to the dashboard.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => sendTestPing('192.168.0.12')}
              disabled={testing}
              className="px-5 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-sm font-bold transition-all shadow-lg shadow-emerald-600/20 flex items-center gap-2"
            >
              <RefreshCw className={cn("w-4 h-4", testing && "animate-spin")} />
              {testing ? "Updating..." : "Push Heartbeat (192.168.0.12)"}
            </button>
          </div>
        </div>
        {testStatus && (
          <div className="mt-4 p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-sm text-emerald-300">
            {testStatus}
          </div>
        )}
      </div>

      {/* Script Configurator Card */}
      <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-indigo-400" />
          Configure Script Parameters
        </h2>
        <p className="text-sm text-slate-400">
          Adjust the parameters below. The script preview and download file will automatically update with your values!
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Server Ping URL</label>
            <input 
              type="text"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder="http://192.168.1.5:3000/api/agent/ping"
              className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-indigo-500"
            />
            <p className="text-[11px] text-slate-500">
              For another PC on the same Wi-Fi/LAN, use this PC's local IP (e.g. 192.168.x.x:3000).
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Lab Room Number</label>
            <input 
              type="text"
              value={roomNumber}
              onChange={(e) => setRoomNumber(e.target.value)}
              placeholder="809"
              className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-indigo-500"
            />
            <p className="text-[11px] text-slate-500">
              Matches the lab rooms displayed on the dashboard (801 to 810).
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Heartbeat Interval (Sec)</label>
            <input 
              type="number"
              min="5"
              max="600"
              value={pollInterval}
              onChange={(e) => setPollInterval(e.target.value)}
              className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-indigo-500"
            />
            <p className="text-[11px] text-slate-500">
              Heartbeat Interval configured: 200s (Default: 200s / 3.3 minutes).
            </p>
          </div>
        </div>

        {/* Live Test Ping Action */}
        <div className="pt-2 border-t border-slate-800/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-slate-300">Want to test the connection first?</p>
            <p className="text-xs text-slate-500">Simulate a ping right from this browser tab to verify server ingestion.</p>
          </div>
          <button
            onClick={sendTestPing}
            disabled={testing}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded-xl text-sm font-bold transition-all disabled:opacity-50"
          >
            <Play className="w-4 h-4" />
            {testing ? 'Simulating...' : 'Simulate Agent Ping Now'}
          </button>
        </div>

        {testStatus && (
          <div className={`p-4 rounded-xl text-sm ${testStatus.startsWith('Success') ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border border-rose-500/20 text-rose-400'}`}>
            {testStatus}
          </div>
        )}
      </div>

      {/* Script Code Viewer */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="bg-slate-900/80 backdrop-blur-xl border border-slate-800/50 rounded-3xl overflow-hidden shadow-2xl"
      >
        <div className="p-5 border-b border-slate-800/50 bg-slate-950/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-slate-300 font-mono text-sm font-medium">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
              <Code2 className="w-4 h-4 text-indigo-400" />
            </div>
            agent.ps1 (Configured for Room {roomNumber})
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={downloadBatLauncher}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-rose-600 to-indigo-600 hover:from-rose-500 hover:to-indigo-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-rose-900/30 transition-all hover:scale-105 active:scale-95"
              title="Download 1-click installer that auto-elevates as Admin"
            >
              <Download className="w-4 h-4" />
              Download 1-Click .BAT
            </button>
            <button
              onClick={copyToClipboard}
              className="flex items-center gap-2 px-3.5 py-2 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 rounded-xl text-sm font-bold transition-all hover:scale-105 active:scale-95"
            >
              {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied!' : 'Copy Script'}
            </button>
            <button
              onClick={downloadScript}
              className="flex items-center gap-2 px-3.5 py-2 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 rounded-xl text-sm font-bold transition-all hover:scale-105 active:scale-95"
            >
              {downloaded ? <CheckCircle2 className="w-4 h-4" /> : <Download className="w-4 h-4" />}
              {downloaded ? 'Downloaded!' : 'Download .ps1'}
            </button>
          </div>
        </div>
        <div className="p-6 overflow-x-auto bg-[#0d1117] max-h-[500px]">
          <pre className="text-sm font-mono text-emerald-400 leading-relaxed">
            <code>{scriptContent}</code>
          </pre>
        </div>
      </motion.div>

      {/* Workstation Freeze & Anti-Bypass Architecture Callout */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
        className="bg-gradient-to-r from-rose-950/40 via-slate-900 to-indigo-950/40 border border-rose-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden"
      >
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-bold uppercase tracking-wider">
              <AlertTriangle className="w-3.5 h-3.5" />
              Total Hardware Input Freeze Engine
            </div>
            <h3 className="text-xl font-bold text-white tracking-tight">
              Kernel-Level Workstation Lockdown & AI Suppression
            </h3>
            <p className="text-sm text-slate-300 max-w-3xl leading-relaxed">
              When the teacher activates <strong>Lock PC</strong> or <strong>Lock All</strong>, the agent invokes the Win32 <code className="text-rose-300 font-mono bg-rose-950/60 px-1.5 py-0.5 rounded">BlockInput</code> API, hides the Windows Taskbar on all monitors, and suppresses keyboard shortcuts. This prevents students from opening tabs, typing into AI assistants (ChatGPT, Claude, Gemini), or switching away from the lock screen.
            </p>
          </div>
          <div className="flex flex-col gap-2 shrink-0">
            <div className="px-4 py-2 bg-slate-900/90 border border-slate-700/80 rounded-xl text-xs font-medium text-slate-300 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              Physical Mouse & Keyboard: Blocked
            </div>
            <div className="px-4 py-2 bg-slate-900/90 border border-slate-700/80 rounded-xl text-xs font-medium text-slate-300 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              AI Tools & Browsers: Minimized
            </div>
            <div className="px-4 py-2 bg-slate-900/90 border border-slate-700/80 rounded-xl text-xs font-medium text-slate-300 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-500" />
              Taskbar & WinKey: Disabled
            </div>
          </div>
        </div>
      </motion.div>

      {/* Step by step deployment */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="bg-gradient-to-br from-indigo-900/20 to-slate-900 border border-indigo-500/20 rounded-3xl p-8 shadow-xl relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 blur-3xl rounded-full pointer-events-none" />
        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <Server className="w-5 h-5 text-indigo-400" />
          How to Test on Another PC (Without Full Deployment)
        </h3>
        <ol className="list-decimal list-inside space-y-4 text-slate-300 text-base leading-relaxed">
          <li>
            <strong>Connect both PCs to the same Wi-Fi or Local Network (LAN).</strong>
          </li>
          <li>
            <strong>Find your Server PC's IPv4 Address:</strong>
            <div className="mt-2 ml-6 p-3 bg-slate-950/70 rounded-xl border border-slate-800 text-sm">
              <p className="text-indigo-400 font-bold mb-1">On the Host / Server PC:</p>
              <p>1. Press <kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-white text-xs">Win + R</kbd>, type <code className="text-emerald-400 font-mono">cmd</code> and press Enter.</p>
              <p>2. Type <code className="text-emerald-400 font-mono">ipconfig</code> and look for your <strong>IPv4 Address</strong> (e.g. <code>192.168.1.10</code>).</p>
              <p>3. Enter <code>http://192.168.1.10:3000/api/agent/ping</code> in the Server Ping URL above.</p>
            </div>
          </li>
          <li>
            <strong>On the Student PC:</strong>
            <p className="mt-1 text-sm">
              Either click <strong className="text-rose-400">"Download 1-Click .BAT"</strong> above and run it on the student computer (it auto-elevates and launches the lock agent), OR download <code className="text-indigo-300 bg-indigo-500/20 px-2 py-0.5 rounded-md font-mono text-xs">agent.ps1</code>.
            </p>
          </li>
          <li>
            <strong>Execute with Administrator privileges:</strong>
            <p className="mt-1 text-sm">
              Double-click the downloaded <strong>.BAT</strong> file (click "Yes" on Windows UAC prompt), OR run PowerShell as Administrator:
            </p>
            <div className="mt-2 bg-black/80 p-3 rounded-xl font-mono text-xs text-emerald-300 border border-slate-800 overflow-x-auto select-all">
              <code>Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass; C:\LabAgent\agent.ps1</code>
            </div>
            <p className="text-xs text-slate-400 mt-2">
              The student PC will immediately appear in real-time under Room {roomNumber} in the <strong>Teacher Dashboard</strong>, and when locked, physical mouse and keyboard inputs will be completely blocked!
            </p>
          </li>
          <li className="mt-4 p-5 bg-slate-950/80 border border-emerald-500/30 rounded-2xl">
            <p className="text-emerald-400 font-bold text-base mb-2 flex items-center gap-2">
              ⚡ How to make it start automatically on PC Power On (Auto Boot):
            </p>
            <p className="text-slate-300 text-sm mb-3">
              To make it connect automatically on every boot without any student interaction, run this single scheduled task registration in PowerShell as Administrator:
            </p>
            <div className="bg-black/90 p-3 rounded-xl font-mono text-xs text-emerald-300 border border-slate-800 overflow-x-auto select-all">
              <code>{`$action = New-ScheduledTaskAction -Execute 'PowerShell.exe' -Argument '-ExecutionPolicy Bypass -WindowStyle Hidden -File "C:\\LabAgent\\agent.ps1"'
$trigger = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId "NT AUTHORITY\\SYSTEM" -LogonType ServiceAccount -RunLevel Highest
Register-ScheduledTask -TaskName "LabMonitorAgent" -Action $action -Trigger $trigger -Principal $principal -Force`}</code>
            </div>
          </li>
        </ol>
      </motion.div>
    </motion.div>
  );
}

