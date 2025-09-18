const qrcode = require('qrcode');
const { getInfoKamar, getInfoKamarRows } = require('./service/kamarService');
const { getInfoPoli, getInfoPoliRows } = require('./service/poliService');
const { checkPing, probePing } = require('./service/pingService');
const { buildPingReportHTML } = require('./service/reportService');
const { buildTextReportHTML } = require('./service/reportService');
const { buildKamarTableHTML } = require('./service/reportService');
const { buildPoliTableHTML } = require('./service/reportService');
const { renderHtmlToImage } = require('./service/renderService');
const { mediaFromPngBuffer } = require('./utils/imageMedia');
const { db } = require('./config/db_simplus');
const logger = require('./utils/logger');

// -----------------------
// Helper & Constants
// -----------------------
// Validasi pola tanggal dan host/IP
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const HOST_REGEX = /^(\d{1,3}\.){3}\d{1,3}$|^[a-zA-Z0-9.-]+$/;
const PING_BATCH_SIZE = Number(process.env.PING_BATCH_SIZE || 5);

/**
 * Validasi string tanggal format YYYY-MM-DD.
 * @param {string} v
 * @returns {boolean}
 */
function isValidDateStr(v) {
    return DATE_REGEX.test(v) && !isNaN(Date.parse(v));
}

/**
 * Validasi hostname atau IPv4 sederhana.
 * @param {string} v
 * @returns {boolean}
 */
function isValidHost(v) {
    return HOST_REGEX.test(v);
}

/**
 * Kirim balasan WhatsApp dengan penanganan error.
 * @param {import('whatsapp-web.js').Message} message
 * @param {string} text
 */
async function reply(message, text) {
    try {
        await message.reply(text);
    } catch (e) {
        console.error('Failed to send reply:', e);
    }
}

/**
 * Mengambil daftar server yang akan diping dari database.
 * @returns {Promise<Array<{ip_address:string, server_name:string}>>}
 */
async function fetchServersToPing() {
    try {
        const [rows] = await db.promise().query('SELECT ip_address, server_name FROM ip_list');
        return rows || [];
    } catch (err) {
        console.error('DB error fetching IPs:', err);
        return [];
    }
}

/**
 * Membangun pesan menu bantuan.
 * @returns {string}
 */
function buildMenuMessage() {
    return (
        `📌 *Menu Perintah WhatsApp Bot*:\n` +
        `1️⃣ */info kamar* — Cek ketersediaan kamar 🏨 (alias: */kamar*)\n` +
        `2️⃣ */info poli [YYYY-MM-DD]* — Cek jadwal poli 📅 (alias: */poli* [YYYY-MM-DD], default hari ini)\n` +
        `3️⃣ */ping <IP_ADDRESS>* — Cek koneksi ke IP tertentu 🌍\n` +
        `4️⃣ */ping server* — Cek koneksi semua server dalam database 📡 (alias: */servers*)\n` +
        `5️⃣ */help* atau */menu* — Tampilkan menu bantuan ❓\n` +
        `6️⃣ */status* — Cek status bot & perangkat 📶`
    );
}

/**
 * Memproses array secara bertahap dalam batch paralel.
 * @template T, R
 * @param {T[]} items
 * @param {number} batchSize
 * @param {(item:T)=>Promise<R>} mapper
 * @returns {Promise<R[]>}
 */
async function mapInBatches(items, batchSize, mapper) {
    const results = [];
    for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        // eslint-disable-next-line no-await-in-loop
        const mapped = await Promise.all(batch.map(mapper));
        results.push(...mapped);
    }
    return results;
}


