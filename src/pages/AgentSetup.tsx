import { Terminal, Copy, CheckCircle2, Server, Code2 } from 'lucide-react';
import { useState } from 'react';
import { motion } from 'motion/react';

export default function AgentSetup() {
  const [copied, setCopied] = useState(false);

  // The PowerShell script that students/admins will run on the lab PCs
  const scriptContent = `# LabMonitor Pro - Windows Agent
# Run this script as Administrator on lab PCs

$serverUrl = "http://YOUR_SERVER_IP:3000/api/agent/ping"
$roomNumber = "809" # Change this per lab

function Get-InstalledSoftware {
    $keys = @("HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*", 
              "HKLM:\\Software\\Wow6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*")
    Get-ItemProperty $keys -ErrorAction SilentlyContinue | 
    Where-Object { $_.DisplayName -and $_.DisplayVersion } | 
    Select-Object @{Name="name";Expression={$_.DisplayName}}, @{Name="version";Expression={$_.DisplayVersion}} |
    Select-Object -Unique -First 10 # Limiting to 10 for demo purposes
}

function Check-Internet {
    try {
        $response = Invoke-WebRequest -Uri "http://www.google.com" -UseBasicParsing -TimeoutSec 3
        return $true
    } catch {
        return $false
    }
}

while ($true) {
    try {
        $ip = (Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias Wi-Fi,Ethernet -ErrorAction SilentlyContinue | Select-Object -First 1).IPAddress
        
        $cpu = Get-WmiObject Win32_Processor | Measure-Object -Property LoadPercentage -Average | Select-Object -ExpandProperty Average
        $os = Get-WmiObject Win32_OperatingSystem
        $ram = [math]::Round((($os.TotalVisibleMemorySize - $os.FreePhysicalMemory) / $os.TotalVisibleMemorySize) * 100)
        
        $disk = Get-WmiObject Win32_LogicalDisk -Filter "DeviceID='C:'"
        $diskUsage = [math]::Round((($disk.Size - $disk.FreeSpace) / $disk.Size) * 100)
        
        $hasInternet = Check-Internet
        $software = Get-InstalledSoftware

        $payload = @{
            room = $roomNumber
            ip = $ip
            has_internet = $hasInternet
            cpu_usage = $cpu
            ram_usage = $ram
            disk_usage = $diskUsage
            software = $software
        } | ConvertTo-Json -Depth 3

        $response = Invoke-RestMethod -Uri $serverUrl -Method Post -Body $payload -ContentType "application/json" -ErrorAction SilentlyContinue
        
        Write-Host "Ping sent successfully for IP: $ip" -ForegroundColor Green

        # Handle pending tasks
        if ($response -and $response.tasks) {
            foreach ($task in $response.tasks) {
                if ($task.action -eq "install_software") {
                    Write-Host "Installing $($task.target)..." -ForegroundColor Cyan
                    
                    # Using winget to install software silently
                    # Note: winget must be installed on the system
                    $process = Start-Process -FilePath "winget" -ArgumentList "install --exact --id \`"$($task.target)\`" --silent --accept-package-agreements --accept-source-agreements" -Wait -NoNewWindow -PassThru
                    
                    if ($process.ExitCode -eq 0) {
                        Write-Host "Successfully installed $($task.target)" -ForegroundColor Green
                        # Notify server task is complete
                        $completeUrl = $serverUrl.Replace("/agent/ping", "/tasks/$($task.id)/complete")
                        Invoke-RestMethod -Uri $completeUrl -Method Post -ErrorAction SilentlyContinue
                    } else {
                        Write-Host "Failed to install $($task.target)" -ForegroundColor Red
                    }
                }
            }
        }
    } catch {
        Write-Host "Failed to send ping: $_" -ForegroundColor Red
    }
    
    # Wait 5 minutes before next ping
    Start-Sleep -Seconds 300
}
`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(scriptContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
            Agent Setup
          </h1>
          <p className="text-slate-400 mt-4 text-lg max-w-2xl leading-relaxed">
            Deploy this PowerShell script to the lab PCs to start monitoring them. The script runs silently in the background and reports status back to this dashboard.
          </p>
        </div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="bg-slate-900/80 backdrop-blur-xl border border-slate-800/50 rounded-3xl overflow-hidden shadow-2xl"
      >
        <div className="p-5 border-b border-slate-800/50 bg-slate-950/50 flex items-center justify-between">
          <div className="flex items-center gap-3 text-slate-300 font-mono text-sm font-medium">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
              <Code2 className="w-4 h-4 text-indigo-400" />
            </div>
            agent.ps1
          </div>
          <button
            onClick={copyToClipboard}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 rounded-xl text-sm font-bold transition-all hover:scale-105 active:scale-95"
          >
            {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied!' : 'Copy Script'}
          </button>
        </div>
        <div className="p-6 overflow-x-auto bg-[#0d1117]">
          <pre className="text-sm font-mono text-emerald-400 leading-relaxed">
            <code>{scriptContent}</code>
          </pre>
        </div>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="bg-gradient-to-br from-indigo-900/20 to-slate-900 border border-indigo-500/20 rounded-3xl p-8 shadow-xl relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 blur-3xl rounded-full pointer-events-none" />
        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <Server className="w-5 h-5 text-indigo-400" />
          Deployment Instructions
        </h3>
        <ol className="list-decimal list-inside space-y-3 text-slate-300 text-base leading-relaxed">
          <li>Copy the script above using the button.</li>
          <li>Change the <code className="text-indigo-300 bg-indigo-500/20 px-2 py-0.5 rounded-md font-mono text-sm">YOUR_SERVER_IP</code> to the IP address where this dashboard is hosted.</li>
          <li>Change the <code className="text-indigo-300 bg-indigo-500/20 px-2 py-0.5 rounded-md font-mono text-sm">$roomNumber</code> to the correct lab room (e.g., "809").</li>
          <li>Save it as <code className="text-indigo-300 bg-indigo-500/20 px-2 py-0.5 rounded-md font-mono text-sm">agent.ps1</code> on the lab PC.</li>
          <li>Run it using PowerShell as Administrator. You can set it up in Windows Task Scheduler to run automatically on startup.</li>
        </ol>
      </motion.div>
    </motion.div>
  );
}
