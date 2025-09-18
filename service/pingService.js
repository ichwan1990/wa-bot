const ping = require('ping');

/**
 * Melakukan ping dan mengembalikan hasil terstruktur.
 * @param {string} targetIP
 * @param {string} [serverName]
 * @returns {Promise<{serverName:string,targetIP:string,alive:boolean,min:number|null,max:number|null,avg:number|null,packetLoss:number|null}>}
 */
async function probePing(targetIP, serverName) {
    const name = serverName && String(serverName).trim() ? String(serverName).trim() : '-';
    try {
        const res = await ping.promise.probe(targetIP, {
            timeout: 2,
            extra: process.platform === 'win32' ? ['-n', '3'] : ['-c', '3']
        });
        return {
            serverName: name,
            targetIP,
            alive: !!res.alive,
            min: isFinite(Number(res.min)) ? Number(res.min) : null,
            max: isFinite(Number(res.max)) ? Number(res.max) : null,
            avg: isFinite(Number(res.avg)) ? Number(res.avg) : null,
            packetLoss: isFinite(Number(res.packetLoss)) ? Number(res.packetLoss) : (typeof res.packetLoss === 'string' ? Number(res.packetLoss.replace('%','')) : null)
        };
    } catch (_) {
        return { serverName: name, targetIP, alive: false, min: null, max: null, avg: null, packetLoss: null };
    }
}

/**
 * Backward-compatible: kembalikan string siap kirim untuk satu target.
 */
async function checkPing(targetIP, serverName) {
    const r = await probePing(targetIP, serverName);
    const statusIcon = r.alive ? '✅' : '❌';
    if (!r.alive) return `🔹 *${r.serverName}* (${r.targetIP})\n❌ *Status:* Unreachable`;
    return `🔹 *${r.serverName}* (${r.targetIP})\n${statusIcon} *Status:* Alive\n⏱️ *Min Time:* ${r.min} ms\n⏳ *Max Time:* ${r.max} ms\n📊 *Avg Time:* ${r.avg} ms\n📉 *Packet Loss:* ${r.packetLoss} %`;
}

module.exports = { checkPing, probePing };
