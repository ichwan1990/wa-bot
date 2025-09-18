require('dotenv').config(); // Load dotenv
const { Client, LocalAuth } = require('whatsapp-web.js');
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs');
const path = require('path');
const setupWhatsAppClient = require('./whatsappHandler');
const net = require('net');
const { buildApiRouter } = require('./routes/api');
const { requireApiKeyFactory } = require('./middlewares/auth');
const { ensureClientReadyFactory } = require('./middlewares/ready');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const sessionPath = path.join(__dirname, '.wwebjs_auth');

const PORT = Number(process.env.PORT) || 3000;
const PORT_MAX_TRIES = Number(process.env.PORT_MAX_TRIES || 10);
const API_KEY = process.env.API_KEY; // optional API key protection

// Body parser for JSON (limit to 10MB for base64 media)
app.use(express.json({ limit: '10mb' }));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

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

app.get('/logout', (req, res) => {
    // Delete only the LocalAuth session folder if clientId is set; fallback to base path
    const clientId = process.env.CLIENT_ID || 'default';
    const sessionDirForClient = path.join(sessionPath, `session-${clientId}`);
    const targetPath = fs.existsSync(sessionDirForClient) ? sessionDirForClient : sessionPath;

    if (!fs.existsSync(targetPath)) {
        return res.send('No session found to delete.');
    }

    fs.rm(targetPath, { recursive: true, force: true }, (err) => {
        if (err) {
            console.error('Error deleting session:', err);
            return res.status(500).send('Failed to delete session. Try again.');
        }
        console.log('Session deleted. Restart the server to login again.');
        res.send('Session deleted. Please restart the server to login again.');
    });
});

const client = new Client({
    authStrategy: new LocalAuth({ clientId: process.env.CLIENT_ID })
});

// Panggil handler WhatsApp
setupWhatsAppClient(client, io);

client.initialize();

io.on('connection', (socket) => {
    console.log('User connected');
});

// Track client readiness for API usage
let isClientReady = false;
client.on('ready', () => { isClientReady = true; });
client.on('disconnected', () => { isClientReady = false; });

// Build middlewares
const requireApiKey = requireApiKeyFactory(API_KEY);
const ensureClientReady = ensureClientReadyFactory(() => isClientReady);

// Mount API router
app.use('/api', buildApiRouter(client, ensureClientReady, requireApiKey));


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
        client.destroy();
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
