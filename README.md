# LabMonitor Pro - Centralized University Lab Monitoring System

LabMonitor Pro is a centralized university computer laboratory monitoring and management web platform. Designed for academic environments, it enables real-time hardware performance tracking, automated agent polling, screen locking, exam mode enforcement, and remote power actions across multiple lab workstations.

---

## 🚀 Key Features

* **Multi-Role Access & Dashboards:**
  * **Admin Panel:** Global system overview, room configuration, schedule management, ticket resolving, and demo state management.
  * **Teacher Dashboard:** Real-time grid view of all workstations in a selected lab, one-click screen locking, exam mode toggle, broadcast messages, file collection/sharing, and bulk power management (**Wake All** / **Shutdown All**).
  * **Student Station:** Station-specific status view, help request triggers, assignment file submissions, shared file downloads, and automated "Powered Off" or "Screen Locked" overlays.

* **Remote Power Management:**
  * Individual and room-wide **Power On (Wake-on-LAN)** and **Shutdown** actions to conserve energy and manage lab operations.

* **Real-time Hardware & Software Telemetry:**
  * Live monitoring of CPU utilization, RAM usage, Disk space, network connectivity, and installed application inventories via lightweight background agent pings.

* **Lightweight Client Agent (`agent.ps1`):**
  * Standalone PowerShell background script for Windows workstations—no Node.js runtime required on client PCs.

---

## 🛠️ Tech Stack

* **Frontend:** React 19, TypeScript, Tailwind CSS v4, Lucide Icons, Motion (Framer Motion), Recharts.
* **Backend:** Express.js, Vite Middleware, Node.js.
* **Client Agent:** Windows PowerShell (`Invoke-RestMethod`, WMI/CIM).

---

## 💻 Installation & Setup

### Prerequisites
* **Node.js**: v18.x or higher installed on the main server PC ([Download Node.js](https://nodejs.org/)).

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Start Development Server
```bash
npm run dev
```

### Step 3: Access Application
Open your browser and navigate to:
```http
http://localhost:3000
```

---

## 🔑 Login Credentials (Demo Roles)

| Role | Default Access / Password | Capabilities |
|---|---|---|
| **Admin** | Password: `admin123` | System settings, room setup, ticketing, global controls. |
| **Teacher** | Password: `teacher123` (Select Room) | Active lab monitoring, screen lock, exam mode, file sharing. |
| **Student** | Select PC Station | Station view, ask for help, submit assignments. |

---

## 🖥️ Workstation Agent Deployment (`agent.ps1`)

Student PCs do **not** require the web application files or Node.js. Only the lightweight PowerShell agent script is required.

1. Obtain the Server IP address using `ipconfig` on the host machine.
2. Navigate to the **Agent Setup** tab in the web platform.
3. Update `$serverUrl` in `agent.ps1` with the server IP address (e.g., `http://192.168.1.100:3000/api/agent/ping`).
4. Execute `agent.ps1` with Administrator privileges on client workstations.

---

## 📄 License
Distributed under the MIT License. See `LICENSE` for more information.
