const { Client, RemoteAuth } = require('whatsapp-web.js');
const path = require('path');
const { MySQLRemoteAuthStore } = require('../config/remoteAuthStore');
const setupWhatsAppClient = require('../whatsappHandler');

class ClientManager {
  constructor(io) {
    this.io = io;
    this.clients = new Map(); // clientId -> client
    this.store = new MySQLRemoteAuthStore();
  }

  async startClient(clientId) {
    if (this.clients.has(clientId)) return this.clients.get(clientId);
    const REMOTE_BACKUP_MS = Math.max(60000, Number(process.env.REMOTEAUTH_BACKUP_MS || 300000));
    const client = new Client({
      authStrategy: new RemoteAuth({
        clientId,
        store: this.store,
        backupSyncIntervalMs: REMOTE_BACKUP_MS,
        dataPath: path.join(__dirname, '..', 'session')
      })
    });

    this._wireEvents(client, clientId);
    // Attach command handlers without emitting UI events (handled by _wireEvents)
    try {
      setupWhatsAppClient(client, this.io, { room: `client:${clientId}`, emitUI: false });
    } catch (e) {
      console.error('Failed to setup handlers for client', clientId, e);
    }

    await client.initialize();
    this.clients.set(clientId, client);
    return client;
  }

  async stopClient(clientId) {
    const client = this.clients.get(clientId);
    if (!client) return false;
    try { await client.destroy(); } catch (_) {}
    this.clients.delete(clientId);
    return true;
  }

  listClients() {
    return Array.from(this.clients.keys());
  }

  getStatus(clientId) {
    const c = this.clients.get(clientId);
    if (!c) return { ready: false, exists: false };
    const info = c.info;
    return { ready: !!info, exists: true, number: info?.wid?.user };
  }

  _wireEvents(client, clientId) {
    client.on('qr', async (qr) => {
      try {
        const qrcode = require('qrcode');
        const qrImage = await qrcode.toDataURL(qr);
        this.io.to(`client:${clientId}`).emit('qr', qrImage);
      } catch (e) {
        console.error('QR gen error:', e);
      }
    });

    client.on('ready', async () => {
      console.log(`[${clientId}] ready`);
      this.io.to(`client:${clientId}`).emit('ready');
      const userInfo = client.info;
      if (userInfo?.wid?.user) this.io.to(`client:${clientId}`).emit('user_info', userInfo.wid.user);
    });

    client.on('disconnected', (reason) => {
      console.warn(`[${clientId}] disconnected:`, reason);
      this.io.to(`client:${clientId}`).emit('disconnected', reason);
    });
  }
}

module.exports = { ClientManager };
