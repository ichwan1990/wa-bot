const ping = require('ping');

async function checkPing(targetIP, serverName) {
    serverName = serverName && serverName.trim() ? serverName : '-';
    return new Promise((resolve) => {
        ping.promise.probe(targetIP, {
            timeout: 2,
            extra: process.platform === 'win32' ? ['-n', '3'] : ['-c', '3'] // Windows: -n, Linux/Mac: -c
        }).then((res) => {
            const statusIcon = res.alive ? '✅' : '❌';
            const msg = `🔹 *${serverName}* (${targetIP})\n${statusIcon} *Status:* ${res.alive ? 'Alive' : 'Dead'}\n⏱️ *Min Time:* ${res.min} ms\n⏳ *Max Time:* ${res.max} ms\n📊 *Avg Time:* ${res.avg} ms\n📉 *Packet Loss:* ${res.packetLoss} %`;
            resolve(msg);
        }).catch(() => {
            resolve(`🔹 *${serverName}* (${targetIP})\n❌ *Status:* Unreachable`);
        });
    });
}

module.exports = { checkPing };
