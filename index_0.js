const { Client, LocalAuth } = require('whatsapp-web.js');
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const qrcode = require('qrcode');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { db } = require('./config/database');
const fetch = require("node-fetch");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const sessionPath = path.join(__dirname, '.wwebjs_auth');

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

app.get('/logout', (req, res) => {
    if (fs.existsSync(sessionPath)) {
        try {
            exec(`rm -rf "${sessionPath}"`, (err) => {
                if (err) {
                    console.error('Error deleting session:', err);
                    return res.send('Failed to delete session. Try again.');
                }
                console.log('Session deleted. Restart the server to login again.');
                res.send('Session deleted. Please restart the server to login again.');
            });
        } catch (error) {
            console.error('Error deleting session:', error);
            res.send('Failed to delete session. Try again.');
        }
    } else {
        res.send('No session found to delete.');
    }
});

const client = new Client({
    authStrategy: new LocalAuth({ clientId: 'elbot-wa' })
});

client.on('qr', async (qr) => {
    const qrImage = await qrcode.toDataURL(qr);
    io.emit('qr', qrImage);
});

client.on('ready', async () => {
    console.log('Client is ready!');
    io.emit('ready');

    const me = await client.getState();
    const userInfo = await client.info;
    io.emit('user_info', userInfo.wid.user);
});

client.on('message', async message => {
    if (message.body.startsWith('ai:')) {
        const sql = "INSERT INTO wa_messages (sender, message, timestamp) VALUES (?, ?, ?)";
        const values = [message.from, message.body, new Date()];

        db.query(sql, values, (err, result) => {
            if (err) {
                console.error('Error inserting message into database:', err);
            } else {
                console.log('Message saved to database');
            }
        });

        // Balas pesan
        client.sendMessage(message.from, 'Pesan Anda telah diterima.').then(() => {
            // Hapus pesan setelah dibalas
            message.delete(true).catch(err => console.error('Error deleting message:', err));
        }).catch(err => console.error('Error sending message:', err));
    } else if (message.body.toLowerCase() === 'hapus chat') {
        // Hapus semua pesan dari user tersebut
        try {
            const chat = await message.getChat();
            await chat.clearMessages();
            console.log(`Semua pesan dari ${message.from} telah dihapus.`);
        } catch (err) {
            console.error('Error clearing messages:', err);
        }
    }
});

client.initialize();

io.on('connection', (socket) => {
    console.log('User connected');
});

server.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});
