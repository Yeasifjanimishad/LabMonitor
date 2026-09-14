import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import nodemailer from 'nodemailer';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Generate 10 labs with 25 PCs each
  const generateMockData = () => {
    const labs = ['801', '802', '803', '804', '805', '806', '807', '808', '809', '810'];
    const pcs: any[] = [];
    const mockIssues: any[] = [];
    const mockSchedules: any = {};
    const mockSharedFiles: Record<string, any[]> = {};
    const mockCollectedFiles: Record<string, any[]> = {};

    // Add user's live physical PC (192.168.0.12) to Room 809
    pcs.unshift({
      id: '192-168-0-12',
      ip: '192.168.0.12',
      room: '809',
      status: 'online',
      cpu_usage: 12,
      ram_usage: 46,
      lastSeen: new Date().toISOString(),
      locked: false,
      exam_mode: false,
      needs_help: false,
      software: [
        { name: 'Windows PowerShell', version: '5.1' },
        { name: 'Google Chrome', version: '122.0' },
        { name: 'Visual Studio Code', version: '1.87' }
      ]
    });
    
    labs.forEach((room, labIndex) => {
      // Add a schedule for each lab
      mockSchedules[room] = {
        class: `Lab Course ${labIndex + 1}01`,
        teacher: `Dr. Teacher ${labIndex + 1}`,
        time: '10:00 AM - 1:00 PM'
      };

      // Add demo shared files (Teacher to Student)
      mockSharedFiles[room] = [
        { id: `sf-${room}-1`, filename: 'Lab_Manual_01.pdf', size: 2048576, shared_at: new Date(Date.now() - 3600000).toISOString() },
        { id: `sf-${room}-2`, filename: 'Starter_Code.zip', size: 512000, shared_at: new Date(Date.now() - 1800000).toISOString() }
      ];

      // Add demo collected files (Student to Teacher)
      mockCollectedFiles[room] = [
        { id: `cf-${room}-1`, pc_id: `192-168-${labIndex + 1}-15`, filename: 'Assignment_Final.zip', size: 1048576, submitted_at: new Date(Date.now() - 600000).toISOString() },
        { id: `cf-${room}-2`, pc_id: `192-168-${labIndex + 1}-22`, filename: 'Task_1.cpp', size: 15360, submitted_at: new Date(Date.now() - 300000).toISOString() }
      ];

      for (let i = 1; i <= 25; i++) {
        const ipLast = (labIndex + 1) * 10 + i;
        const ip = `192.168.${labIndex + 1}.${ipLast}`;
        const id = ip.replace(/\./g, '-');
        
        // Deterministic randomization based on PC index for stability
        const pcSeed = (labIndex * 25) + i;
        const isOffline = room === '809' ? true : (pcSeed % 15 === 0);
        const isIssue = room === '809' ? false : (pcSeed % 12 === 0 && !isOffline);
        const isLocked = room === '809' ? false : (pcSeed % 10 === 0 && !isOffline);
        const isExam = room === '809' ? false : (pcSeed % 8 === 0 && !isOffline);
        const needsHelp = room === '809' ? false : (pcSeed % 7 === 0 && !isOffline && !isLocked);

        let status = isOffline ? 'offline' : 'online';
        let cpu_usage = isOffline ? 0 : (Math.floor(Math.random() * 30) + 5);
        let ram_usage = isOffline ? 0 : (Math.floor(Math.random() * 40) + 20);
        let lastSeen = isOffline ? new Date(Date.now() - 3600000).toISOString() : new Date().toISOString();
        
        if (isIssue) {
          status = 'issue';
          cpu_usage = Math.floor(Math.random() * 20) + 80;
          ram_usage = Math.floor(Math.random() * 20) + 80;
          
          mockIssues.push({
            id: `iss-${id}`,
            pc_id: id,
            description: 'High resource usage detected or hardware issue',
            status: 'open',
            created_at: new Date(Date.now() - Math.floor(Math.random() * 10000000)).toISOString()
          });
        }

        pcs.push({
          id,
          ip,
          room,
          status,
          cpu_usage,
          ram_usage,
          lastSeen,
          locked: isLocked,
          exam_mode: isExam,
          needs_help: needsHelp,
          software: [
            {name: 'Google Chrome', version: '120.0'}, 
            {name: 'Visual Studio Code', version: '1.85'}
          ]
        });
      }
    });
    
    const mockTasks: any[] = [
      {
        id: 'task-101',
        pc_id: 'ALL',
        action: 'install_software',
        target: 'Google Chrome',
        status: 'completed',
        created_at: new Date(Date.now() - 7200000).toISOString()
      },
      {
        id: 'task-102',
        pc_id: '192-168-1-15',
        action: 'install_software',
        target: 'Visual Studio Code',
        status: 'completed',
        created_at: new Date(Date.now() - 3600000).toISOString()
      },
      {
        id: 'task-103',
        pc_id: '192-168-1-20',
        action: 'restart',
        target: 'RESTART',
        status: 'completed',
        created_at: new Date(Date.now() - 1800000).toISOString()
      }
    ];

    return { pcs, mockIssues, mockSchedules, mockSharedFiles, mockCollectedFiles, mockTasks };
  };

  let initialData = generateMockData();
  let connectedPCs: any[] = initialData.pcs;
  let issues: any[] = initialData.mockIssues;
  let schedules: any = initialData.mockSchedules;
  let tasks: any[] = [...initialData.mockTasks];
  let sharedFiles: Record<string, any[]> = initialData.mockSharedFiles;
  let collectedFiles: Record<string, any[]> = initialData.mockCollectedFiles;
  const labStates: Record<string, { locked: boolean; exam_mode: boolean }> = {
    '809': { locked: false, exam_mode: false }
  };

  // API to serve the raw agent.ps1 script directly for curl/irm execution
  const buildAgentScript = (fullServerUrl: string, roomNumber: string, intervalSeconds: string | number = 3) => {
    return `# =========================================================
# LabMonitor Pro - Real-Time Autonomous Windows Lab Agent
# Total Workstation Lockdown & Hardware Freeze Engine
# =========================================================
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$serverUrl = "${fullServerUrl}"
$roomNumber = "${roomNumber}"
$intervalSeconds = ${intervalSeconds}

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  LabMonitor Pro Agent Initialized" -ForegroundColor Green
Write-Host "  Room: $roomNumber | Server: $serverUrl" -ForegroundColor Yellow
Write-Host "==================================================" -ForegroundColor Cyan

# Auto-Elevation Check: Prompt for Administrator if not elevated so physical BlockInput, Firewall & Enterprise Policies work 100%
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "-> Elevating process to Administrator for Kernel-Level Hardware Freeze & Firewall AI Blocking..." -ForegroundColor Yellow
    if ($PSCommandPath) {
        Start-Process powershell.exe -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File '$PSCommandPath'"
        exit
    } else {
        $rawUrl = "$serverUrl".Replace("/api/agent/ping", "/agent.ps1?room=$roomNumber&interval=$intervalSeconds")
        $elevateCmd = "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; iex ((New-Object System.Net.WebClient).DownloadString('$rawUrl'))"
        Start-Process powershell.exe -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -Command $elevateCmd"
        exit
    }
} else {
    Write-Host "[OK] Administrator privileges verified: Hardware Input Freeze, Firewall & Browser Policies active." -ForegroundColor Green
}

# Load Win32 API Definitions for Hardware Freeze & Window Control
if (-not ([System.Management.Automation.PSTypeName]'Win32Lock').Type) {
    Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public class Win32Lock {
    [DllImport("user32.dll")]
    public static extern bool BlockInput(bool fBlockIt);

    [DllImport("user32.dll")]
    public static extern IntPtr FindWindow(string lpClassName, string lpWindowName);

    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);

    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    public static extern bool PostMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);

    [DllImport("wininet.dll", SetLastError = true)]
    public static extern bool InternetSetOption(IntPtr hInternet, int dwOption, IntPtr lpBuffer, int dwBufferLength);
}
"@
}

try {
    Add-Type -AssemblyName System.Windows.Forms -ErrorAction SilentlyContinue
} catch {}

$global:LockProcess = $null
$global:IsLocked = $false
$global:ExamModeActive = $false
$global:StationIp = ""
$global:ExamBlockedIps = @()

# Exam Mode AI & Search Engine Host Domain Blocklist
$global:ExamBlockedDomains = @(
    "chatgpt.com", "www.chatgpt.com", "chat.openai.com", "api.openai.com", "openai.com", "platform.openai.com",
    "oaistatic.com", "cdn.oaistatic.com", "oaiusercontent.com", "auth0.openai.com",
    "claude.ai", "www.claude.ai", "anthropic.com", "api.anthropic.com",
    "gemini.google.com", "bard.google.com", "generativelanguage.googleapis.com", "ai.google.dev",
    "copilot.microsoft.com", "edgeservices.bing.com", "sydney.bing.com", "copilot.com", "www.copilot.com",
    "perplexity.ai", "www.perplexity.ai",
    "deepseek.com", "www.deepseek.com", "chat.deepseek.com", "api.deepseek.com",
    "poe.com", "www.poe.com",
    "character.ai", "www.character.ai",
    "huggingface.co", "chat.huggingface.co",
    "mistral.ai", "chat.mistral.ai",
    "blackbox.ai", "www.blackbox.ai",
    "cohere.com", "www.cohere.com",
    "grok.com", "www.grok.com", "x.ai", "api.x.ai",
    "google.com", "www.google.com", "google.com.bd", "www.google.com.bd", "encrypted.google.com",
    "bing.com", "www.bing.com",
    "duckduckgo.com", "www.duckduckgo.com",
    "yahoo.com", "search.yahoo.com",
    "yandex.com", "www.yandex.com",
    "baidu.com", "www.baidu.com"
)

function Check-ExamWatchdog {
    if (-not $global:ExamModeActive) { return }

    $aiRegex = "(ChatGPT|OpenAI|Claude|Gemini|Copilot|Perplexity|DeepSeek|Google|Bing|DuckDuckGo|Baidu|Yahoo|Blackbox|Poe|Mistral|Grok|গুগল|Search|New Tab|New tab|নতুন ট্যাব)"

    # 1. Terminate any dedicated desktop AI apps
    try {
        Get-Process -Name "chatgpt", "claude", "copilot", "perplexity", "deepseek" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    } catch {}

    # 2. Window Title Scan: terminate any window or tab accessing prohibited AI or Search
    try {
        $violatingProcs = Get-Process | Where-Object { 
            $_.MainWindowTitle -and ($_.MainWindowTitle -match $aiRegex) 
        }

        foreach ($p in $violatingProcs) {
            $title = $p.MainWindowTitle
            $procName = $p.ProcessName.ToLower()
            Write-Host " [!] EXAM VIOLATION INTERCEPTED: $procName ('$title')" -ForegroundColor Red
            
            # Sound hardware alarm
            try { [System.Console]::Beep(1800, 400) } catch {}

            # Immediately terminate the entire browser process so all tabs close
            Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
            Stop-Process -Name $procName -Force -ErrorAction SilentlyContinue

            # Report violation directly to Teacher Dashboard
            try {
                $targetId = if ($global:StationIp) { $global:StationIp.Replace('.', '-') } else { 'unknown' }
                $violationPayload = @{
                    message = "🚨 PROHIBITED ACCESS DETECTED: Student opened '$title' ($procName) - Browser instantly KILLED by Exam Watchdog!"
                } | ConvertTo-Json
                $vioUrl = $serverUrl.Replace("/agent/ping", "/pcs/$targetId/violation")
                Invoke-RestMethod -Uri $vioUrl -Method Post -Body $violationPayload -ContentType "application/json" -TimeoutSec 2 -ErrorAction SilentlyContinue
            } catch {}
        }
    } catch {}

    # 3. Active TCP Connection Scan: Detect connection to AI IPs at socket layer
    try {
        if ($global:ExamBlockedIps -and $global:ExamBlockedIps.Count -gt 0) {
            $activeConns = Get-NetTCPConnection -State Established, SynSent -ErrorAction SilentlyContinue | Where-Object {
                $global:ExamBlockedIps -contains $_.RemoteAddress
            }
            foreach ($conn in $activeConns) {
                if ($conn.OwningProcess -gt 4) {
                    Write-Host " [!] Active TCP socket to prohibited AI IP ($($conn.RemoteAddress)) on PID $($conn.OwningProcess) - Terminating..." -ForegroundColor Red
                    try { [System.Console]::Beep(1800, 300) } catch {}
                    Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
                }
            }
        }
    } catch {}
}

function Enable-ExamMode {
    if ($global:ExamModeActive) { return }
    $global:ExamModeActive = $true
    Write-Host "==================================================" -ForegroundColor Red
    Write-Host " [!] ACTIVATING EXAM MODE: HARD-BLOCKING AI & SEARCH" -ForegroundColor Red
    Write-Host "==================================================" -ForegroundColor Red

    # 0. Windows System Internet Proxy Blackhole (Forces all browsers to route unauthorized traffic to dead sinkhole)
    try {
        $serverHost = if ($serverUrl -match 'https?://([^/:]+)') { $matches[1] } else { "*.run.app" }
        $bypassList = "<local>;localhost;127.0.0.1;192.168.*;10.*;172.16.*;172.17.*;172.18.*;172.19.*;172.20.*;172.21.*;172.22.*;172.23.*;172.24.*;172.25.*;172.26.*;172.27.*;172.28.*;172.29.*;172.30.*;172.31.*;*.run.app;$serverHost"

        $proxyRegPaths = @(
            "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings",
            "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Internet Settings"
        )
        Get-ChildItem "Registry::HKEY_USERS" -ErrorAction SilentlyContinue | Where-Object { $_.Name -match "S-1-5-21-" -and $_.Name -notmatch "_Classes" } | ForEach-Object {
            $proxyRegPaths += "Registry::$($_.Name)\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings"
        }

        foreach ($p in $proxyRegPaths) {
            try {
                if (-not (Test-Path $p)) { New-Item -Path $p -Force -ErrorAction SilentlyContinue | Out-Null }
                Set-ItemProperty -Path $p -Name "ProxyEnable" -Value 1 -Type DWord -Force -ErrorAction SilentlyContinue
                Set-ItemProperty -Path $p -Name "ProxyServer" -Value "127.0.0.1:9999" -Type String -Force -ErrorAction SilentlyContinue
                Set-ItemProperty -Path $p -Name "ProxyOverride" -Value $bypassList -Type String -Force -ErrorAction SilentlyContinue
            } catch {}
        }

        # Instantly propagate to all running browsers (Chrome, Edge, etc.)
        try {
            [Win32Lock]::InternetSetOption([IntPtr]::Zero, 39, [IntPtr]::Zero, 0) | Out-Null
            [Win32Lock]::InternetSetOption([IntPtr]::Zero, 37, [IntPtr]::Zero, 0) | Out-Null
        } catch {}
        Write-Host "[OK] Windows Internet Proxy Blackhole activated: all unauthorized traffic trapped in dead sinkhole." -ForegroundColor Green
    } catch {
        Write-Host "[!] Error setting proxy: $_" -ForegroundColor DarkYellow
    }

    # 1. Resolve REAL external IP addresses of AI providers using .NET DNS resolver BEFORE modifying hosts file!
    $realAiIps = @()
    $dnsTargets = @(
        "chatgpt.com", "chat.openai.com", "api.openai.com", "cdn.oaistatic.com", "oaistatic.com", "oaiusercontent.com",
        "claude.ai", "api.anthropic.com", "gemini.google.com", "deepseek.com", "perplexity.ai",
        "google.com", "www.google.com", "bing.com", "copilot.microsoft.com"
    )
    foreach ($target in $dnsTargets) {
        try {
            $ips = [System.Net.Dns]::GetHostAddresses($target) | ForEach-Object { $_.IPAddressToString }
            if ($ips) { $realAiIps += $ips }
        } catch {}
    }
    $global:ExamBlockedIps = $realAiIps | Select-Object -Unique

    # 2. Windows Defender Firewall Outbound Block Rule (Blocks packets at network kernel)
    try {
        Remove-NetFirewallRule -DisplayName "LabMonitor-Exam-AI-Block" -ErrorAction SilentlyContinue | Out-Null
        Remove-NetFirewallRule -DisplayName "LabMonitor-Exam-AI-QUIC" -ErrorAction SilentlyContinue | Out-Null

        # Block QUIC UDP port 443 so browsers cannot bypass DNS or Enterprise policies
        New-NetFirewallRule -DisplayName "LabMonitor-Exam-AI-QUIC" -Direction Outbound -Action Block -Protocol UDP -RemotePort 443 -Enabled True -Profile Any -ErrorAction SilentlyContinue | Out-Null

        if ($global:ExamBlockedIps -and $global:ExamBlockedIps.Count -gt 0) {
            New-NetFirewallRule -DisplayName "LabMonitor-Exam-AI-Block" -Direction Outbound -Action Block -RemoteAddress $global:ExamBlockedIps -Enabled True -Profile Any -ErrorAction SilentlyContinue | Out-Null
            Write-Host "[OK] Windows Firewall kernel block rule active on $($global:ExamBlockedIps.Count) AI & Search IPs." -ForegroundColor Green
        }
    } catch {
        Write-Host "[!] Firewall rule notice: $_" -ForegroundColor DarkYellow
    }

    # 3. Browser Enterprise Policy: Strict URLBlocklist & URLAllowlist (Chrome & Edge)
    try {
        $blockRules = @(
            "google.com",
            "*.google.com",
            "*://*.google.com/*",
            "*://google.com/*",
            "google.com.bd",
            "*.google.com.bd",
            "*://*.google.com.bd/*",
            "chatgpt.com",
            "*.chatgpt.com",
            "*://*.chatgpt.com/*",
            "openai.com",
            "*.openai.com",
            "*://*.openai.com/*",
            "claude.ai",
            "*.claude.ai",
            "*://*.claude.ai/*",
            "anthropic.com",
            "*.anthropic.com",
            "gemini.google.com",
            "*.gemini.google.com",
            "bard.google.com",
            "*.bard.google.com",
            "perplexity.ai",
            "*.perplexity.ai",
            "*://*.perplexity.ai/*",
            "deepseek.com",
            "*.deepseek.com",
            "*://*.deepseek.com/*",
            "copilot.microsoft.com",
            "*.copilot.microsoft.com",
            "copilot.com",
            "*.copilot.com",
            "bing.com",
            "*.bing.com",
            "*://*.bing.com/*",
            "duckduckgo.com",
            "*.duckduckgo.com",
            "poe.com",
            "*.poe.com",
            "blackbox.ai",
            "*.blackbox.ai",
            "huggingface.co",
            "*.huggingface.co",
            "mistral.ai",
            "*.mistral.ai",
            "grok.com",
            "*.grok.com",
            "ai.google.dev",
            "cohere.com",
            "*.cohere.com"
        )

        $allowRules = @(
            "http://localhost:*",
            "https://localhost:*",
            "http://127.0.0.1:*",
            "https://127.0.0.1:*",
            "http://192.168.*",
            "https://192.168.*",
            "http://10.*",
            "https://10.*",
            "*.run.app",
            "https://ais-*.run.app"
        )

        $policyPaths = @(
            "HKLM:\\SOFTWARE\\Policies\\Google\\Chrome",
            "HKCU:\\Software\\Policies\\Google\\Chrome",
            "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Edge",
            "HKCU:\\Software\\Policies\\Microsoft\\Edge"
        )

        foreach ($basePath in $policyPaths) {
            try {
                if (-not (Test-Path $basePath)) { New-Item -Path $basePath -Force -ErrorAction SilentlyContinue | Out-Null }
                # Force browser to use OS DNS (so hosts file works) & disable DoH
                Set-ItemProperty -Path $basePath -Name "DnsOverHttpsMode" -Value "off" -Force -ErrorAction SilentlyContinue
                Set-ItemProperty -Path $basePath -Name "BuiltInDnsClientEnabled" -Value 0 -Type DWord -Force -ErrorAction SilentlyContinue
                # Disable Incognito so student cannot open incognito window to bypass
                Set-ItemProperty -Path $basePath -Name "IncognitoModeAvailability" -Value 1 -Type DWord -Force -ErrorAction SilentlyContinue
                # Disable F12 Developer Tools
                Set-ItemProperty -Path $basePath -Name "DeveloperToolsAvailability" -Value 2 -Type DWord -Force -ErrorAction SilentlyContinue

                # Enforce URLBlocklist
                $urlListPath = "$basePath\\URLBlocklist"
                if (Test-Path $urlListPath) { Remove-Item -Path $urlListPath -Recurse -Force -ErrorAction SilentlyContinue }
                New-Item -Path $urlListPath -Force -ErrorAction SilentlyContinue | Out-Null

                $i = 1
                foreach ($rule in $blockRules) {
                    Set-ItemProperty -Path $urlListPath -Name "$i" -Value $rule -Force -ErrorAction SilentlyContinue
                    $i++
                }

                # Enforce URLAllowlist
                $allowListPath = "$basePath\\URLAllowlist"
                if (Test-Path $allowListPath) { Remove-Item -Path $allowListPath -Recurse -Force -ErrorAction SilentlyContinue }
                New-Item -Path $allowListPath -Force -ErrorAction SilentlyContinue | Out-Null

                $j = 1
                foreach ($rule in $allowRules) {
                    Set-ItemProperty -Path $allowListPath -Name "$j" -Value $rule -Force -ErrorAction SilentlyContinue
                    $j++
                }
            } catch {}
        }
        Write-Host "[OK] Browser URLBlocklist & URLAllowlist policies enforced (Incognito & DevTools disabled)." -ForegroundColor Green
    } catch {
        Write-Host "[!] Error configuring browser policies: $_" -ForegroundColor DarkYellow
    }

    # 4. Windows hosts file redirect to 127.0.0.1 & 0.0.0.0
    try {
        $hostsPath = "$env:SystemRoot\\System32\\drivers\\etc\\hosts"
        $hostsBackup = "$env:SystemRoot\\System32\\drivers\\etc\\hosts.exam.bak"
        if (-not (Test-Path $hostsBackup)) {
            Copy-Item -Path $hostsPath -Destination $hostsBackup -Force -ErrorAction SilentlyContinue
        }

        $existingContent = Get-Content -Path $hostsPath -Raw -ErrorAction SilentlyContinue
        $sb = [System.Text.StringBuilder]::new()
        $sb.AppendLine($existingContent.TrimEnd())
        $sb.AppendLine("\`r\`n# --- LAB MONITOR EXAM MODE AI/SEARCH BLOCKLIST START ---")
        foreach ($domain in $global:ExamBlockedDomains) {
            $sb.AppendLine("127.0.0.1 $domain")
            $sb.AppendLine("0.0.0.0 $domain")
            $sb.AppendLine("::1 $domain")
        }
        $sb.AppendLine("# --- LAB MONITOR EXAM MODE AI/SEARCH BLOCKLIST END ---")

        [System.IO.File]::WriteAllText($hostsPath, $sb.ToString(), [System.Text.Encoding]::ASCII)
        ipconfig /flushdns | Out-Null
        Clear-DnsClientCache -ErrorAction SilentlyContinue | Out-Null
        Write-Host "[OK] Hosts blocklist activated & DNS flushed." -ForegroundColor Green
    } catch {
        Write-Host "[!] Error applying hosts blocklist: $_" -ForegroundColor DarkRed
    }

    # 5. Restart Browsers so enterprise registry policies and DNS changes load immediately
    try {
        Write-Host "-> Restarting browsers so new Enterprise URLBlocklist policies load immediately..." -ForegroundColor Yellow
        Get-Process -Name chrome, msedge, firefox, opera, brave -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    } catch {}

    # 6. Show Notification to Student
    try {
        Start-Process powershell -ArgumentList "-WindowStyle Hidden -Command ""Add-Type -AssemblyName PresentationFramework; [System.Windows.MessageBox]::Show('Exam Mode is now ACTIVE on this workstation.\`n\`nAI Tools (ChatGPT, Claude, Gemini, DeepSeek, Copilot) and Search Engines (Google, Bing) have been completely blocked.\`n\`nAny attempt to access AI tools will sound an alarm and report a violation to the Instructor.', 'Lab Administrator - Exam Mode Active', 'OK', 'Warning')"""
    } catch {}

    Write-Host "[OK] Workstation is in EXAM LOCKDOWN. AI & Google access blocked." -ForegroundColor Green
}

function Disable-ExamMode {
    if (-not $global:ExamModeActive) { return }
    $global:ExamModeActive = $false
    Write-Host "==================================================" -ForegroundColor Green
    Write-Host " [OK] DEACTIVATING EXAM MODE: RESTORING ACCESS" -ForegroundColor Green
    Write-Host "==================================================" -ForegroundColor Green

    # 0. Restore Windows System Internet Proxy to normal
    try {
        $proxyRegPaths = @(
            "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings",
            "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Internet Settings"
        )
        Get-ChildItem "Registry::HKEY_USERS" -ErrorAction SilentlyContinue | Where-Object { $_.Name -match "S-1-5-21-" -and $_.Name -notmatch "_Classes" } | ForEach-Object {
            $proxyRegPaths += "Registry::$($_.Name)\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings"
        }

        foreach ($p in $proxyRegPaths) {
            try {
                if (Test-Path $p) {
                    Set-ItemProperty -Path $p -Name "ProxyEnable" -Value 0 -Type DWord -Force -ErrorAction SilentlyContinue
                }
            } catch {}
        }

        try {
            [Win32Lock]::InternetSetOption([IntPtr]::Zero, 39, [IntPtr]::Zero, 0) | Out-Null
            [Win32Lock]::InternetSetOption([IntPtr]::Zero, 37, [IntPtr]::Zero, 0) | Out-Null
        } catch {}
        Write-Host "[OK] Windows Internet Proxy restored to normal." -ForegroundColor Green
    } catch {}

    # 1. Clean Browser URLBlocklist and URLAllowlist policies
    $policyPaths = @(
        "HKLM:\\SOFTWARE\\Policies\\Google\\Chrome",
        "HKCU:\\Software\\Policies\\Google\\Chrome",
        "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Edge",
        "HKCU:\\Software\\Policies\\Microsoft\\Edge"
    )
    foreach ($basePath in $policyPaths) {
        try {
            Remove-Item -Path "$basePath\\URLBlocklist" -Recurse -Force -ErrorAction SilentlyContinue
            Remove-Item -Path "$basePath\\URLAllowlist" -Recurse -Force -ErrorAction SilentlyContinue
            Remove-ItemProperty -Path $basePath -Name "IncognitoModeAvailability" -Force -ErrorAction SilentlyContinue
            Remove-ItemProperty -Path $basePath -Name "DeveloperToolsAvailability" -Force -ErrorAction SilentlyContinue
            Remove-ItemProperty -Path $basePath -Name "DnsOverHttpsMode" -Force -ErrorAction SilentlyContinue
            Remove-ItemProperty -Path $basePath -Name "BuiltInDnsClientEnabled" -Force -ErrorAction SilentlyContinue
        } catch {}
    }

    # 2. Remove Windows Firewall rules
    try {
        Remove-NetFirewallRule -DisplayName "LabMonitor-Exam-AI-Block" -ErrorAction SilentlyContinue | Out-Null
        Remove-NetFirewallRule -DisplayName "LabMonitor-Exam-AI-QUIC" -ErrorAction SilentlyContinue | Out-Null
    } catch {}

    # 3. Restore original hosts file
    try {
        $hostsPath = "$env:SystemRoot\\System32\\drivers\\etc\\hosts"
        $hostsBackup = "$env:SystemRoot\\System32\\drivers\\etc\\hosts.exam.bak"

        if (Test-Path $hostsBackup) {
            Copy-Item -Path $hostsBackup -Destination $hostsPath -Force -ErrorAction SilentlyContinue
            Remove-Item -Path $hostsBackup -Force -ErrorAction SilentlyContinue
        } else {
            $content = Get-Content -Path $hostsPath -ErrorAction SilentlyContinue
            $filtered = @()
            $skip = $false
            foreach ($line in $content) {
                if ($line -like "*LAB MONITOR EXAM MODE AI/SEARCH BLOCKLIST START*") { $skip = $true; continue }
                if ($line -like "*LAB MONITOR EXAM MODE AI/SEARCH BLOCKLIST END*") { $skip = $false; continue }
                if (-not $skip) { $filtered += $line }
            }
            [System.IO.File]::WriteAllLines($hostsPath, $filtered, [System.Text.Encoding]::ASCII)
        }

        ipconfig /flushdns | Out-Null
        Clear-DnsClientCache -ErrorAction SilentlyContinue | Out-Null
        Write-Host "[OK] Hosts blocklist removed & DNS cache flushed." -ForegroundColor Green
    } catch {
        Write-Host "[!] Error restoring hosts file: $_" -ForegroundColor DarkRed
    }

    # 4. Show notification to student
    try {
        Start-Process powershell -ArgumentList "-WindowStyle Hidden -Command ""Add-Type -AssemblyName PresentationFramework; [System.Windows.MessageBox]::Show('Exam Mode has been concluded.\`n\`nStandard Internet & AI access is now restored.', 'Lab Administrator - Exam Concluded', 'OK', 'Information')"""
    } catch {}

    Write-Host "[OK] Station access fully restored." -ForegroundColor Green
}

function Start-LockOverlay {
    param([string]$Room, [string]$StationIp)

    $global:IsLocked = $true
    
    # 1. Hardware-Level Freeze: Block all physical mouse clicks and keyboard typing
    try {
        [Win32Lock]::BlockInput($true) | Out-Null
    } catch {}

    # 2. Disable Task Manager and Windows Key shortcuts
    try {
        if (-not (Test-Path "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\System")) {
            New-Item -Path "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\System" -Force | Out-Null
        }
        Set-ItemProperty -Path "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\System" -Name "DisableTaskMgr" -Value 1 -Force -ErrorAction SilentlyContinue

        if (-not (Test-Path "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\Explorer")) {
            New-Item -Path "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\Explorer" -Force | Out-Null
        }
        Set-ItemProperty -Path "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\Explorer" -Name "NoWinKeys" -Value 1 -Force -ErrorAction SilentlyContinue
    } catch {}

    # 3. Hide the Windows Taskbar and Start Menu (Primary & Secondary monitors)
    try {
        $tray = [Win32Lock]::FindWindow("Shell_TrayWnd", $null)
        if ($tray -ne [IntPtr]::Zero) { [Win32Lock]::ShowWindow($tray, 0) | Out-Null }
        $secTray = [Win32Lock]::FindWindow("Shell_SecondaryTrayWnd", $null)
        if ($secTray -ne [IntPtr]::Zero) { [Win32Lock]::ShowWindow($secTray, 0) | Out-Null }
    } catch {}

    # 4. Minimize all background applications, AI tools, and browsers
    try {
        (New-Object -ComObject Shell.Application).MinimizeAll()
    } catch {}

    # 5. If fullscreen lock curtain process is already running, re-assert and return
    if ($global:LockProcess -and -not $global:LockProcess.HasExited) {
        return
    }

    Write-Host "-> ENFORCING HARDWARE FREEZE & LOCK CURTAIN ON WORKSTATION..." -ForegroundColor Red

    # Launch dedicated fullscreen lock curtain process spanning all monitors
    $lockScript = @'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

if (-not ([System.Management.Automation.PSTypeName]'CurtainWin32').Type) {
    Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public class CurtainWin32 {
    [DllImport("user32.dll")]
    public static extern bool BlockInput(bool fBlockIt);

    [DllImport("user32.dll")]
    public static extern IntPtr FindWindow(string lpClassName, string lpWindowName);

    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);
}
"@
}

$form = New-Object System.Windows.Forms.Form
$form.Text = "LabMonitor Station Lock Curtain"
$form.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::None
$form.WindowState = [System.Windows.Forms.FormWindowState]::Normal
$form.TopMost = $true
$form.StartPosition = [System.Windows.Forms.FormStartPosition]::Manual

$allBounds = [System.Drawing.Rectangle]::Empty
foreach ($screen in [System.Windows.Forms.Screen]::AllScreens) {
    $allBounds = [System.Drawing.Rectangle]::Union($allBounds, $screen.Bounds)
}
$form.Bounds = $allBounds
$form.BackColor = [System.Drawing.Color]::FromArgb(10, 15, 28)
$form.ShowInTaskbar = $false
$form.KeyPreview = $true

$pnl = New-Object System.Windows.Forms.Panel
$pnl.Dock = [System.Windows.Forms.DockStyle]::Fill
$form.Controls.Add($pnl)

$lblIcon = New-Object System.Windows.Forms.Label
$lblIcon.Text = [char]0xD83D + [char]0xDD12
$lblIcon.Font = New-Object System.Drawing.Font("Segoe UI Emoji", 70, [System.Drawing.FontStyle]::Bold)
$lblIcon.ForeColor = [System.Drawing.Color]::FromArgb(244, 63, 94)
$lblIcon.TextAlign = [System.Drawing.ContentAlignment]::MiddleCenter
$lblIcon.Dock = [System.Windows.Forms.DockStyle]::Top
$lblIcon.Height = 160
$pnl.Controls.Add($lblIcon)

$lblTitle = New-Object System.Windows.Forms.Label
$lblTitle.Text = "WORKSTATION & INPUT FROZEN"
$lblTitle.Font = New-Object System.Drawing.Font("Segoe UI", 36, [System.Drawing.FontStyle]::Bold)
$lblTitle.ForeColor = [System.Drawing.Color]::White
$lblTitle.TextAlign = [System.Drawing.ContentAlignment]::MiddleCenter
$lblTitle.Dock = [System.Windows.Forms.DockStyle]::Top
$lblTitle.Height = 80
$pnl.Controls.Add($lblTitle)

$lblSub = New-Object System.Windows.Forms.Label
$lblSub.Text = "Hardware mouse, keyboard, and application access are locked by the Instructor." + [Environment]::NewLine + "AI tools, browsers, and background apps are completely disabled." + [Environment]::NewLine + "Please direct your attention to the teacher."
$lblSub.Font = New-Object System.Drawing.Font("Segoe UI", 16, [System.Drawing.FontStyle]::Regular)
$lblSub.ForeColor = [System.Drawing.Color]::FromArgb(203, 213, 225)
$lblSub.TextAlign = [System.Drawing.ContentAlignment]::MiddleCenter
$lblSub.Dock = [System.Windows.Forms.DockStyle]::Top
$lblSub.Height = 110
$pnl.Controls.Add($lblSub)

# Prevent closing via Alt+F4
$form.Add_FormClosing({
    param($s, $e)
    $e.Cancel = $true
})

# Suppress all keypresses
$form.Add_KeyDown({
    param($s, $e)
    $e.Handled = $true
    $e.SuppressKeyPress = $true
})

# Confine mouse cursor to prevent clicking anything
try {
    [System.Windows.Forms.Cursor]::Clip = New-Object System.Drawing.Rectangle(0, 0, 1, 1)
} catch {}

# High-frequency watchdog timer (every 100ms) to maintain total freeze
$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 100
$timer.Add_Tick({
    try {
        [CurtainWin32]::BlockInput($true) | Out-Null
    } catch {}
    
    $tray = [CurtainWin32]::FindWindow("Shell_TrayWnd", $null)
    if ($tray -ne [IntPtr]::Zero) { [CurtainWin32]::ShowWindow($tray, 0) | Out-Null }
    
    $secTray = [CurtainWin32]::FindWindow("Shell_SecondaryTrayWnd", $null)
    if ($secTray -ne [IntPtr]::Zero) { [CurtainWin32]::ShowWindow($secTray, 0) | Out-Null }

    $form.TopMost = $true
    [CurtainWin32]::SetForegroundWindow($form.Handle) | Out-Null
    [CurtainWin32]::SetWindowPos($form.Handle, [IntPtr](-1), $allBounds.X, $allBounds.Y, $allBounds.Width, $allBounds.Height, 0x0040) | Out-Null
})
$timer.Start()

[System.Windows.Forms.Application]::Run($form)
'@

    $encoded = [Convert]::ToBase64String([System.Text.Encoding]::Unicode.GetBytes($lockScript))
    $global:LockProcess = Start-Process powershell -ArgumentList "-STA -NoProfile -ExecutionPolicy Bypass -EncodedCommand $encoded" -PassThru
}

function Stop-LockOverlay {
    Write-Host "-> RELEASING WORKSTATION FREEZE & RESTORING ACCESS..." -ForegroundColor Green
    $global:IsLocked = $false

    # 1. Unfreeze hardware input immediately
    try {
        [Win32Lock]::BlockInput($false) | Out-Null
    } catch {}

    # 2. Kill lock curtain process
    if ($global:LockProcess -and -not $global:LockProcess.HasExited) {
        try {
            Stop-Process -Id $global:LockProcess.Id -Force -ErrorAction SilentlyContinue
        } catch {}
        $global:LockProcess = $null
    }
    
    # 3. Re-enable Task Manager and Windows Key shortcuts
    try {
        Set-ItemProperty -Path "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\System" -Name "DisableTaskMgr" -Value 0 -Force -ErrorAction SilentlyContinue
        Set-ItemProperty -Path "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\Explorer" -Name "NoWinKeys" -Value 0 -Force -ErrorAction SilentlyContinue
    } catch {}

    # 4. Restore the Windows Taskbar on all monitors
    try {
        $tray = [Win32Lock]::FindWindow("Shell_TrayWnd", $null)
        if ($tray -ne [IntPtr]::Zero) { [Win32Lock]::ShowWindow($tray, 5) | Out-Null }
        $secTray = [Win32Lock]::FindWindow("Shell_SecondaryTrayWnd", $null)
        if ($secTray -ne [IntPtr]::Zero) { [Win32Lock]::ShowWindow($secTray, 5) | Out-Null }
    } catch {}

    # 5. Cleanup any lingering curtain processes
    try {
        Get-Process powershell -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -like "*Lock Curtain*" } | Stop-Process -Force -ErrorAction SilentlyContinue
    } catch {}

    Write-Host "[OK] Workstation fully restored: Mouse, keyboard, and applications unblocked." -ForegroundColor Green
}

function Get-InstalledSoftware {
    $keys = @("HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*", 
              "HKLM:\\Software\\Wow6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*")
    Get-ItemProperty $keys -ErrorAction SilentlyContinue | 
    Where-Object { $_.DisplayName -and $_.DisplayVersion } | 
    Select-Object @{Name="name";Expression={$_.DisplayName}}, @{Name="version";Expression={$_.DisplayVersion}} |
    Select-Object -Unique -First 15
}

function Check-Internet {
    try {
        $test = Test-Connection -ComputerName "8.8.8.8" -Count 1 -Quiet -ErrorAction SilentlyContinue
        return $test
    } catch {
        return $false
    }
}

# Wait up to 15 seconds at Windows boot for network interface initialization
$netRetries = 0
while (-not (Check-Internet) -and $netRetries -lt 8) {
    Start-Sleep -Seconds 2
    $netRetries++
}

while ($true) {
    try {
        $ip = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { 
            $_.IPAddress -notlike "169.254*" -and 
            $_.IPAddress -notlike "127.*" -and 
            $_.InterfaceAlias -notmatch "vEthernet|Loopback|Virtual|WSL|Bluetooth" 
        } | Select-Object -First 1).IPAddress

        if (-not $ip) {
            $ip = (Test-Connection -ComputerName $env:COMPUTERNAME -Count 1 -ErrorAction SilentlyContinue).IPV4Address.IPAddressToString
        }
        if (-not $ip) {
            $ip = "192.168.1." + (Get-Random -Minimum 10 -Maximum 99)
        }
        $global:StationIp = $ip

        # Check if this station is bound to a designated PC ID in station.txt
        $stationId = $null
        $stationFile = "$LAB_DIR\\station.txt"
        if (Test-Path $stationFile) {
            try {
                $rawStation = (Get-Content $stationFile -Raw -ErrorAction SilentlyContinue)
                if ($rawStation) {
                    $stationId = $rawStation.Trim()
                }
            } catch {}
        }

        $finalId = if ($stationId) { $stationId } else { $ip.Replace('.', '-') }
        $finalName = if ($stationId) { $stationId } else { "PC " + ($ip.Split('.')[-1]) }

        $cpu = Get-WmiObject Win32_Processor -ErrorAction SilentlyContinue | Measure-Object -Property LoadPercentage -Average | Select-Object -ExpandProperty Average
        $os = Get-WmiObject Win32_OperatingSystem -ErrorAction SilentlyContinue
        $ram = 0
        if ($os -and $os.TotalVisibleMemorySize) {
            $ram = [math]::Round((($os.TotalVisibleMemorySize - $os.FreePhysicalMemory) / $os.TotalVisibleMemorySize) * 100)
        }
        
        $disk = Get-WmiObject Win32_LogicalDisk -Filter "DeviceID='C:'" -ErrorAction SilentlyContinue
        $diskUsage = 0
        if ($disk -and $disk.Size) {
            $diskUsage = [math]::Round((($disk.Size - $disk.FreeSpace) / $disk.Size) * 100)
        }
        
        $hasInternet = Check-Internet
        $software = Get-InstalledSoftware

        $payload = @{
            room = $roomNumber
            ip = $ip
            id = $finalId
            name = $finalName
            hostname = $env:COMPUTERNAME
            has_internet = $hasInternet
            cpu_usage = [int]$cpu
            ram_usage = [int]$ram
            disk_usage = [int]$diskUsage
            software = $software
        } | ConvertTo-Json -Depth 3

        $response = Invoke-RestMethod -Uri $serverUrl -Method Post -Body $payload -ContentType "application/json" -TimeoutSec 5 -ErrorAction Stop

        # Enforce server-authoritative Lock state immediately
        if ($response -and $response.locked -eq $true) {
            Start-LockOverlay -Room $roomNumber -StationIp $ip
            try { [Win32Lock]::BlockInput($true) | Out-Null } catch {}
            try { 
                $t = [Win32Lock]::FindWindow("Shell_TrayWnd", $null)
                if ($t -ne [IntPtr]::Zero) { [Win32Lock]::ShowWindow($t, 0) | Out-Null }
            } catch {}
        } elseif ($response -and $response.locked -eq $false) {
            if ($global:IsLocked) {
                Stop-LockOverlay
            }
        }

        # Enforce server-authoritative Exam Mode state immediately (Block AI & Search Engines)
        if ($response -and $response.exam_mode -eq $true) {
            if (-not $global:ExamModeActive) {
                Enable-ExamMode
            }
        } elseif ($response -and $response.exam_mode -eq $false) {
            if ($global:ExamModeActive) {
                Disable-ExamMode
            }
        }

        if ($response -and $response.tasks) {
            foreach ($task in $response.tasks) {
                Write-Host "-> Received command: $($task.action)" -ForegroundColor Magenta
                $taskId = $task.id
                $completeUrl = $serverUrl.Replace("/agent/ping", "/tasks/$taskId/complete")
                
                if ($task.action -eq "shutdown") {
                    Write-Host "Executing remote shutdown..." -ForegroundColor Red
                    Invoke-RestMethod -Uri $completeUrl -Method Post -ErrorAction SilentlyContinue
                    shutdown.exe /s /t 15 /c "Shutdown command sent from Lab Administrator"
                }
                elseif ($task.action -eq "restart") {
                    Write-Host "Executing remote restart..." -ForegroundColor Yellow
                    Invoke-RestMethod -Uri $completeUrl -Method Post -ErrorAction SilentlyContinue
                    shutdown.exe /r /t 15 /c "Restart command sent from Lab Administrator"
                }
                elseif ($task.action -eq "broadcast") {
                    Write-Host "Displaying announcement: $($task.message)" -ForegroundColor Cyan
                    $msg = $task.message
                    Start-Process powershell -ArgumentList "-WindowStyle Hidden -Command ""Add-Type -AssemblyName PresentationFramework; [System.Windows.MessageBox]::Show('$msg', 'Lab Administrator Announcement')"""
                    Invoke-RestMethod -Uri $completeUrl -Method Post -ErrorAction SilentlyContinue
                }
                elseif ($task.action -eq "lock") {
                    Write-Host "Executing workstation lock..." -ForegroundColor DarkYellow
                    Start-LockOverlay -Room $roomNumber -StationIp $ip
                    Invoke-RestMethod -Uri $completeUrl -Method Post -ErrorAction SilentlyContinue
                }
                elseif ($task.action -eq "unlock") {
                    Write-Host "Workstation lock released" -ForegroundColor Green
                    Stop-LockOverlay
                    Invoke-RestMethod -Uri $completeUrl -Method Post -ErrorAction SilentlyContinue
                }
                elseif ($task.action -eq "enable_exam_mode") {
                    Write-Host "Exam Mode activated: Blocking AI & Search engines..." -ForegroundColor Red
                    Enable-ExamMode
                    Invoke-RestMethod -Uri $completeUrl -Method Post -ErrorAction SilentlyContinue
                }
                elseif ($task.action -eq "disable_exam_mode") {
                    Write-Host "Exam Mode deactivated: Restoring AI & Search engines..." -ForegroundColor Green
                    Disable-ExamMode
                    Invoke-RestMethod -Uri $completeUrl -Method Post -ErrorAction SilentlyContinue
                }
                else {
                    Invoke-RestMethod -Uri $completeUrl -Method Post -ErrorAction SilentlyContinue
                }
            }
        }
    } catch {
        Write-Host "[$((Get-Date).ToString('HH:mm:ss'))] Server connection error: $_" -ForegroundColor DarkRed
    }

    # Heartbeat interval sleep (3 seconds for immediate response to teacher commands)
    # If currently locked or in Exam Mode, run continuous 250ms watchdog checks (4 times a second)!
    if (($global:LockProcess -and (-not $global:LockProcess.HasExited)) -or $global:ExamModeActive) {
        for ($sub = 0; $sub -lt 12; $sub++) {
            if ($global:ExamModeActive) {
                Check-ExamWatchdog
            }
            Start-Sleep -Milliseconds 250
        }
    } else {
        Start-Sleep -Seconds $intervalSeconds
    }
}
`;
  };

  // Serve raw agent.ps1
  app.get('/agent.ps1', (req, res) => {
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.headers['x-forwarded-host'] || req.get('host');
    const fullServerUrl = (req.query.server as string) || `${protocol}://${host}/api/agent/ping`;
    const roomNumber = (req.query.room as string) || '809';
    const intervalSeconds = (req.query.interval as string) || '3';

    const script = buildAgentScript(fullServerUrl, roomNumber, intervalSeconds);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="agent.ps1"');
    res.send(script);
  });

  // Serve 1-click Windows Batch launcher that embeds the full agent script as a permanent Windows Boot Service
  app.get('/install-agent.bat', (req, res) => {
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.headers['x-forwarded-host'] || req.get('host');
    const fullServerUrl = (req.query.server as string) || `${protocol}://${host}/api/agent/ping`;
    const roomNumber = (req.query.room as string) || '809';
    const intervalSeconds = (req.query.interval as string) || '3';

    const script = buildAgentScript(fullServerUrl, roomNumber, intervalSeconds);
    const base64Script = Buffer.from(script, 'utf-8').toString('base64');

    const batContent = `@echo off
:: LabMonitor Station Windows Boot Background Agent (Zero-Browser Dependency)
setlocal EnableDelayedExpansion

net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [LabMonitor] Requesting Administrator Privileges to Install System Boot Service...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process cmd -ArgumentList '/c \"\"%~f0\" %*\"' -Verb RunAs"
    exit /b
)

title LabMonitor Hardware Boot Agent (Room ${roomNumber})
color 0a
echo =================================================================
echo   LabMonitor Permanent Windows Hardware Boot Agent
echo   Room: ${roomNumber} ^| Boot Mode: System Background Service
echo =================================================================
echo.
echo   * Operates completely independent of any web browser.
echo   * Turns ONLINE automatically when the computer turns ON.
echo   * Turns OFFLINE automatically when the computer powers OFF.
echo   * Closing or opening browser tabs has ZERO effect on PC status.
echo.
echo =================================================================
echo.

set "LAB_DIR=C:\\LabAgent"
if not exist "%LAB_DIR%" mkdir "%LAB_DIR%"

:: Optional Station Binding (e.g. 192-168-0-12 or PC 1)
set "STATION_ARG=%~1"
if not "%STATION_ARG%"=="" (
    echo %STATION_ARG% > "%LAB_DIR%\\station.txt"
    echo [Config] Workstation explicitly bound to: %STATION_ARG%
) else (
    if exist "%LAB_DIR%\\station.txt" (
        set /p SAVED_ID=<"%LAB_DIR%\\station.txt"
        echo [Config] Preserving existing station binding: !SAVED_ID!
    )
)

echo [1/5] Terminating any previous agent instances...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like '*agent.ps1*' -or $_.CommandLine -like '*run-agent.vbs*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"

echo [2/5] Deploying Updated Hardware Agent to %LAB_DIR%\\agent.ps1...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$b64 = '${base64Script}'; $bytes = [System.Convert]::FromBase64String($b64); $str = [System.Text.Encoding]::UTF8.GetString($bytes); [System.IO.File]::WriteAllText('%LAB_DIR%\\agent.ps1', $str, [System.Text.Encoding]::UTF8)"

echo [3/5] Creating Invisible Headless Background Runner (run-agent.vbs)...
(
echo Set WshShell = CreateObject^("WScript.Shell"^)
echo WshShell.Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""%LAB_DIR%\\agent.ps1""", 0, False
) > "%LAB_DIR%\\run-agent.vbs"

echo [4/5] Registering Windows Task Scheduler System Boot Service...
:: Schedule to run at Windows startup with highest privileges (no login or browser needed!)
schtasks /create /tn "LabMonitorBootAgent" /tr "wscript.exe \"%LAB_DIR%\\run-agent.vbs\"" /sc ONSTART /ru "SYSTEM" /rl HIGHEST /f >nul 2>&1
:: Also register at user logon as fallback
schtasks /create /tn "LabMonitorLogonAgent" /tr "wscript.exe \"%LAB_DIR%\\run-agent.vbs\"" /sc ONLOGON /rl HIGHEST /f >nul 2>&1
:: Registry Run key for all users
reg add "HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v "LabMonitorHardwareAgent" /t REG_SZ /d "wscript.exe \"%LAB_DIR%\\run-agent.vbs\"" /f >nul 2>&1

:: Create Uninstaller
(
echo @echo off
echo echo Stopping and removing LabMonitor Agent...
echo schtasks /delete /tn "LabMonitorBootAgent" /f ^>nul 2^>^&1
echo schtasks /delete /tn "LabMonitorLogonAgent" /f ^>nul 2^>^&1
echo reg delete "HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v "LabMonitorHardwareAgent" /f ^>nul 2^>^&1
echo powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*agent.ps1*' } | Stop-Process -Force"
echo echo LabMonitor Agent uninstalled successfully.
echo timeout /t 3
) > "%LAB_DIR%\\uninstall.bat"

echo [5/5] Launching Silent Background Hardware Service NOW...
wscript.exe "%LAB_DIR%\\run-agent.vbs"

echo.
echo =================================================================
echo   [SUCCESS] HARDWARE AGENT IS NOW PERMANENTLY RUNNING!
echo =================================================================
echo   * Status: Active in Windows Background (Headless)
echo   * Auto-Start: Enabled on PC Boot (Task Scheduler ONSTART)
echo   * Browser Independent: You can close any browser tab or window.
echo   * The PC will stay ONLINE as long as this computer is powered on.
echo   * When you turn off / shut down the PC, it will show OFFLINE.
echo =================================================================
echo.
timeout /t 5
exit /b
`;

    res.setHeader('Content-Type', 'application/x-bat');
    res.setHeader('Content-Disposition', `attachment; filename="run-lab-agent-room-${roomNumber}.bat"`);
    res.send(batContent);
  });

  // Serve 1-click Windows Uninstaller Batch
  app.get('/uninstall-agent.bat', (req, res) => {
    const bat = `@echo off
net session >nul 2>&1
if %errorLevel% neq 0 (
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)
echo Stopping and removing LabMonitor Windows Agent...
schtasks /delete /tn "LabMonitorBootAgent" /f >nul 2>&1
schtasks /delete /tn "LabMonitorLogonAgent" /f >nul 2>&1
reg delete "HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v "LabMonitorHardwareAgent" /f >nul 2>&1
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*agent.ps1*' -or $_.CommandLine -like '*run-agent.vbs*' } | Stop-Process -Force -ErrorAction SilentlyContinue"
echo [OK] LabMonitor Agent successfully removed from this PC.
timeout /t 3
`;
    res.setHeader('Content-Type', 'application/x-bat');
    res.setHeader('Content-Disposition', 'attachment; filename="uninstall-lab-agent.bat"');
    res.send(bat);
  });

  // Serve script as JSON for React setup page
  app.get('/api/agent/script', (req, res) => {
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.headers['x-forwarded-host'] || req.get('host');
    const fullServerUrl = (req.query.server as string) || `${protocol}://${host}/api/agent/ping`;
    const roomNumber = (req.query.room as string) || '809';
    const intervalSeconds = (req.query.interval as string) || '3';

    const script = buildAgentScript(fullServerUrl, roomNumber, intervalSeconds);
    res.json({ script });
  });

  // API to receive pings from the PowerShell Agent
  app.post('/api/agent/ping', (req, res) => {
    const pcData = req.body;
    if (!pcData || (!pcData.ip && !pcData.id)) {
      return res.status(400).json({ success: false, error: 'IP address or ID is required' });
    }

    const now = new Date();
    const pcId = pcData.id || pcData.ip.replace(/\./g, '-');
    const pcIp = pcData.ip || pcId.replace(/-/g, '.');
    const pcRoom = pcData.room || '809';

    const existingIndex = connectedPCs.findIndex(pc => pc.id === pcId || pc.ip === pcIp || pc.ip === pcData.ip);
    const targetPc = connectedPCs.find(p => p.id === pcId || p.ip === pcIp || p.ip === pcData.ip);
    const isRoomLocked = !!(labStates[pcRoom]?.locked || labStates['ALL']?.locked);
    const isRoomExam = !!(labStates[pcRoom]?.exam_mode || labStates['ALL']?.exam_mode);

    if (existingIndex > -1) {
      // Preserve existing state (room, locked, exam_mode, etc.)
      const existingPc = connectedPCs[existingIndex];
      connectedPCs[existingIndex] = {
        ...existingPc,
        ...pcData,
        id: existingPc.id,
        ip: pcIp,
        room: pcData.room || existingPc.room,
        locked: existingPc.locked || isRoomLocked,
        exam_mode: existingPc.exam_mode || isRoomExam,
        needs_help: existingPc.needs_help,
        lastSeen: now.toISOString(),
        status: 'online',
        is_real: true,
        device_bound: true,
        is_fixed: true
      };
    } else {
      // New PC connecting - if room has offline mock PC, replace the first one or prepend
      const placeholderIdx = connectedPCs.findIndex(p => (p.room === pcRoom || p.room === String(pcRoom)) && !p.is_real);
      const pcEntry = {
        ...pcData,
        id: pcId,
        ip: pcIp,
        name: pcData.name || `PC ${pcIp.split('.').pop()}`,
        lastSeen: now.toISOString(),
        status: 'online',
        room: pcRoom,
        locked: isRoomLocked,
        exam_mode: isRoomExam,
        needs_help: false,
        cpu_usage: pcData.cpu_usage || 0,
        ram_usage: pcData.ram_usage || 0,
        is_real: true,
        device_bound: true,
        is_fixed: true
      };
      if (placeholderIdx > -1) {
        connectedPCs[placeholderIdx] = pcEntry;
      } else {
        connectedPCs.unshift(pcEntry);
      }
    }

    const updatedTargetPc = connectedPCs.find(p => p.id === pcId || p.ip === pcIp || p.ip === pcData.ip);
    const pendingTasks = tasks.filter(t => 
      (t.pc_id === pcId || t.pc_id === 'ALL' || (pcRoom && t.room === pcRoom && (!t.pc_id || t.pc_id === pcId || t.pc_id === 'ALL'))) && 
      t.status === 'pending'
    );

    res.json({ 
      success: true, 
      message: 'Ping received', 
      pc_id: pcId,
      locked: (updatedTargetPc ? !!updatedTargetPc.locked : false) || isRoomLocked,
      exam_mode: (updatedTargetPc ? !!updatedTargetPc.exam_mode : false) || isRoomExam,
      tasks: pendingTasks 
    });
  });

  // Browser-level student dashboard heartbeat API
  app.post('/api/pcs/:id/heartbeat', (req, res) => {
    const rawId = req.params.id;
    const body = req.body || {};
    const room = body.room || '809';
    const dashed = rawId.replace(/\./g, '-');
    const dotted = rawId.replace(/-/g, '.');
    const now = new Date();

    let pc = connectedPCs.find(p => p.id === rawId || p.id === dashed || p.id === dotted || p.ip === rawId || p.ip === dotted);
    if (!pc) {
      // Bind to the first offline PC in the room or insert new fixed entry
      pc = connectedPCs.find(p => (p.room === room || p.room === String(room)) && p.status === 'offline');
    }

    if (pc) {
      pc.lastSeen = now.toISOString();
      pc.status = 'online';
      pc.room = room;
      pc.is_real = true;
      pc.device_bound = true;
      pc.is_fixed = true;
      const isRoomLocked = !!(labStates[room]?.locked || labStates['ALL']?.locked);
      const isRoomExam = !!(labStates[room]?.exam_mode || labStates['ALL']?.exam_mode);
      return res.json({ 
        success: true, 
        pc_id: pc.id, 
        status: 'online', 
        device_bound: true,
        locked: pc.locked || isRoomLocked, 
        exam_mode: pc.exam_mode || isRoomExam 
      });
    }

    const newPc = {
      id: dashed,
      ip: dotted,
      name: `PC ${dotted.split('.').pop()}`,
      status: 'online',
      room,
      cpu_usage: 15,
      ram_usage: 32,
      lastSeen: now.toISOString(),
      is_real: true,
      device_bound: true,
      is_fixed: true,
      locked: false,
      exam_mode: false,
      needs_help: false
    };
    connectedPCs.unshift(newPc);

    res.json({ success: true, status: 'online', device_bound: true, pc_id: newPc.id });
  });

  // API to get all connected PCs with accurate heartbeat tracking
  app.get('/api/pcs', (req, res) => {
    const now = new Date();
    const updatedPCs = connectedPCs.map(pc => {
      const lastSeen = new Date(pc.lastSeen || 0);
      const diffSeconds = (now.getTime() - lastSeen.getTime()) / 1000;
      const isRoomLocked = !!(labStates[pc.room]?.locked || labStates['ALL']?.locked);
      const isRoomExam = !!(labStates[pc.room]?.exam_mode || labStates['ALL']?.exam_mode);
      
      // Heartbeat is sent every 3s. If no heartbeat for > 35s, station is OFFLINE!
      const isOffline = diffSeconds > 35;
      const status = isOffline ? 'offline' : 'online';

      return {
        ...pc,
        status,
        cpu_usage: isOffline ? 0 : (pc.cpu_usage || 0),
        ram_usage: isOffline ? 0 : (pc.ram_usage || 0),
        locked: pc.locked || isRoomLocked,
        exam_mode: pc.exam_mode || isRoomExam
      };
    });
    res.json(updatedPCs);
  });

  // API to get a single PC by ID or IP
  app.get('/api/pcs/:id', (req, res) => {
    const rawId = req.params.id;
    const dashed = rawId.replace(/\./g, '-');
    const dotted = rawId.replace(/-/g, '.');
    const pc = connectedPCs.find(p => p.id === rawId || p.id === dashed || p.id === dotted || p.ip === rawId || p.ip === dotted);
    if (pc) {
      const now = new Date();
      const lastSeen = new Date(pc.lastSeen || 0);
      const diffSeconds = (now.getTime() - lastSeen.getTime()) / 1000;
      const isOffline = diffSeconds > 35;
      const status = isOffline ? 'offline' : 'online';
      const isRoomLocked = !!(labStates[pc.room]?.locked || labStates['ALL']?.locked);
      const isRoomExam = !!(labStates[pc.room]?.exam_mode || labStates['ALL']?.exam_mode);
      res.json({ 
        ...pc, 
        status,
        cpu_usage: isOffline ? 0 : (pc.cpu_usage || 0),
        ram_usage: isOffline ? 0 : (pc.ram_usage || 0),
        locked: pc.locked || isRoomLocked,
        exam_mode: pc.exam_mode || isRoomExam
      });
    } else {
      res.status(404).json({ error: 'PC not found' });
    }
  });

  // Room Status API
  app.get('/api/labs/:room/status', (req, res) => {
    const { room } = req.params;
    const isLocked = !!(labStates[room]?.locked || labStates['ALL']?.locked);
    const isExam = !!(labStates[room]?.exam_mode || labStates['ALL']?.exam_mode);
    res.json({ room, locked: isLocked, exam_mode: isExam });
  });

  // Teacher Actions API
  app.post('/api/labs/:room/teacher-action', (req, res) => {
    const { room } = req.params;
    const { action } = req.body;

    if (!labStates[room]) {
      labStates[room] = { locked: false, exam_mode: false };
    }
    
    if (action === 'lock') {
      labStates[room].locked = true;
      if (room === 'ALL') {
        ['801', '802', '803', '804', '805', '806', '807', '808', '809', '810'].forEach(r => {
          if (!labStates[r]) labStates[r] = { locked: true, exam_mode: false };
          else labStates[r].locked = true;
        });
      }
    } else if (action === 'unlock') {
      labStates[room].locked = false;
      if (room === 'ALL') {
        ['801', '802', '803', '804', '805', '806', '807', '808', '809', '810'].forEach(r => {
          if (!labStates[r]) labStates[r] = { locked: false, exam_mode: false };
          else labStates[r].locked = false;
        });
      }
    } else if (action === 'exam_on') {
      labStates[room].exam_mode = true;
      if (room === 'ALL') {
        ['801', '802', '803', '804', '805', '806', '807', '808', '809', '810'].forEach(r => {
          if (!labStates[r]) labStates[r] = { locked: false, exam_mode: true };
          else labStates[r].exam_mode = true;
        });
      }
    } else if (action === 'exam_off') {
      labStates[room].exam_mode = false;
      if (room === 'ALL') {
        ['801', '802', '803', '804', '805', '806', '807', '808', '809', '810'].forEach(r => {
          if (!labStates[r]) labStates[r] = { locked: false, exam_mode: false };
          else labStates[r].exam_mode = false;
        });
      }
    }
    
    const targetPCs = room === 'ALL' ? connectedPCs : connectedPCs.filter(pc => pc.room === room || pc.room === String(room));
    targetPCs.forEach(pc => {
      if (action === 'lock') pc.locked = true;
      if (action === 'unlock') pc.locked = false;
      if (action === 'exam_on') pc.exam_mode = true;
      if (action === 'exam_off') pc.exam_mode = false;

      tasks.unshift({
        id: Math.random().toString(36).substr(2, 9),
        pc_id: pc.id,
        room: pc.room,
        action: action === 'exam_on' ? 'enable_exam_mode' : action === 'exam_off' ? 'disable_exam_mode' : action,
        target: `PC ${pc.ip || pc.id} ${action.toUpperCase()}`,
        status: 'pending',
        created_at: new Date().toISOString()
      });
    });

    // Also push a room-level wildcard task so any new or dynamically connecting PC in this room gets it
    tasks.unshift({
      id: Math.random().toString(36).substr(2, 9),
      pc_id: 'ALL',
      room: room,
      action: action === 'exam_on' ? 'enable_exam_mode' : action === 'exam_off' ? 'disable_exam_mode' : action,
      target: `Room ${room} ${action.toUpperCase()}`,
      status: 'pending',
      created_at: new Date().toISOString()
    });

    res.json({ success: true, message: `Action ${action} applied to room ${room}` });
  });

  // Individual PC Action API (Lock/Unlock/Custom/Help)
  app.post(['/api/pcs/:id/action', '/api/pcs/action'], (req, res) => {
    const rawId = req.params.id || req.body.id || req.body.pc_id || '192-168-0-12';
    const { action } = req.body;
    const dashed = String(rawId).replace(/\./g, '-');
    const dotted = String(rawId).replace(/-/g, '.');
    let pc = connectedPCs.find(p => p.id === rawId || p.id === dashed || p.id === dotted || p.ip === rawId || p.ip === dotted);
    if (!pc) {
      pc = {
        id: dashed,
        ip: dotted,
        room: req.body.room || '809',
        status: 'online',
        lastSeen: new Date().toISOString(),
        locked: action === 'lock',
        exam_mode: action === 'exam_on',
        needs_help: action === 'help',
        software: []
      };
      connectedPCs.push(pc);
    } else {
      if (action === 'lock') pc.locked = true;
      if (action === 'unlock') pc.locked = false;
      if (action === 'exam_on') pc.exam_mode = true;
      if (action === 'exam_off') pc.exam_mode = false;
      if (action === 'help') pc.needs_help = true;
      if (action === 'resolve_help') pc.needs_help = false;
    }

    if (action === 'help') {
      issues.unshift({
        id: 'T-' + Math.floor(1000 + Math.random() * 9000),
        room: pc.room || req.body.room || '809',
        pc_id: pc.id,
        issue: `Student raised hand requesting help at Station ${pc.ip || pc.id}`,
        status: 'open',
        priority: 'high',
        created_at: new Date().toISOString()
      });
    }

    tasks.unshift({
      id: Math.random().toString(36).substr(2, 9),
      pc_id: pc.id,
      room: pc.room,
      action: action === 'exam_on' ? 'enable_exam_mode' : action === 'exam_off' ? 'disable_exam_mode' : action,
      target: `PC ${pc.ip || rawId} ${action.toUpperCase()}`,
      status: 'pending',
      created_at: new Date().toISOString()
    });
    res.json({ success: true, message: `Action ${action} applied to PC ${rawId}`, pc });
  });

  // Report student lock-bypass or focus-loss violation
  app.post('/api/pcs/:id/violation', (req, res) => {
    const rawId = req.params.id;
    const cleanId = rawId.replace(/\./g, '-');
    const pc = connectedPCs.find(p => p.id === cleanId || p.id === rawId || p.ip === rawId);
    
    if (pc) {
      pc.violation = true;
      pc.violation_msg = req.body.message || 'Student switched tabs / attempted to bypass lock screen';
      pc.violation_time = new Date().toISOString();

      issues.unshift({
        id: 'VIO-' + Math.floor(1000 + Math.random() * 9000),
        room: pc.room || '809',
        pc_id: pc.id,
        issue: `🚨 LOCK BYPASS ATTEMPT: Station ${pc.ip || pc.id} lost window focus or attempted to use external apps/AI!`,
        status: 'open',
        priority: 'high',
        created_at: new Date().toISOString()
      });
    }

    res.json({ success: true, message: 'Violation logged' });
  });

  // Dismiss PC violation alert
  app.post('/api/pcs/:id/dismiss-violation', (req, res) => {
    const rawId = req.params.id;
    const cleanId = rawId.replace(/\./g, '-');
    const pc = connectedPCs.find(p => p.id === cleanId || p.id === rawId || p.ip === rawId);
    if (pc) {
      pc.violation = false;
      delete pc.violation_msg;
      delete pc.violation_time;
    }
    res.json({ success: true });
  });

  // File Sharing API
  app.post('/api/labs/:room/share-file', (req, res) => {
    const { room } = req.params;
    const { filename, size, content, content_type } = req.body;
    
    if (!sharedFiles[room]) {
      sharedFiles[room] = [];
    }
    
    const newFile = {
      id: Date.now().toString(),
      filename,
      size,
      content: content || null,
      content_type: content_type || null,
      shared_at: new Date().toISOString()
    };
    
    sharedFiles[room].push(newFile);
    res.json({ success: true, file: newFile });
  });

  app.get('/api/labs/:room/files', (req, res) => {
    const { room } = req.params;
    const roomFiles = sharedFiles[room] || [];
    const globalFiles = sharedFiles['ALL'] || [];
    const combined = [...roomFiles];
    globalFiles.forEach(gf => {
      if (!combined.some(rf => rf.id === gf.id)) {
        combined.push(gf);
      }
    });
    res.json(combined);
  });

  // File Collection API (Student to Teacher)
  app.post('/api/labs/:room/submit-file', (req, res) => {
    const { room } = req.params;
    const { pc_id, filename, size, content, content_type } = req.body;
    
    if (!collectedFiles[room]) {
      collectedFiles[room] = [];
    }
    
    const newFile = {
      id: Date.now().toString(),
      pc_id,
      filename,
      size,
      content: content || null,
      content_type: content_type || null,
      submitted_at: new Date().toISOString()
    };
    
    collectedFiles[room].push(newFile);
    res.json({ success: true, file: newFile });
  });

  app.get('/api/labs/:room/collected-files', (req, res) => {
    const { room } = req.params;
    res.json(collectedFiles[room] || []);
  });

  // Student Actions API (Support both path parameter and body parameter)
  app.post(['/api/pcs/:id/student-action', '/api/pcs/student-action', '/api/student/action', '/api/student-action'], (req, res) => {
    const rawId = req.params.id || req.body.id || req.body.pc_id || (req.query.id as string) || '192-168-0-12';
    const { action, room } = req.body;
    
    const dashed = String(rawId).replace(/\./g, '-');
    const dotted = String(rawId).replace(/-/g, '.');
    let pc = connectedPCs.find(p => p.id === rawId || p.id === dashed || p.id === dotted || p.ip === rawId || p.ip === dotted);
    
    if (!pc) {
      pc = {
        id: dashed,
        ip: dotted,
        room: room || req.body.room || '809',
        status: 'online',
        lastSeen: new Date().toISOString(),
        locked: false,
        exam_mode: false,
        needs_help: action === 'help',
        software: []
      };
      connectedPCs.push(pc);
    } else {
      if (action === 'help') pc.needs_help = true;
      if (action === 'resolve_help') pc.needs_help = false;
      if (room && (!pc.room || pc.room !== room)) pc.room = room;
    }

    if (action === 'help') {
      issues.unshift({
        id: 'T-' + Math.floor(1000 + Math.random() * 9000),
        room: pc.room || room || '809',
        pc_id: pc.id,
        issue: `Student raised hand requesting help at Station ${pc.ip || pc.id}`,
        status: 'open',
        priority: 'high',
        created_at: new Date().toISOString()
      });
    }

    res.json({ success: true, message: `Action ${action} applied to PC ${rawId}`, pc });
  });

  // API to get dashboard stats
  app.get('/api/stats', (req, res) => {
    const now = new Date();
    const online = connectedPCs.filter(pc => {
      const lastSeen = new Date(pc.lastSeen);
      const diffMinutes = (now.getTime() - lastSeen.getTime()) / 60000;
      return diffMinutes <= 10 && pc.status === 'online';
    }).length;

    const offline = connectedPCs.filter(pc => {
      const lastSeen = new Date(pc.lastSeen);
      const diffMinutes = (now.getTime() - lastSeen.getTime()) / 60000;
      return diffMinutes > 10;
    }).length;

    const pcIssues = connectedPCs.filter(pc => pc.status === 'issue').length;

    res.json({
      total: connectedPCs.length,
      online,
      offline,
      issues: pcIssues
    });
  });

  // API to get issues
  app.get('/api/issues', (req, res) => {
    res.json(issues);
  });

  app.post('/api/issues', (req, res) => {
    const issue = {
      id: Math.random().toString(36).substr(2, 9),
      ...req.body,
      status: 'open',
      created_at: new Date().toISOString()
    };
    issues.push(issue);
    
    // Update PC status to 'issue'
    const pcIndex = connectedPCs.findIndex(pc => pc.id === req.body.pc_id);
    if (pcIndex > -1) {
      connectedPCs[pcIndex].status = 'issue';
    }
    
    // Send Email Alert
    sendEmailAlert(`New issue reported on PC ${req.body.pc_id}`, `Description: ${req.body.description}`);
    
    res.json(issue);
  });

  // API to resolve a specific issue
  app.post('/api/issues/:id/resolve', (req, res) => {
    const issue = issues.find(i => i.id === req.params.id);
    if (issue) {
      issue.status = 'resolved';
      issue.resolved_at = new Date().toISOString();
      
      // Check if PC has other open issues, if not, set status to online
      const pcId = issue.pc_id;
      const hasOpenIssues = issues.some(i => i.pc_id === pcId && i.status === 'open');
      if (!hasOpenIssues) {
        const pc = connectedPCs.find(p => p.id === pcId);
        if (pc) pc.status = 'online';
      }
      res.json({ success: true, issue });
    } else {
      res.status(404).json({ error: 'Issue not found' });
    }
  });

  // API to resolve all issues for a PC
  app.post('/api/pcs/:id/resolve', (req, res) => {
    const pcId = req.params.id;
    issues.forEach(issue => {
      if (issue.pc_id === pcId && issue.status === 'open') {
        issue.status = 'resolved';
        issue.resolved_at = new Date().toISOString();
      }
    });
    
    const pc = connectedPCs.find(p => p.id === pcId);
    if (pc) pc.status = 'online';
    
    res.json({ success: true });
  });

  // API to broadcast message
  app.post('/api/broadcast', (req, res) => {
    const { message, room } = req.body;
    const targetPCs = room === 'ALL' ? connectedPCs : connectedPCs.filter(pc => pc.room === room);
    targetPCs.forEach(pc => {
      tasks.unshift({
        id: Math.random().toString(36).substr(2, 9),
        pc_id: pc.id,
        action: 'broadcast',
        message: message,
        target: message || 'Broadcast Message',
        status: 'pending',
        created_at: new Date().toISOString()
      });
    });
    res.json({ success: true });
  });

  // API to toggle Exam Mode
  app.post('/api/exam-mode', (req, res) => {
    const { enabled } = req.body;
    settings.examModeEnabled = enabled;
    
    connectedPCs.forEach(pc => {
      tasks.unshift({
        id: Math.random().toString(36).substr(2, 9),
        pc_id: pc.id,
        action: enabled ? 'enable_exam_mode' : 'disable_exam_mode',
        target: enabled ? 'Block Internet & Software' : 'Restore Normal Access',
        status: 'pending',
        created_at: new Date().toISOString()
      });
    });
    res.json({ success: true, examModeEnabled: enabled });
  });

  // API to get schedules
  app.get('/api/schedules', (req, res) => {
    res.json(schedules);
  });

  app.post('/api/schedules', (req, res) => {
    const { room, ...data } = req.body;
    schedules[room] = {
      class: data.class_name,
      teacher: data.teacher,
      time: data.time
    };
    res.json({ success: true });
  });

  // API to delete a schedule
  app.delete('/api/schedules/:room', (req, res) => {
    const { room } = req.params;
    if (schedules[room]) {
      delete schedules[room];
    }
    res.json({ success: true, message: `Schedule for room ${room} deleted` });
  });

  // API to get all tasks
  app.get('/api/tasks', (req, res) => {
    res.json(tasks);
  });

  // API to queue a task
  app.post('/api/tasks', (req, res) => {
    const task = {
      id: Math.random().toString(36).substr(2, 9),
      status: 'pending',
      created_at: new Date().toISOString(),
      target: req.body.target || req.body.action,
      ...req.body
    };
    tasks.unshift(task);
    res.json({ success: true, task });
  });

  // API to mark a task as complete
  app.post('/api/tasks/:id/complete', (req, res) => {
    const task = tasks.find(t => String(t.id) === String(req.params.id));
    if (task) {
      task.status = 'completed';
      task.completed_at = new Date().toISOString();
    }
    res.json({ success: true });
  });

  // API for individual PC power actions
  app.post('/api/pcs/:id/power', (req, res) => {
    const { action } = req.body;
    const pcIndex = connectedPCs.findIndex(p => p.id === req.params.id);
    
    if (pcIndex > -1) {
      if (action === 'shutdown') {
        connectedPCs[pcIndex].status = 'offline';
        connectedPCs[pcIndex].cpu_usage = 0;
        connectedPCs[pcIndex].ram_usage = 0;
      } else if (action === 'wake' || action === 'restart') {
        connectedPCs[pcIndex].status = 'online';
        connectedPCs[pcIndex].cpu_usage = Math.floor(Math.random() * 20) + 5;
        connectedPCs[pcIndex].ram_usage = Math.floor(Math.random() * 30) + 15;
        connectedPCs[pcIndex].lastSeen = new Date().toISOString();
      }
    }

    tasks.unshift({
      id: Math.random().toString(36).substr(2, 9),
      pc_id: req.params.id,
      action: action,
      target: action.toUpperCase(),
      status: 'pending',
      created_at: new Date().toISOString()
    });
    res.json({ success: true });
  });

  // API for room power actions
  app.post('/api/labs/:room/power', (req, res) => {
    const { action } = req.body;
    const roomPCs = connectedPCs.filter(pc => pc.room === req.params.room);
    
    roomPCs.forEach(pc => {
      const pcIndex = connectedPCs.findIndex(p => p.id === pc.id);
      if (pcIndex > -1) {
        if (action === 'shutdown') {
          connectedPCs[pcIndex].status = 'offline';
          connectedPCs[pcIndex].cpu_usage = 0;
          connectedPCs[pcIndex].ram_usage = 0;
        } else if (action === 'wake') {
          connectedPCs[pcIndex].status = 'online';
          connectedPCs[pcIndex].cpu_usage = Math.floor(Math.random() * 20) + 5;
          connectedPCs[pcIndex].ram_usage = Math.floor(Math.random() * 30) + 15;
          connectedPCs[pcIndex].lastSeen = new Date().toISOString();
        }
      }

      tasks.unshift({
        id: Math.random().toString(36).substr(2, 9),
        pc_id: pc.id,
        action: action,
        target: `Room ${req.params.room} ${action.toUpperCase()}`,
        status: 'pending',
        created_at: new Date().toISOString()
      });
    });
    res.json({ success: true });
  });

  // API to clear all data (actually resets to demo data)
  app.post('/api/pcs/clear', (req, res) => {
    const newData = generateMockData();
    connectedPCs = newData.pcs;
    issues = newData.mockIssues;
    schedules = newData.mockSchedules;
    sharedFiles = newData.mockSharedFiles;
    collectedFiles = newData.mockCollectedFiles;
    tasks = [...newData.mockTasks];
    res.json({ success: true, message: 'All data has been reset to demo state' });
  });

  // Settings
  let settings = {
    autoShutdownEnabled: true,
    autoShutdownTime: '19:00', // HH:mm format
    emailEnabled: false,
    emailSmtpHost: '',
    emailSmtpPort: 587,
    emailUser: '',
    emailPass: '',
    emailTo: '',
    examModeEnabled: false
  };

  // Email helper
  const sendEmailAlert = async (subject: string, text: string) => {
    if (!settings.emailEnabled || !settings.emailSmtpHost || !settings.emailUser || !settings.emailPass || !settings.emailTo) return;
    try {
      const transporter = nodemailer.createTransport({
        host: settings.emailSmtpHost,
        port: settings.emailSmtpPort,
        secure: settings.emailSmtpPort === 465,
        auth: {
          user: settings.emailUser,
          pass: settings.emailPass,
        },
      });

      await transporter.sendMail({
        from: `"LabMonitor Alert" <${settings.emailUser}>`,
        to: settings.emailTo,
        subject: `🚨 Lab Alert: ${subject}`,
        text: text,
      });
    } catch (e) {
      console.error('Email alert failed:', e);
    }
  };

  // API to get settings
  app.get('/api/settings', (req, res) => {
    res.json(settings);
  });

  // API to update settings
  app.post('/api/settings', (req, res) => {
    const oldTime = settings.autoShutdownTime;
    settings = { ...settings, ...req.body };
    
    // Reset lastShutdownDate if the time was changed so it can trigger again today
    if (oldTime !== settings.autoShutdownTime) {
      lastShutdownDate = '';
    }
    
    res.json({ success: true, settings });
  });

  // Auto-Shutdown Logic
  let lastShutdownDate = '';

  setInterval(() => {
    if (!settings.autoShutdownEnabled) return;
    const now = new Date();
    const dateString = now.toDateString();
    
    const [targetHour, targetMinute] = settings.autoShutdownTime.split(':').map(Number);
    
    // If current time is past the target time, and we haven't shut down today
    if ((now.getHours() > targetHour || (now.getHours() === targetHour && now.getMinutes() >= targetMinute)) && lastShutdownDate !== dateString) {
      connectedPCs.forEach(pc => {
        tasks.unshift({
          id: Math.random().toString(36).substr(2, 9),
          pc_id: pc.id,
          action: 'shutdown',
          target: `Auto ${settings.autoShutdownTime} Shutdown`,
          status: 'pending',
          created_at: new Date().toISOString(),
          note: `Auto ${settings.autoShutdownTime} Shutdown`
        });
      });
      lastShutdownDate = dateString;
      console.log(`Triggered ${settings.autoShutdownTime} Auto Shutdown for all PCs`);
    }
  }, 60000); // Check every minute

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
