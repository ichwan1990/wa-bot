const qrcode = require('qrcode');
const { getOllamaChatCompletion } = require('./service/ollamaService');
const { getInfoKamar } = require('./service/kamarService');

module.exports = function setupWhatsAppClient(client, io) {
    client.on('qr', async (qr) => {
        const qrImage = await qrcode.toDataURL(qr);
        io.emit('qr', qrImage);
    });

    client.on('ready', async () => {
        console.log('Client is ready!');
        io.emit('ready');

        const userInfo = await client.info;
        io.emit('user_info', userInfo.wid.user);
    });

    client.on('message', async (message) => {
        const lowerMessage = message.body.toLowerCase().trim();

        if (lowerMessage.startsWith('ai:')) {
            const userQuestion = message.body.substring(3).trim();
            const answer = await getOllamaChatCompletion(userQuestion);
            // console.log(`User: ${userQuestion}`);
            // console.log(`AI: ${answer}`);

            if (answer) {
                message.reply(answer);
            } else {
                message.reply("Maaf, saya tidak dapat memahami pertanyaan Anda.");
            }
        } else if (lowerMessage === 'hapus chat') {
            try {
                const chat = await message.getChat();
                await chat.clearMessages();
                console.log(`Semua pesan dari ${message.from} telah dihapus.`);
            } catch (err) {
                console.error('Error clearing messages:', err);
            }
        } else if (lowerMessage === 'info kamar') {
            try {
                const kamarInfo = await getInfoKamar();
                message.reply(kamarInfo);
            } catch (err) {
                console.error('Error fetching room info:', err);
                message.reply("Maaf, terjadi kesalahan saat mengambil data kamar.");
            }
        }
    });
};
