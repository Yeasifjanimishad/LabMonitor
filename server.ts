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
        const isOffline = pcSeed % 15 === 0;
        const isIssue = pcSeed % 12 === 0 && !isOffline;
        const isLocked = pcSeed % 10 === 0 && !isOffline;
        const isExam = pcSeed % 8 === 0 && !isOffline;
        const needsHelp = pcSeed % 7 === 0 && !isOffline && !isLocked;

        let status = 'online';
        let cpu_usage = Math.floor(Math.random() * 30) + 5;
        let ram_usage = Math.floor(Math.random() * 40) + 20;
        let lastSeen = new Date().toISOString();
        
        if (isOffline) {
          status = 'offline';
          cpu_usage = 0;
          ram_usage = 0;
          lastSeen = new Date(Date.now() - 3600000).toISOString();
        } else if (isIssue) {
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
  const buildAgentScript = (fullServerUrl: string, roomNumber: string, intervalSeconds: string | number = 200) => {
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

# Auto-Elevation Check: Prompt for Administrator if not elevated so physical BlockInput works 100%
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    if ($PSCommandPath) {
        Write-Host "-> Elevating process to Administrator for Kernel-Level Hardware Input Freeze..." -ForegroundColor Yellow
        Start-Process powershell.exe -Verb RunAs -ArgumentList "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $PSCommandPath
        exit
    } else {
        Write-Host "[!] Note: Please launch PowerShell as Administrator to allow Windows to freeze physical mouse and keyboard inputs." -ForegroundColor Yellow
    }
} else {
    Write-Host "[OK] Administrator privileges verified: Hardware Input Freeze & Taskbar lockdown active." -ForegroundColor Green
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
}
"@
}

