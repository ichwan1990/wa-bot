require('dotenv').config(); // Load dotenv
const { Client, RemoteAuth } = require('whatsapp-web.js');
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');
const setupWhatsAppClient = require('./whatsappHandler');
const { ClientManager } = require('./service/clientManager');
const net = require('net');
const { buildApiRouter } = require('./routes/api');
const { requireApiKeyFactory } = require('./middlewares/auth');
const { ensureClientReadyFactory } = require('./middlewares/ready');
const { MySQLRemoteAuthStore, deleteRemoteSession } = require('./config/remoteAuthStore');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = Number(process.env.PORT) || 3000;
const PORT_MAX_TRIES = Number(process.env.PORT_MAX_TRIES || 10);
const API_KEY = process.env.API_KEY; // optional API key protection

// Body parser for JSON (limit to 10MB for base64 media)
const REMOTE_BACKUP_MS = Math.max(60000, Number(process.env.REMOTEAUTH_BACKUP_MS || 300000));
app.use(express.json({ limit: '10mb' }));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Serve static assets (e.g., images)
app.use('/assets', express.static(path.join(__dirname, 'assets')));

// Serve documentation files and simple viewers (no extra deps)
app.use('/docs/files', express.static(path.join(__dirname, 'docs')));

// Simple Markdown viewer for docs/api.md
app.get('/docs', (req, res) => {
        res.send(`<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>WA Bot API Docs</title>
    <link rel="preconnect" href="https://cdn.jsdelivr.net" />
    <style>
        body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Arial, "Apple Color Emoji", "Segoe UI Emoji"; margin: 24px; line-height: 1.5; }
        header { margin-bottom: 16px; }
        .links a { margin-right: 12px; }
        pre { background: #f6f8fa; padding: 12px; overflow: auto; }
        code { background: #f6f8fa; padding: 2px 4px; border-radius: 4px; }
        .container { max-width: 980px; margin: 0 auto; }
    </style>
    <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
    <script>
        addEventListener('DOMContentLoaded', async () => {
            const el = document.getElementById('content');
            try {
                const resp = await fetch('/docs/files/api.md', { cache: 'no-cache' });
                const md = await resp.text();
                el.innerHTML = marked.parse(md);
            } catch (e) {
                el.textContent = 'Gagal memuat dokumentasi.';
            }
        });
    </script>
    </head>
    <body>
        <div class="container">
            <header>
                <h1>WA Bot API Documentation</h1>
                <div class="links">
                    <a href="/docs/files/api.md" target="_blank" rel="noopener">Lihat Markdown</a>
                    <a href="/docs/files/openapi.yaml" target="_blank" rel="noopener">Unduh OpenAPI (YAML)</a>
                    <a href="/docs/swagger" rel="noopener">Swagger UI</a>
                </div>
            </header>
            <main id="content">Memuat dokumentasi…</main>
        </div>
    </body>
</html>`);
});

// Swagger UI (CDN) to render docs/openapi.yaml
app.get('/docs/swagger', (req, res) => {
        const swaggerDefaultKey = process.env.SWAGGER_DEFAULT_API_KEY || process.env.API_KEY || '';
        res.send(`<!doctype html>
<html lang="en">
    <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>WA Bot API - Swagger UI</title>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist/swagger-ui.css" />
        <style>
            body { margin: 0; }
            #swagger-ui { max-width: 1200px; margin: 0 auto; }
        </style>
    </head>
    <body>
        <div id="swagger-ui"></div>
        <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist/swagger-ui-bundle.js"></script>
        <script>
            const DEFAULT_API_KEY = ${JSON.stringify(swaggerDefaultKey)};
            window.ui = SwaggerUIBundle({
                url: '/docs/files/openapi.yaml',
                dom_id: '#swagger-ui',
                deepLinking: true,
                persistAuthorization: true,
            });
            if (DEFAULT_API_KEY) {
                // Pre-authorize the API key for ApiKeyAuth security scheme
                window.ui.preauthorizeApiKey('ApiKeyAuth', DEFAULT_API_KEY);
            }
        </script>
    </body>
</html>`);
});

