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
  app.use(bodyParser.json());

  // Generate 10 labs with 25 PCs each
  const generateMockData = () => {
    const labs = ['801', '802', '803', '804', '805', '806', '807', '808', '809', '810'];
    const pcs: any[] = [];
    const mockIssues: any[] = [];
    const mockSchedules: any = {};
    const mockSharedFiles: Record<string, any[]> = {};
    const mockCollectedFiles: Record<string, any[]> = {};
    
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
    
    return { pcs, mockIssues, mockSchedules, mockSharedFiles, mockCollectedFiles };
  };

  let initialData = generateMockData();
  let connectedPCs: any[] = initialData.pcs;
  let issues: any[] = initialData.mockIssues;
  let schedules: any = initialData.mockSchedules;
  let tasks: any[] = [];
  let sharedFiles: Record<string, any[]> = initialData.mockSharedFiles;
  let collectedFiles: Record<string, any[]> = initialData.mockCollectedFiles;

  // API to receive pings from the PowerShell Agent
  app.post('/api/agent/ping', (req, res) => {
    const pcData = req.body;
    if (!pcData || !pcData.ip) {
      return res.status(400).json({ success: false, error: 'IP address is required' });
    }

    const now = new Date();
    const existingIndex = connectedPCs.findIndex(pc => pc.ip === pcData.ip);

    if (existingIndex > -1) {
      // Preserve existing state (room, locked, exam_mode, etc.)
      // We explicitly prevent the agent from overwriting teacher-controlled states
      // unless the agent explicitly confirms a state change.
      const existingPc = connectedPCs[existingIndex];
      connectedPCs[existingIndex] = {
        ...existingPc,
        ...pcData,
        id: existingPc.id, // Never overwrite ID
        room: pcData.room || existingPc.room, // Don't let agent clear the room
        locked: existingPc.locked, // Teacher controls this, not agent ping
        exam_mode: existingPc.exam_mode, // Teacher controls this
        needs_help: existingPc.needs_help, // Student controls this via UI
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
        room: pcData.room || 'Unknown',
        locked: false,
        exam_mode: false,
        needs_help: false,
        cpu_usage: pcData.cpu_usage || 0,
        ram_usage: pcData.ram_usage || 0
      };
      connectedPCs.push(pcEntry);
    }

    const pcId = pcData.ip.replace(/\./g, '-');
    const pendingTasks = tasks.filter(t => t.pc_id === pcId || t.pc_id === 'ALL');

    res.json({ success: true, message: 'Ping received', tasks: pendingTasks });
  });

  // API to get all connected PCs
  app.get('/api/pcs', (req, res) => {
    const now = new Date();
    const updatedPCs = connectedPCs.map(pc => {
      const lastSeen = new Date(pc.lastSeen);
      const diffMinutes = (now.getTime() - lastSeen.getTime()) / 60000;
      
      // For demo purposes, keep non-offline PCs alive
      if (pc.status !== 'offline' && diffMinutes > 5) {
        pc.lastSeen = now.toISOString();
        return { ...pc };
      }

      return {
        ...pc,
        status: diffMinutes > 10 ? 'offline' : pc.status
      };
    });
    res.json(updatedPCs);
  });

  // API to get a single PC by ID
  app.get('/api/pcs/:id', (req, res) => {
    const pc = connectedPCs.find(p => p.id === req.params.id);
    if (pc) {
      const now = new Date();
      const lastSeen = new Date(pc.lastSeen);
      const diffMinutes = (now.getTime() - lastSeen.getTime()) / 60000;
      const status = diffMinutes > 10 ? 'offline' : pc.status;
      res.json({ ...pc, status });
    } else {
      res.status(404).json({ error: 'PC not found' });
    }
  });

  // Teacher Actions API
  app.post('/api/labs/:room/teacher-action', (req, res) => {
    const { room } = req.params;
    const { action } = req.body;
    
    connectedPCs.forEach(pc => {
      if (pc.room === room) {
        if (action === 'lock') pc.locked = true;
        if (action === 'unlock') pc.locked = false;
        if (action === 'exam_on') pc.exam_mode = true;
        if (action === 'exam_off') pc.exam_mode = false;
      }
    });
    res.json({ success: true, message: `Action ${action} applied to room ${room}` });
  });

  // File Sharing API
  app.post('/api/labs/:room/share-file', (req, res) => {
    const { room } = req.params;
    const { filename, size } = req.body;
    
    if (!sharedFiles[room]) {
      sharedFiles[room] = [];
    }
    
    const newFile = {
      id: Date.now().toString(),
      filename,
      size,
      shared_at: new Date().toISOString()
    };
    
    sharedFiles[room].push(newFile);
    res.json({ success: true, file: newFile });
  });

  app.get('/api/labs/:room/files', (req, res) => {
    const { room } = req.params;
    res.json(sharedFiles[room] || []);
  });

  // File Collection API (Student to Teacher)
  app.post('/api/labs/:room/submit-file', (req, res) => {
    const { room } = req.params;
    const { pc_id, filename, size } = req.body;
    
    if (!collectedFiles[room]) {
      collectedFiles[room] = [];
    }
    
    const newFile = {
      id: Date.now().toString(),
      pc_id,
      filename,
      size,
      submitted_at: new Date().toISOString()
    };
    
    collectedFiles[room].push(newFile);
    res.json({ success: true, file: newFile });
  });

  app.get('/api/labs/:room/collected-files', (req, res) => {
    const { room } = req.params;
    res.json(collectedFiles[room] || []);
  });

  // Student Actions API
  app.post('/api/pcs/:id/student-action', (req, res) => {
    const { id } = req.params;
    const { action } = req.body;
    
    const pc = connectedPCs.find(p => p.id === id);
    if (pc) {
      if (action === 'help') pc.needs_help = true;
      if (action === 'resolve_help') pc.needs_help = false;
      res.json({ success: true, message: `Action ${action} applied to PC ${id}` });
    } else {
      res.status(404).json({ error: 'PC not found' });
    }
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
      tasks.push({
        id: Math.random().toString(36).substr(2, 9),
        pc_id: pc.id,
        action: 'broadcast',
        message: message
      });
    });
    res.json({ success: true });
  });

  // API to toggle Exam Mode
  app.post('/api/exam-mode', (req, res) => {
    const { enabled } = req.body;
    settings.examModeEnabled = enabled;
    
    connectedPCs.forEach(pc => {
      tasks.push({
        id: Math.random().toString(36).substr(2, 9),
        pc_id: pc.id,
        action: enabled ? 'enable_exam_mode' : 'disable_exam_mode'
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

  // API to queue a task
  app.post('/api/tasks', (req, res) => {
    const task = {
      id: Math.random().toString(36).substr(2, 9),
      ...req.body
    };
    tasks.push(task);
    res.json({ success: true, task });
  });

  // API to mark a task as complete
  app.post('/api/tasks/:id/complete', (req, res) => {
    // For simplicity, we just remove the task once completed.
    tasks = tasks.filter(t => t.id !== req.params.id);
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

    tasks.push({
      id: Math.random().toString(36).substr(2, 9),
      pc_id: req.params.id,
      action: action
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

      tasks.push({
        id: Math.random().toString(36).substr(2, 9),
        pc_id: pc.id,
        action: action
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
    tasks = [];
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
        tasks.push({
          id: Math.random().toString(36).substr(2, 9),
          pc_id: pc.id,
          action: 'shutdown',
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
