const qrcode = require('qrcode');
const { getOllamaChatCompletion } = require('./ollamaService'); // Buat file ini nanti

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
        if (message.body.startsWith('ai:')) {
            const userQuestion = message.body.substring(3).trim();
            const answer = await getOllamaChatCompletion(userQuestion);
            console.log(`User: ${userQuestion}`);
            console.log(`AI: ${answer}`);

            if (answer) {
                message.reply(answer);
            } else {
                message.reply("Maaf, saya tidak dapat memahami pertanyaan Anda.");
            }
        } else if (message.body.toLowerCase() === 'hapus chat') {
            try {
                const chat = await message.getChat();
                await chat.clearMessages();
                console.log(`Semua pesan dari ${message.from} telah dihapus.`);
            } catch (err) {
                console.error('Error clearing messages:', err);
            }
        }
    });
};