// Simple health endpoint for liveness/readiness checks
app.get('/healthz', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
});

// Favicon route: try assets/favicon.ico then fallback to assets/whatsapp.png
app.get('/favicon.ico', (req, res) => {
    const ico = path.join(__dirname, 'assets', 'favicon.ico');
    const png = path.join(__dirname, 'assets', 'whatsapp.png');
    if (fs.existsSync(ico)) return res.sendFile(ico);
    if (fs.existsSync(png)) return res.sendFile(png);
    res.status(204).end();
});

// Auth info for QR page (RemoteAuth awareness)
app.get('/auth/info', (req, res) => {
    res.json({
        clientId: process.env.CLIENT_ID || 'default',
        auth: 'remote',
        defaultApiKey: process.env.SWAGGER_DEFAULT_API_KEY || process.env.API_KEY || '',
        enableLegacy: ENABLE_LEGACY,
        legacyClientId: ENABLE_LEGACY ? (process.env.CLIENT_ID || 'default') : null
    });
});

app.get('/logout', async (req, res) => {
    // Hapus sesi untuk clientId tertentu pada RemoteAuth Store
    const clientId = (req.query.clientId || process.env.CLIENT_ID || 'default').toString();
    try {
        const deleted = await deleteRemoteSession(clientId);
        if (deleted) {
            console.log(`Remote session deleted for clientId=${clientId}.`);
            return res.send(`Remote session deleted for clientId=${clientId}. Silakan restart/refresh untuk login kembali.`);
        }
        return res.send(`Tidak ada sesi yang ditemukan untuk clientId=${clientId}.`);
    } catch (err) {
        console.error('Error deleting remote session:', err);
        return res.status(500).send('Gagal menghapus sesi remote. Coba lagi.');
    }
});

const remoteStore = new MySQLRemoteAuthStore();
// Multi-client manager
const manager = new ClientManager(io);
// Do not auto-start a manager client to avoid conflicts with legacy client.

// Legacy single client for backward compatibility (message handlers, APIs)
let legacyClient = null;
const ENABLE_LEGACY = String(process.env.ENABLE_LEGACY || 'true').toLowerCase() !== 'false';
if (ENABLE_LEGACY) {
    legacyClient = new Client({
        authStrategy: new RemoteAuth({
            clientId: process.env.CLIENT_ID || 'default',
            store: remoteStore,
            backupSyncIntervalMs: REMOTE_BACKUP_MS,
            dataPath: path.join(__dirname, 'session')
        })
    });
    setupWhatsAppClient(legacyClient, io, { room: null, emitUI: true });
    legacyClient.initialize();
}

io.on('connection', (socket) => {
    console.log('User connected');
    socket.on('join', ({ clientId }) => {
        if (!clientId) return;
        socket.join(`client:${clientId}`);
    });
});

// Track legacy client readiness for API usage
let isClientReady = false;
if (legacyClient) {
    legacyClient.on('ready', () => { isClientReady = true; });
    legacyClient.on('disconnected', () => { isClientReady = false; });
}

// Build middlewares
const requireApiKey = requireApiKeyFactory(API_KEY);
const ensureClientReady = ensureClientReadyFactory(() => isClientReady);

// Mount API router
app.use('/api', buildApiRouter(legacyClient, ensureClientReady, requireApiKey));

// REST endpoints for client lifecycle
app.get('/clients', (req, res) => {
    const list = manager.listClients();
    const legacyId = process.env.CLIENT_ID || 'default';
    if (ENABLE_LEGACY && !list.includes(legacyId)) list.push(legacyId);
    res.json({ clients: list });
});

app.get('/clients/:clientId/status', (req, res) => {
    const { clientId } = req.params;
    const legacyId = process.env.CLIENT_ID || 'default';
    if (ENABLE_LEGACY && clientId === legacyId) {
        const number = legacyClient?.info?.wid?.user;
        return res.json({ ready: !!number, exists: true, number: number || null });
    }
    res.json(manager.getStatus(clientId));
});

