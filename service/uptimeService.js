"use strict";
const snmp = require('net-snmp');

function formatSeconds(totalSeconds) {
  const d = Math.floor(totalSeconds / 86400);
  const h = Math.floor((totalSeconds % 86400) / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  const parts = [];
  if (d) parts.push(`${d} hari`);
  parts.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
  return parts.join(' ');
}

/**
 * Dapatkan uptime lewat SNMP sysUpTime (1.3.6.1.2.1.1.3.0)
 * @param {string} ip host/IP
 * @param {{community?: string, timeoutMs?: number}} [opts]
 * @returns {Promise<{ok: true, seconds: number, formatted: string, source: 'snmp'} | {ok:false, error:string}>}
 */
async function getUptimeByIp(ip, opts = {}) {
  const community = opts.community || process.env.SNMP_COMMUNITY || 'public';
  const timeout = Number(process.env.SNMP_TIMEOUT_MS || opts.timeoutMs || 3000);
  const retries = Number(process.env.SNMP_RETRIES || opts.retries || 1);
  const options = { version: snmp.Version2c, timeout, retries };
  const session = snmp.createSession(ip, community, options);
  const oid = '1.3.6.1.2.1.1.3.0';

  try {
    const varbinds = await new Promise((resolve, reject) => {
      session.get([oid], (error, vb) => {
        if (error) return reject(error);
        return resolve(vb);
      });
    });
    if (!varbinds || !varbinds.length) throw new Error('No varbinds');
    const vb = varbinds[0];
    if (snmp.isVarbindError(vb)) throw new Error(snmp.varbindError(vb));
    const ticks = Number(vb.value); // TimeTicks in hundredths of seconds
    const seconds = Math.floor(ticks / 100);
    const formatted = formatSeconds(seconds);
    return { ok: true, seconds, formatted, source: 'snmp' };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  } finally {
    try { session.close(); } catch (_) {}
  }
}

module.exports = { getUptimeByIp };
