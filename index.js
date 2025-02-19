const { Client, LocalAuth } = require('whatsapp-web.js');
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const qrcode = require('qrcode');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

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
    authStrategy: new LocalAuth()
});

client.on('qr', async (qr) => {
    const qrImage = await qrcode.toDataURL(qr);
    io.emit('qr', qrImage);
});

client.on('ready', () => {
    console.log('Client is ready!');
    io.emit('ready');
});

client.initialize();

io.on('connection', (socket) => {
    console.log('User connected');
});

server.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});
