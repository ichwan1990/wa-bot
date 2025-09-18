const { Client, RemoteAuth } = require('whatsapp-web.js');
const path = require('path');
const { MySQLRemoteAuthStore } = require('../config/remoteAuthStore');
const setupWhatsAppClient = require('../whatsappHandler');
const logger = require('../utils/logger');

class ClientManager {
  constructor(io) {
    this.io = io;
    this.clients = new Map(); // clientId -> client
    this.store = new MySQLRemoteAuthStore();
    this.lastQr = new Map(); // clientId -> { dataUrl, updatedAt }
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
      logger.error('Failed to setup handlers for client', { clientId, error: String(e?.message || e), stack: e?.stack });
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
        logger.info('QR generated', { clientId });
        this.lastQr.set(clientId, { dataUrl: qrImage, updatedAt: Date.now() });
      } catch (e) {
        logger.error('QR gen error', { clientId, error: String(e?.message || e), stack: e?.stack });
      }
    });

    client.on('ready', async () => {
      logger.info('Client ready', { clientId });
      this.io.to(`client:${clientId}`).emit('ready');
      const userInfo = client.info;
      if (userInfo?.wid?.user) this.io.to(`client:${clientId}`).emit('user_info', userInfo.wid.user);
      this.lastQr.delete(clientId);
    });

    client.on('disconnected', (reason) => {
      logger.warn('Client disconnected', { clientId, reason });
      this.io.to(`client:${clientId}`).emit('disconnected', reason);
    });

    client.on('auth_failure', (message) => {
      logger.error('Client auth_failure', { clientId, message });
    });
    client.on('change_state', (state) => {
      logger.info('Client state changed', { clientId, state });
    });
  }

  getLastQr(clientId) {
    const v = this.lastQr.get(clientId);
    return v?.dataUrl || null;
  }
}

module.exports = { ClientManager };