$global:LockProcess = $null
$global:IsLocked = $false

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
                    Write-Host "Exam Mode activated" -ForegroundColor Red
                    Invoke-RestMethod -Uri $completeUrl -Method Post -ErrorAction SilentlyContinue
                }
                elseif ($task.action -eq "disable_exam_mode") {
                    Write-Host "Exam Mode deactivated" -ForegroundColor Green
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

    # Heartbeat interval sleep (configured to 200 seconds by default)
    # If currently locked, poll faster (every 3s) so teacher's unlock command takes effect immediately!
    if ($global:LockProcess -and (-not $global:LockProcess.HasExited)) {
        Start-Sleep -Seconds 3
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
    const intervalSeconds = (req.query.interval as string) || '200';

    const script = buildAgentScript(fullServerUrl, roomNumber, intervalSeconds);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="agent.ps1"');
    res.send(script);
  });

  // Serve 1-click Windows Batch launcher that embeds the full agent script self-contained
  app.get('/install-agent.bat', (req, res) => {
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.headers['x-forwarded-host'] || req.get('host');
    const fullServerUrl = (req.query.server as string) || `${protocol}://${host}/api/agent/ping`;
    const roomNumber = (req.query.room as string) || '809';
    const intervalSeconds = (req.query.interval as string) || '200';

    const script = buildAgentScript(fullServerUrl, roomNumber, intervalSeconds);
    const base64Script = Buffer.from(script, 'utf-8').toString('base64');

    const batContent = `@echo off
:: LabMonitor Station Self-Contained Auto-Elevator & Hardware Freeze Agent
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Elevating to Administrator...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

title LabMonitor Student PC Agent (Room ${roomNumber})
color 0b
echo =================================================================
echo   LabMonitor Student PC Workstation Lock & Freeze Agent
echo   Room: ${roomNumber} | Status: Administrator Elevated (OK)
echo =================================================================
echo.

set "LAB_DIR=C:\\LabAgent"
if not exist "%LAB_DIR%" mkdir "%LAB_DIR%"

echo [1/2] Writing Agent Script to %LAB_DIR%\\agent.ps1...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$b64 = '${base64Script}'; $bytes = [System.Convert]::FromBase64String($b64); $str = [System.Text.Encoding]::UTF8.GetString($bytes); [System.IO.File]::WriteAllText('%LAB_DIR%\\agent.ps1', $str, [System.Text.Encoding]::UTF8)"

echo [2/2] Starting Station Agent with Kernel BlockInput & Taskbar Suppression...
echo Keep this window running or minimized.
powershell -NoProfile -ExecutionPolicy Bypass -File "%LAB_DIR%\\agent.ps1"
`;

    res.setHeader('Content-Type', 'application/x-bat');
    res.setHeader('Content-Disposition', `attachment; filename="run-lab-agent-room-${roomNumber}.bat"`);
    res.send(batContent);
  });

  // Serve script as JSON for React setup page
  app.get('/api/agent/script', (req, res) => {
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.headers['x-forwarded-host'] || req.get('host');
    const fullServerUrl = (req.query.server as string) || `${protocol}://${host}/api/agent/ping`;
    const roomNumber = (req.query.room as string) || '809';
    const intervalSeconds = (req.query.interval as string) || '200';

    const script = buildAgentScript(fullServerUrl, roomNumber, intervalSeconds);
    res.json({ script });
  });

  // API to receive pings from the PowerShell Agent
  app.post('/api/agent/ping', (req, res) => {
    const pcData = req.body;
    if (!pcData || !pcData.ip) {
      return res.status(400).json({ success: false, error: 'IP address is required' });
    }

    const now = new Date();
    const existingIndex = connectedPCs.findIndex(pc => pc.ip === pcData.ip);

    const pcId = pcData.ip.replace(/\./g, '-');
    const targetPc = connectedPCs.find(p => p.id === pcId || p.ip === pcData.ip);
    const pcRoom = pcData.room || targetPc?.room || '809';
    const isRoomLocked = !!(labStates[pcRoom]?.locked || labStates['ALL']?.locked);
    const isRoomExam = !!(labStates[pcRoom]?.exam_mode || labStates['ALL']?.exam_mode);

    if (existingIndex > -1) {
      // Preserve existing state (room, locked, exam_mode, etc.)
      const existingPc = connectedPCs[existingIndex];
      connectedPCs[existingIndex] = {
        ...existingPc,
        ...pcData,
        id: existingPc.id,
        room: pcData.room || existingPc.room,
        locked: existingPc.locked || isRoomLocked,
        exam_mode: existingPc.exam_mode || isRoomExam,
        needs_help: existingPc.needs_help,
        lastSeen: now.toISOString(),
        status: pcData.status || 'online'
      };
    } else {
      // New PC connecting
      const pcEntry = {
        ...pcData,
        id: pcData.ip.replace(/\./g, '-'),
        lastSeen: now.toISOString(),
        status: pcData.status || 'online',
        room: pcData.room || '809',
        locked: isRoomLocked,
        exam_mode: isRoomExam,
        needs_help: false,
        cpu_usage: pcData.cpu_usage || 0,
        ram_usage: pcData.ram_usage || 0
      };
      connectedPCs.push(pcEntry);
    }

    const updatedTargetPc = connectedPCs.find(p => p.id === pcId || p.ip === pcData.ip);
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

  // API to get all connected PCs
  app.get('/api/pcs', (req, res) => {
    const now = new Date();
    const updatedPCs = connectedPCs.map(pc => {
      const lastSeen = new Date(pc.lastSeen);
      const diffMinutes = (now.getTime() - lastSeen.getTime()) / 60000;
      const isRoomLocked = !!(labStates[pc.room]?.locked || labStates['ALL']?.locked);
      const isRoomExam = !!(labStates[pc.room]?.exam_mode || labStates['ALL']?.exam_mode);
      
      // For demo purposes, keep non-offline PCs alive
      if (pc.status !== 'offline' && diffMinutes > 5) {
        pc.lastSeen = now.toISOString();
        return { 
          ...pc,
          locked: pc.locked || isRoomLocked,
          exam_mode: pc.exam_mode || isRoomExam
        };
      }

      return {
        ...pc,
        status: diffMinutes > 10 ? 'offline' : pc.status,
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
      const lastSeen = new Date(pc.lastSeen);
      const diffMinutes = (now.getTime() - lastSeen.getTime()) / 60000;
      const status = diffMinutes > 10 ? 'offline' : pc.status;
      const isRoomLocked = !!(labStates[pc.room]?.locked || labStates['ALL']?.locked);
      const isRoomExam = !!(labStates[pc.room]?.exam_mode || labStates['ALL']?.exam_mode);
      res.json({ 
        ...pc, 
        status,
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
