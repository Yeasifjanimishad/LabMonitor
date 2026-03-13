import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import db from './src/lib/db.js';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // --- API Routes ---

  // 1. Dashboard Stats
  app.get('/api/stats', (req, res) => {
    const total = (db.prepare('SELECT COUNT(*) as c FROM pcs').get() as any).c;
    const online = (db.prepare("SELECT COUNT(*) as c FROM pcs WHERE status = 'online'").get() as any).c;
    const offline = (db.prepare("SELECT COUNT(*) as c FROM pcs WHERE status = 'offline'").get() as any).c;
    const issues = (db.prepare("SELECT COUNT(*) as c FROM pcs WHERE status = 'issue' OR has_internet = 0").get() as any).c;
    
    res.json({ total, online, offline, issues });
  });

  // 2. Get all labs and their PCs
  app.get('/api/labs', (req, res) => {
    try {
      const pcs = db.prepare("SELECT * FROM pcs ORDER BY room, CAST(SUBSTR(ip, INSTR(ip, '.') + 1) AS INTEGER)").all();
      
      // Group by room
      const labs = pcs.reduce((acc: any, pc: any) => {
        if (!acc[pc.room]) acc[pc.room] = [];
        acc[pc.room].push(pc);
        return acc;
      }, {});

      res.json(labs);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to fetch labs' });
    }
  });

  // 3. Get specific PC details (including software and issues)
  app.get('/api/pcs/:id', (req, res) => {
    const pc = db.prepare('SELECT * FROM pcs WHERE id = ?').get(req.params.id);
    if (!pc) return res.status(404).json({ error: 'PC not found' });

    const software = db.prepare('SELECT name, version FROM software WHERE pc_id = ? ORDER BY name').all(req.params.id);
    const issues = db.prepare('SELECT * FROM issues WHERE pc_id = ? ORDER BY created_at DESC').all(req.params.id);

    res.json({ ...pc, software, issues });
  });

  // 4. Agent Ping (Windows PowerShell script sends data here)
  app.post('/api/agent/ping', (req, res) => {
    const { room, ip, has_internet, cpu_usage, ram_usage, disk_usage, software } = req.body;
    
    if (!room || !ip) return res.status(400).json({ error: 'Room and IP required' });

    const id = `${room}-${ip}`;
    const status = has_internet ? 'online' : 'issue';
    const last_seen = new Date().toISOString();

    // Upsert PC
    const stmt = db.prepare(`
      INSERT INTO pcs (id, room, ip, status, has_internet, cpu_usage, ram_usage, disk_usage, last_seen)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        status = excluded.status,
        has_internet = excluded.has_internet,
        cpu_usage = excluded.cpu_usage,
        ram_usage = excluded.ram_usage,
        disk_usage = excluded.disk_usage,
        last_seen = excluded.last_seen
    `);
    
    stmt.run(id, room, ip, status, has_internet ? 1 : 0, cpu_usage, ram_usage, disk_usage, last_seen);

    // Update software if provided
    if (software && Array.isArray(software)) {
      db.transaction(() => {
        db.prepare('DELETE FROM software WHERE pc_id = ?').run(id);
        const insertSw = db.prepare('INSERT INTO software (pc_id, name, version) VALUES (?, ?, ?)');
        for (const sw of software) {
          insertSw.run(id, sw.name, sw.version);
        }

        // Check for blacklisted software
        const BLACKLIST = ['Valorant', 'Steam', 'Epic Games Launcher', 'BitTorrent', 'uTorrent'];
        const blacklisted = software.filter(sw => BLACKLIST.includes(sw.name));
        if (blacklisted.length > 0) {
          const desc = `Blacklisted software detected: ${blacklisted.map(s => s.name).join(', ')}`;
          const existing = db.prepare("SELECT id FROM issues WHERE pc_id = ? AND description = ? AND status = 'open'").get(id, desc);
          if (!existing) {
            db.prepare('INSERT INTO issues (pc_id, description) VALUES (?, ?)').run(id, desc);
            db.prepare("UPDATE pcs SET status = 'issue' WHERE id = ?").run(id);
          }
        }
      })();
    }

    // Fetch pending tasks for this PC or ALL PCs
    const tasks = db.prepare("SELECT * FROM tasks WHERE (pc_id = ? OR pc_id = 'ALL') AND status = 'pending'").all(id);

    res.json({ success: true, message: 'Ping received', tasks });
  });

  // 5. Submit an issue manually
  app.post('/api/issues', (req, res) => {
    const { pc_id, description } = req.body;
    if (!pc_id || !description) return res.status(400).json({ error: 'Missing fields' });

    db.prepare('INSERT INTO issues (pc_id, description) VALUES (?, ?)').run(pc_id, description);
    db.prepare("UPDATE pcs SET status = 'issue' WHERE id = ?").run(pc_id);
    
    res.json({ success: true });
  });

  // 5.1 Get all issues
  app.get('/api/issues', (req, res) => {
    try {
      const issues = db.prepare('SELECT * FROM issues ORDER BY created_at DESC').all();
      res.json(issues);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to fetch issues' });
    }
  });

  // 5.2 Resolve a specific issue by ID
  app.post('/api/issues/:id/resolve', (req, res) => {
    try {
      const issueId = req.params.id;
      const issue = db.prepare('SELECT pc_id FROM issues WHERE id = ?').get(issueId) as any;
      if (!issue) return res.status(404).json({ error: 'Issue not found' });

      db.prepare("UPDATE issues SET status = 'resolved' WHERE id = ?").run(issueId);
      
      // Check if PC has any other open issues
      const openIssues = db.prepare("SELECT COUNT(*) as c FROM issues WHERE pc_id = ? AND status = 'open'").get(issue.pc_id) as any;
      if (openIssues.c === 0) {
        db.prepare("UPDATE pcs SET status = CASE WHEN has_internet = 1 THEN 'online' ELSE 'offline' END WHERE id = ?").run(issue.pc_id);
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to resolve issue' });
    }
  });

  // 5.5 Resolve issues for a PC
  app.post('/api/pcs/:id/resolve', (req, res) => {
    try {
      const pcId = req.params.id;
      db.prepare("UPDATE issues SET status = 'resolved' WHERE pc_id = ?").run(pcId);
      // Re-evaluate status based on internet connectivity
      db.prepare("UPDATE pcs SET status = CASE WHEN has_internet = 1 THEN 'online' ELSE 'offline' END WHERE id = ?").run(pcId);
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to resolve issue' });
    }
  });

  // 6. Queue a new task (e.g., install software)
  app.post('/api/tasks', (req, res) => {
    const { pc_id, action, target } = req.body;
    if (!pc_id || !action || !target) return res.status(400).json({ error: 'Missing fields' });

    db.prepare('INSERT INTO tasks (pc_id, action, target) VALUES (?, ?, ?)').run(pc_id, action, target);
    res.json({ success: true });
  });

  // 6.5 Get all tasks
  app.get('/api/tasks', (req, res) => {
    try {
      const tasks = db.prepare('SELECT * FROM tasks ORDER BY created_at DESC LIMIT 50').all();
      res.json(tasks);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to fetch tasks' });
    }
  });

  // 7. Mark a task as completed
  app.post('/api/tasks/:id/complete', (req, res) => {
    db.prepare("UPDATE tasks SET status = 'completed' WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  // 8. Power Management
  app.post('/api/pcs/:id/power', (req, res) => {
    const { action } = req.body; // 'shutdown', 'restart', 'wake'
    const pcId = req.params.id;
    
    try {
      if (action === 'wake') {
        db.prepare("UPDATE pcs SET status = 'online', has_internet = 1 WHERE id = ?").run(pcId);
      } else if (action === 'shutdown' || action === 'restart') {
        db.prepare("UPDATE pcs SET status = 'offline', has_internet = 0 WHERE id = ?").run(pcId);
      }
      // Log as a task
      db.prepare("INSERT INTO tasks (pc_id, action, target) VALUES (?, ?, ?)").run(pcId, 'power', action);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Power action failed' });
    }
  });

  app.post('/api/labs/:room/power', (req, res) => {
    const { action } = req.body; // 'shutdown', 'wake'
    const room = req.params.room;
    
    try {
      if (action === 'wake') {
        db.prepare("UPDATE pcs SET status = 'online', has_internet = 1 WHERE room = ?").run(room);
      } else if (action === 'shutdown') {
        db.prepare("UPDATE pcs SET status = 'offline', has_internet = 0 WHERE room = ?").run(room);
      }
      db.prepare("INSERT INTO tasks (pc_id, action, target) VALUES (?, ?, ?)").run('ALL', 'power_room', `${room}:${action}`);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Room power action failed' });
    }
  });

  // 9. Class Schedules (Mock Data)
  app.get('/api/schedules', (req, res) => {
    const schedules = {
      '801': { class: 'CSE 321 - Software Engineering', teacher: 'Dr. Smith', time: '10:00 AM - 11:30 AM' },
      '802': { class: 'CSE 411 - Computer Networks', teacher: 'Prof. Johnson', time: '11:30 AM - 01:00 PM' },
      '803': { class: 'CSE 211 - Data Structures', teacher: 'Mr. Davis', time: '09:00 AM - 10:30 AM' },
      '804': { class: 'CSE 311 - Database Systems', teacher: 'Dr. Wilson', time: '02:00 PM - 03:30 PM' },
    };
    res.json(schedules);
  });

  // --- Vite Middleware ---
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