module.exports = function setupWhatsAppClient(client, io, opts = {}) {
    const room = opts.room || null;
    const emitUI = opts.emitUI !== false; // default true
    client.on('qr', async (qr) => {
        if (!emitUI) return; // UI events handled elsewhere
        try {
            const qrImage = await qrcode.toDataURL(qr);
            const emitter = room ? io.to(room) : io;
            emitter.emit('qr', qrImage);
        } catch (e) {
            logger.error('Failed generating QR', { error: String(e?.message || e), stack: e?.stack });
        }
    });

    client.on('ready', async () => {
        if (!emitUI) return; // UI events handled elsewhere
    logger.info('Client is ready');
        const emitter = room ? io.to(room) : io;
        emitter.emit('ready');
        const userInfo = client.info; // client.info is a plain object
        if (userInfo && userInfo.wid && userInfo.wid.user) {
            emitter.emit('user_info', userInfo.wid.user);
        }
    });

    client.on('message', async (message) => {
        // Abaikan pesan dari diri sendiri atau status broadcast
        if (message.fromMe || message.from === 'status@broadcast') {
            return;
        }
        const lowerMessage = (message.body || '').toLowerCase().trim();

        // Enforce semua perintah harus gunakan awalan '/'
        const looksLikeLegacyCmd = (
            lowerMessage === 'menu' || lowerMessage === 'help' ||
            lowerMessage === 'info kamar' || lowerMessage.startsWith('info poli') ||
            lowerMessage === 'ping server' || lowerMessage.startsWith('ping ') 
        );
        if (!lowerMessage.startsWith('/') && looksLikeLegacyCmd) {
            await reply(message, 'ℹ️ Semua perintah harus diawali dengan "/". Ketik */help* untuk daftar perintah.');
            return;
        }

        if (lowerMessage === '/info kamar' || lowerMessage === '/kamar') {
            let chat = null;
            try {
                chat = await message.getChat();
                try { await chat.sendStateTyping(); } catch (_) {}
                try { await message.reply('⏳ Sedang memproses data kamar, mohon tunggu...'); } catch (_) {}

                const rows = await getInfoKamarRows();
                const html = buildKamarTableHTML(rows);
                const pngBuffer = await renderHtmlToImage(html);
                const media = mediaFromPngBuffer(pngBuffer, 'kamar-report.png');
                await message.reply(media, undefined, { caption: '🏨 Informasi Kamar' });
            } catch (err) {
                logger.error('Error fetching room info', { error: String(err?.message || err), stack: err?.stack });
                await reply(message, '❌ *Gagal mengambil data kamar. Silakan coba lagi nanti!*');
            } finally {
                try { await chat?.clearState(); } catch (_) {}
            }
            return;
        }

        if (lowerMessage.startsWith('/info poli') || lowerMessage.startsWith('/poli')) {
            let tanggal = new Date().toISOString().split('T')[0];
            const parts = lowerMessage.split(/\s+/);
            let candidate = null;
            if (parts[0] === '/info' && parts[1] === 'poli' && parts[2]) {
                candidate = parts[2];
            } else if (parts[0] === '/poli' && parts[1]) {
                candidate = parts[1];
            }
            if (candidate) {
                if (!isValidDateStr(candidate)) {
                    await reply(message, '⚠️ *Format tanggal tidak valid.* Gunakan format `YYYY-MM-DD`, contoh: `/poli 2025-09-17`');
                    return;
                }
                tanggal = candidate;
            }
            let chat = null;
            try {
                chat = await message.getChat();
                try { await chat.sendStateTyping(); } catch (_) {}
                try { await message.reply('⏳ Sedang memproses data poli, mohon tunggu...'); } catch (_) {}

                const rows = await getInfoPoliRows(tanggal);
                const html = buildPoliTableHTML(rows, tanggal);
                const pngBuffer = await renderHtmlToImage(html);
                const media = mediaFromPngBuffer(pngBuffer, 'poli-report.png');
                await message.reply(media, undefined, { caption: `🏥 Jadwal Poli untuk ${tanggal}` });
            } catch (err) {
                logger.error('Error fetching poli info', { error: String(err?.message || err), stack: err?.stack });
                await reply(message, '❌ *Gagal mengambil informasi poli. Silakan coba lagi nanti!*');
            } finally {
                try { await chat?.clearState(); } catch (_) {}
            }
            return;
        }

        // Pastikan '/ping server' (alias '/servers') diproses sebelum '/ping <ip>'
        if (lowerMessage === '/ping server' || lowerMessage === '/servers') {
            let chat = null;
            try {
                chat = await message.getChat();
                try { await chat.sendStateTyping(); } catch (_) {}
                try { await message.reply('⏳ Sedang memproses ping semua server, mohon tunggu...'); } catch (_) {}

                const targetServers = await fetchServersToPing();
                if (!targetServers.length) {
                    await reply(message, '⚠️ *Tidak ada IP yang tersimpan dalam database.*');
                    return;
                }

                // Probe paralel dibatasi batch untuk efisiensi
                const results = await mapInBatches(targetServers, PING_BATCH_SIZE, ({ ip_address, server_name }) =>
                    probePing(ip_address, server_name)
                );

                // Bangun HTML report dan render jadi gambar
                const html = buildPingReportHTML(results);
                const pngBuffer = await renderHtmlToImage(html);
                const media = mediaFromPngBuffer(pngBuffer, 'ping-report.png');

                await message.reply(media, undefined, { caption: '📡 Hasil Ping ke Semua Server' });
            } catch (err) {
                logger.error('Error generating ping report', { error: String(err?.message || err), stack: err?.stack });
                await reply(message, '❗ *Terjadi kesalahan saat membuat laporan ping.*');
            } finally {
                try { await chat?.clearState(); } catch (_) {}
            }
            return;
        }

        if (lowerMessage.startsWith('/ping ')) {
            const parts = lowerMessage.split(/\s+/);
            const target = parts[1];
            if (!target) {
                await reply(message, '⚠️ *Format salah!* Gunakan: `/ping <IP_ADDRESS>`');
                return;
            }
            if (!isValidHost(target)) {
                await reply(message, '⚠️ *IP/Host tidak valid.* Contoh: `/ping 8.8.8.8`');
                return;
            }
            try {
                const pingResult = await checkPing(target);
                await reply(message, `🌍 *Hasil Ping ke ${target}:*\n${pingResult}`);
            } catch (err) {
                logger.error('Error during ping', { error: String(err?.message || err), stack: err?.stack });
                await reply(message, '❗ *Gagal melakukan ping ke server. Pastikan IP valid dan coba lagi!*');
            }
            return;
        }

        if (lowerMessage === '/menu' || lowerMessage === '/help') {
            await reply(message, buildMenuMessage());
        }

        if (lowerMessage === '/status') {
            try {
                const info = client?.info;
                const ready = !!info;
                const number = info?.wid?.user || '-';
                const servers = await fetchServersToPing();
                const serverCount = servers?.length ?? 0;
                const up = Math.floor(process.uptime());
                const fmt = (s)=>{
                    const h = Math.floor(s/3600).toString().padStart(2,'0');
                    const m = Math.floor((s%3600)/60).toString().padStart(2,'0');
                    const ss = Math.floor(s%60).toString().padStart(2,'0');
                    return `${h}:${m}:${ss}`;
                };
                await reply(message, `📋 *Status Bot*\n` +
                    `• WhatsApp: ${ready ? 'Ready ✅' : 'Not Ready ❌'}\n` +
                    `• Nomor: ${number}\n` +
                    `• Jumlah server terdaftar: ${serverCount}\n` +
                    `• Uptime: ${fmt(up)}`
                );
            } catch (err) {
                logger.error('Error building status', { error: String(err?.message || err), stack: err?.stack });
                await reply(message, '❗ *Gagal mengambil status.*');
            }
            return;
        }
    });
};