app.post('/clients/:clientId/start', async (req, res) => {
    const { clientId } = req.params;
    try {
        const legacyId = process.env.CLIENT_ID || 'default';
        if (ENABLE_LEGACY && clientId === legacyId) {
            return res.status(400).json({ ok: false, error: 'ClientId ini digunakan oleh legacy client. Set ENABLE_LEGACY=false atau pakai clientId lain.' });
        }
        await manager.startClient(clientId);
        res.json({ ok: true });
    } catch (e) {
        console.error('start error', e);
        res.status(500).json({ ok: false, error: String(e?.message || e) });
    }
});

app.post('/clients/:clientId/stop', async (req, res) => {
    const { clientId } = req.params;
    try {
        const legacyId = process.env.CLIENT_ID || 'default';
        if (ENABLE_LEGACY && clientId === legacyId) {
            return res.status(400).json({ ok: false, error: 'Tidak dapat menghentikan legacy client. Set ENABLE_LEGACY=false untuk menonaktifkan legacy.' });
        }
        const ok = await manager.stopClient(clientId);
        res.json({ ok });
    } catch (e) {
        console.error('stop error', e);
        res.status(500).json({ ok: false, error: String(e?.message || e) });
    }
});

// Hapus sesi (DB dan folder), hentikan client jika berjalan
app.post('/clients/:clientId/session/delete', async (req, res) => {
    const { clientId } = req.params;
    try {
        // Hentikan client manager jika berjalan (idempotent)
        try { await manager.stopClient(clientId); } catch (_) {}

        // Jika legacy memakai clientId ini, hentikan juga agar file tidak terkunci
        const legacyId = process.env.CLIENT_ID || 'default';
        if (ENABLE_LEGACY && legacyClient && clientId === legacyId) {
            try { await legacyClient.destroy(); } catch (_) {}
            // Tandai tidak ready
            try { legacyClient.removeAllListeners('ready'); } catch (_) {}
        }

        // Hapus dari remote store (DB)
        const deleted = await deleteRemoteSession(clientId);

        // Bersihkan folder sesi lokal
        const sessDir = path.join(__dirname, 'session', `RemoteAuth-${clientId}`);
        try { await fs.promises.rm(sessDir, { recursive: true, force: true }); } catch (_) {}

        return res.json({ ok: true, deleted });
    } catch (e) {
        console.error('delete session error', e);
        return res.status(500).json({ ok: false, error: String(e?.message || e) });
    }
});


async function findAvailablePort(startPort, maxTries) {
    return new Promise((resolve, reject) => {
        const tryPort = (port, remain) => {
            const tester = net.createServer()
                .once('error', (err) => {
                    if (err && err.code === 'EADDRINUSE' && remain > 0) {
                        tryPort(port + 1, remain - 1);
                    } else {
                        reject(err);
                    }
                })
                .once('listening', () => {
                    tester.close(() => resolve(port));
                })
                .listen(port);
        };
        tryPort(startPort, maxTries);
    });
}

(async () => {
    try {
        const port = await findAvailablePort(PORT, PORT_MAX_TRIES);
        server.listen(port, () => {
            console.log(`Server running on http://localhost:${port}`);
            console.log(`Docs:   http://localhost:${port}/docs`);
            console.log(`Swagger: http://localhost:${port}/docs/swagger`);
        });
    } catch (err) {
        console.error('Failed to bind server port:', err?.message || err);
        process.exit(1);
    }
})();

// Graceful shutdown
function shutdown(signal) {
    console.log(`\nReceived ${signal}. Shutting down gracefully...`);
    try {
        legacyClient.destroy();
    } catch (_) {}
    server.close(() => {
        console.log('HTTP server closed. Bye!');
        process.exit(0);
    });
    // Force exit if not closed within timeout
    setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
