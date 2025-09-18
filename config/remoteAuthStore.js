const mysql = require('mysql2/promise');
const { db } = require('./db_simplus');
// db_simplus exports a mysql2 callback pool; we also need a promise pool for async/await usage
const promisePool = db.promise ? db.promise() : mysql.createPool({
  host: process.env.DB_HOST_SIMPLUS,
  user: process.env.DB_USER_SIMPLUS,
  password: process.env.DB_PASSWORD_SIMPLUS,
  database: process.env.DB_NAME_SIMPLUS,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Tabel yang dibutuhkan:
// CREATE TABLE IF NOT EXISTS wwebjs_sessions (
//   client_id VARCHAR(64) PRIMARY KEY,
//   session_json LONGTEXT NOT NULL,
//   updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
// ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

class MySQLRemoteAuthStore {
  constructor() {
    this.pool = promisePool;
  }

  async sessionExists(arg) {
    const key = (arg && (arg.clientId || arg.session)) || arg;
    const [rows] = await this.pool.query('SELECT client_id FROM wwebjs_sessions WHERE client_id = ? LIMIT 1', [key]);
    return rows.length > 0;
  }

  async save(arg) {
    // whatsapp-web.js RemoteAuth calls save({ session }) after creating `${session}.zip` on disk.
    const key = arg.clientId || arg.session;
    const fs = require('fs');
    const path = require('path');
    const zipPath = path.resolve(process.cwd(), `${key}.zip`);
    const zipBuffer = await fs.promises.readFile(zipPath);

    // Store base64 for portability
    const toStore = zipBuffer.toString('base64');
    await this.pool.query(
      'INSERT INTO wwebjs_sessions (client_id, session_json) VALUES (?, ?) ON DUPLICATE KEY UPDATE session_json = VALUES(session_json), updated_at = CURRENT_TIMESTAMP',
      [key, toStore]
    );
  }

  async load(arg) {
    // This method is not used by RemoteAuth, but keep a resilient implementation for debugging/tools
    const key = arg.clientId || arg.session || arg;
    const [rows] = await this.pool.query('SELECT session_json FROM wwebjs_sessions WHERE client_id = ? LIMIT 1', [key]);
    if (!rows.length) return null;
    const raw = rows[0].session_json;
    // Try best-effort decode
    try {
      // Try JSON first (legacy storage)
      const obj = JSON.parse(raw);
      if (obj && obj.type === 'Buffer' && Array.isArray(obj.data)) {
        return Buffer.from(obj.data);
      }
      if (obj && typeof obj.data === 'string') {
        return Buffer.from(obj.data, 'base64');
      }
      return obj;
    } catch (_) {
      // Not JSON; assume base64 string
      try { return Buffer.from(raw, 'base64'); } catch (_) { return null; }
    }
  }

  async remove(arg) {
    const key = arg.clientId || arg.session || arg;
    await this.pool.query('DELETE FROM wwebjs_sessions WHERE client_id = ?', [key]);
  }

  // Alias often used by RemoteAuth implementations
  async delete(arg) {
    return this.remove(arg);
  }

  // Write the stored ZIP buffer to the provided file path (NOT unzip here)
  async extract(arg) {
    const session = arg.clientId || arg.session || arg;
    const filePath = arg.path || arg.filePath || arg.target; // whatsapp-web.js passes `{ path: `${session}.zip` }`
    if (!session || !filePath) return false;

    const [rows] = await this.pool.query('SELECT session_json FROM wwebjs_sessions WHERE client_id = ? LIMIT 1', [session]);
    if (!rows.length) return false;

    const raw = rows[0].session_json;

    // Rebuild Buffer from stored value (base64 string or JSONified Buffer)
    const toBuffer = (val) => {
      if (!val) return null;
      if (Buffer.isBuffer(val)) return val;
      if (typeof val === 'string') {
        // If string, assume base64
        try { return Buffer.from(val, 'base64'); } catch { /* ignore */ }
        // Fallback: try parse then continue
        try {
          const parsed = JSON.parse(val);
          return toBuffer(parsed);
        } catch { return null; }
      }
      if (val && val.type === 'Buffer' && Array.isArray(val.data)) {
        return Buffer.from(val.data);
      }
      if (val && typeof val.data === 'string') {
        try { return Buffer.from(val.data, 'base64'); } catch { return null; }
      }
      return null;
    };

    const zipBuffer = toBuffer(raw);
    const fs = require('fs');
    const path = require('path');
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });

    const isZip = (buf) => buf && buf.length > 4 && buf[0] === 0x50 && buf[1] === 0x4b; // 'PK'

    if (!zipBuffer || !zipBuffer.length || !isZip(zipBuffer)) {
      console.warn('RemoteAuthStore.extract: stored data is not a valid zip. Writing empty zip to allow fresh login.');
      try {
        const AdmZip = require('adm-zip');
        const empty = new AdmZip();
        const emptyBuf = empty.toBuffer();
        await fs.promises.writeFile(filePath, emptyBuf);
        return true;
      } catch (e) {
        console.error('Failed to write empty zip fallback:', e);
        return false;
      }
    }

    await fs.promises.writeFile(filePath, zipBuffer);
    return true;
  }
}

async function deleteRemoteSession(clientId) {
  const [result] = await promisePool.query('DELETE FROM wwebjs_sessions WHERE client_id = ?', [clientId]);
  return result.affectedRows > 0;
}

module.exports = { MySQLRemoteAuthStore, deleteRemoteSession };
