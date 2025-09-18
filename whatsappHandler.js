const qrcode = require('qrcode');
const { getInfoKamar } = require('./service/kamarService');
const { getInfoPoli } = require('./service/poliService');
const { checkPing } = require('./service/pingService');
const { db } = require('./config/database');

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
        `1️⃣ _*info kamar*_ \n Cek ketersediaan kamar 🏨\n` +
        `2️⃣ _*info poli [YYYY-MM-DD]*_ \n Cek jadwal poli 📅\n` +
        `3️⃣ _*/ping <IP_ADDRESS>*_ \n Cek koneksi ke IP tertentu 🌍\n` +
        `4️⃣ _*ping server*_ \n Cek koneksi semua server yang ada dalam database 📡\n` +
        `5️⃣ _*/help*_ atau _*menu*_ \n Tampilkan menu bantuan ❓`
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


module.exports = function setupWhatsAppClient(client, io) {
    client.on('qr', async (qr) => {
        try {
            const qrImage = await qrcode.toDataURL(qr);
            io.emit('qr', qrImage);
        } catch (e) {
            console.error('Failed generating QR:', e);
        }
    });

    client.on('ready', async () => {
        console.log('✅ Client is ready!');
        io.emit('ready');
        const userInfo = client.info; // client.info is a plain object
        if (userInfo && userInfo.wid && userInfo.wid.user) {
            io.emit('user_info', userInfo.wid.user);
        }
    });

    client.on('message', async (message) => {
        // Abaikan pesan dari diri sendiri atau status broadcast
        if (message.fromMe || message.from === 'status@broadcast') {
            return;
        }
        const lowerMessage = (message.body || '').toLowerCase().trim();

        if (lowerMessage === 'info kamar') {
            try {
                const kamarInfo = await getInfoKamar();
                await reply(message, `🏨 *Informasi Kamar:*\n${kamarInfo}`);
            } catch (err) {
                console.error('Error fetching room info:', err);
                await reply(message, '❌ *Gagal mengambil data kamar. Silakan coba lagi nanti!*');
            }
            return;
        }

        if (lowerMessage.startsWith('info poli')) {
            let tanggal = new Date().toISOString().split('T')[0];
            const parts = lowerMessage.split(/\s+/);
            if (parts.length === 3) {
                const candidate = parts[2];
                if (!isValidDateStr(candidate)) {
                    await reply(message, '⚠️ *Format tanggal tidak valid.* Gunakan format `YYYY-MM-DD`, contoh: `info poli 2025-09-17`');
                    return;
                }
                tanggal = candidate;
            }
            try {
                const poliInfo = await getInfoPoli(tanggal);
                await reply(message, `🏥 *Jadwal Poli untuk ${tanggal}:*\n${poliInfo}`);
            } catch (err) {
                console.error('Error fetching poli info:', err);
                await reply(message, '❌ *Gagal mengambil informasi poli. Silakan coba lagi nanti!*');
            }
            return;
        }

        if (lowerMessage.startsWith('/ping')) {
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
                console.error('Error during ping:', err);
                await reply(message, '❗ *Gagal melakukan ping ke server. Pastikan IP valid dan coba lagi!*');
            }
            return;
        }

        if (lowerMessage === 'ping server') {
            try {
                const targetServers = await fetchServersToPing();
                if (!targetServers.length) {
                    await reply(message, '⚠️ *Tidak ada IP yang tersimpan dalam database.*');
                    return;
                }
                // Batasi dalam batch agar tidak membebani resource jika daftar IP banyak
                const results = await mapInBatches(targetServers, PING_BATCH_SIZE, ({ ip_address, server_name }) =>
                    checkPing(ip_address, server_name)
                );
                await reply(message, `📡 *Hasil Ping ke Semua Server:*\n${results.join('\n\n')}`);
            } catch (err) {
                console.error('Error fetching IPs from database:', err);
                await reply(message, '❗ *Terjadi kesalahan saat mengambil data IP dari database.*');
            }
            return;
        }

        if (lowerMessage === 'menu' || lowerMessage === '/help' || lowerMessage === 'help') {
            await reply(message, buildMenuMessage());
        }
    });
};
