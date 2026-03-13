import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'labmonitor.db');
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS pcs (
    id TEXT PRIMARY KEY, -- Format: Room-IP (e.g., 809-192.168.1.1)
    room TEXT NOT NULL,
    ip TEXT NOT NULL,
    status TEXT DEFAULT 'offline', -- 'online' | 'offline' | 'issue'
    has_internet BOOLEAN DEFAULT 0,
    cpu_usage INTEGER DEFAULT 0,
    ram_usage INTEGER DEFAULT 0,
    disk_usage INTEGER DEFAULT 0,
    last_seen DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS software (
    pc_id TEXT NOT NULL,
    name TEXT NOT NULL,
    version TEXT,
    PRIMARY KEY (pc_id, name),
    FOREIGN KEY (pc_id) REFERENCES pcs(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS issues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pc_id TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT DEFAULT 'open', -- 'open' | 'resolved'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pc_id) REFERENCES pcs(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pc_id TEXT NOT NULL, -- specific PC ID, or 'ALL'
    action TEXT NOT NULL, -- e.g., 'install_software'
    target TEXT NOT NULL, -- e.g., 'Google Chrome'
    status TEXT DEFAULT 'pending', -- 'pending' | 'completed' | 'failed'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Seed initial data if empty (10 Labs, 25 PCs each)
const count = db.prepare('SELECT COUNT(*) as c FROM pcs').get() as { c: number };

if (count.c === 0) {
  console.log('Seeding initial lab data...');
  const insertPc = db.prepare('INSERT INTO pcs (id, room, ip, status, has_internet, cpu_usage, ram_usage, disk_usage, last_seen) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
  const insertSoftware = db.prepare('INSERT INTO software (pc_id, name, version) VALUES (?, ?, ?)');
  
  const labs = ['801', '802', '803', '804', '805', '806', '807', '808', '809', '810'];
  const commonSoftware = [
    { name: 'Google Chrome', version: '122.0.6261.95' },
    { name: 'Visual Studio Code', version: '1.87.0' },
    { name: 'Python', version: '3.11.5' },
    { name: 'Java SE Development Kit', version: '17.0.2' },
    { name: 'Git', version: '2.43.0' }
  ];

  db.transaction(() => {
    for (const room of labs) {
      for (let i = 1; i <= 25; i++) {
        const ip = `192.168.${parseInt(room) % 255}.${i}`;
        const id = `${room}-${ip}`;
        
        // Randomize initial state for demonstration
        const isOnline = Math.random() > 0.3; // 70% online
        const hasInternet = isOnline ? (Math.random() > 0.1 ? 1 : 0) : 0; // 90% of online have internet
        const status = isOnline ? (hasInternet ? 'online' : 'issue') : 'offline';
        
        const cpu = isOnline ? Math.floor(Math.random() * 80) + 5 : 0;
        const ram = isOnline ? Math.floor(Math.random() * 90) + 10 : 0;
        const disk = Math.floor(Math.random() * 95) + 20; // Disk is static even if offline
        
        // Random last seen within last 24 hours if offline
        const lastSeen = isOnline 
          ? new Date().toISOString() 
          : new Date(Date.now() - Math.floor(Math.random() * 86400000)).toISOString();

        insertPc.run(id, room, ip, status, hasInternet, cpu, ram, disk, lastSeen);

        // Add software
        for (const sw of commonSoftware) {
          // Randomly skip some software to simulate missing installations
          if (Math.random() > 0.1) {
            insertSoftware.run(id, sw.name, sw.version);
          }
        }
      }
    }
  })();
  console.log('Seeding complete: 250 PCs added.');
}

export default db;
