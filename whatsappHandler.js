const qrcode = require('qrcode');
const fs = require('fs');
const { getOllamaChatCompletion } = require('./service/ollamaService');
const { getInfoKamar } = require('./service/kamarService');
const { getInfoPoli } = require('./service/poliService');
const { checkPing } = require('./service/pingService');
const { db } = require('./config/database');

async function getIPsFromDatabase() {
    return new Promise((resolve, reject) => {
        db.query('SELECT ip_address, server_name FROM ip_list', (err, results) => {
            if (err) reject(err);
            else resolve(results);
        });
    });
}

module.exports = function setupWhatsAppClient(client, io) {
    client.on('qr', async (qr) => {
        const qrImage = await qrcode.toDataURL(qr);
        io.emit('qr', qrImage);
    });

    client.on('ready', async () => {
        console.log('✅ Client is ready!');
        io.emit('ready');
        const userInfo = await client.info;
        io.emit('user_info', userInfo.wid.user);
    });

    client.on('message', async (message) => {
        const lowerMessage = message.body.toLowerCase().trim();

        if (lowerMessage.startsWith('ai:')) {
            const userQuestion = message.body.substring(3).trim();
            message.reply('⏳ *Sedang memproses pertanyaan Anda... Mohon tunggu sebentar!*');
            const answer = await getOllamaChatCompletion(userQuestion);
            message.reply(answer ? answer : '❌ *Maaf, saya tidak dapat memahami pertanyaan Anda.*');
        } else if (lowerMessage === 'info kamar') {
            try {
                const kamarInfo = await getInfoKamar();
                message.reply(`🏨 *Informasi Kamar:*\n${kamarInfo}`);
            } catch (err) {
                console.error('Error fetching room info:', err);
                message.reply('❌ *Gagal mengambil data kamar. Silakan coba lagi nanti!*');
            }
        } else if (lowerMessage.startsWith('info poli')) {
            let tanggal = new Date().toISOString().split('T')[0];
            const parts = lowerMessage.split(' ');
            if (parts.length === 3) tanggal = parts[2];
            try {
                const poliInfo = await getInfoPoli(tanggal);
                message.reply(`🏥 *Jadwal Poli untuk ${tanggal}:*\n${poliInfo}`);
            } catch (err) {
                console.error('Error fetching poli info:', err);
                message.reply('❌ *Gagal mengambil informasi poli. Silakan coba lagi nanti!*');
            }
        } else if (lowerMessage.startsWith('/ping ')) {
            const targetIP = lowerMessage.split(' ')[1];
            if (!targetIP) {
                message.reply('⚠️ *Format salah!* Gunakan: `/ping <IP_ADDRESS>`');
                return;
            }
            try {
                const pingResult = await checkPing(targetIP);
                message.reply(`🌍 *Hasil Ping ke ${targetIP}:*\n${pingResult}`);
            } catch (err) {
                console.error('Error during ping:', err);
                message.reply('❗ *Gagal melakukan ping ke server. Pastikan IP valid dan coba lagi!*');
            }
        } else if (lowerMessage === 'ping server') {
            try {
                const targetServers = await getIPsFromDatabase();
                if (!targetServers.length) {
                    message.reply('⚠️ *Tidak ada IP yang tersimpan dalam database.*');
                    return;
                }
                const results = await Promise.all(targetServers.map(({ ip_address, server_name }) => checkPing(ip_address, server_name)));
                message.reply(`📡 *Hasil Ping ke Semua Server:*\n${results.join('\n\n')}`);
            } catch (err) {
                console.error('Error fetching IPs from database:', err);
                message.reply('❗ *Terjadi kesalahan saat mengambil data IP dari database.*');
            }
        } else if (lowerMessage === 'menu') {
            const menuMessage = `📌 *Menu Perintah WhatsApp Bot*:\n` +
                `1️⃣ _*ai: <pertanyaan>*_ \n Ajukan pertanyaan ke AI 🤖\n` +
                `2️⃣ _*info kamar*_ \n Cek ketersediaan kamar 🏨\n` +
                `3️⃣ _*info poli [YYYY-MM-DD]*_ \n Cek jadwal poli 📅\n` +
                `4️⃣ _*/ping <IP_ADDRESS>*_ \n Cek koneksi ke IP tertentu 🌍\n` +
                `5️⃣ _*ping server*_ \n Cek koneksi semua server yang ada dalam database 📡`;
            message.reply(menuMessage);
        }
    });
};
