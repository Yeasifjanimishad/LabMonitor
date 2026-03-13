import db from './src/lib/db.js';
try {
  const pcs = db.prepare("SELECT * FROM pcs ORDER BY room, CAST(SUBSTR(ip, INSTR(ip, '.') + 1) AS INTEGER)").all();
  console.log("PCs found:", pcs.length);
} catch (e) {
  console.error("Error:", e);
}
