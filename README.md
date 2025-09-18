# WA Bot

A WhatsApp bot using `whatsapp-web.js`, Express, and MySQL that can:
- Show room/kamar availability (`info kamar`)
- Show polyclinic schedules (`info poli [YYYY-MM-DD]`)
- Ping a host/IP (`/ping <ip_or_host>`) or all servers from DB (`ping server`)
- Show help menu (`/help` or `menu`)

## Requirements
- Node.js >= 18.18
- MySQL databases for SIMPLUS/SIMRS/SIRS
 

## Setup
1. Copy env and edit values:
```powershell
Copy-Item .env.example .env
```
2. Install deps:
```powershell
npm ci
```
3. Run in dev (auto-reload) or prod mode:
```powershell
npm run dev
# or
npm start
```
4. Open `http://localhost:3000` to scan the QR code.

## Useful Endpoints
- `GET /` QR login page
- `GET /healthz` liveness check
- `GET /logout` clear LocalAuth session (restart app to re-login)

### REST API (untuk aplikasi lain)
Dokumentasi lengkap:
- Web viewer (Markdown): buka `http://localhost:3000/docs`
- Swagger UI (interaktif): buka `http://localhost:3000/docs/swagger`
- File lokal: `docs/api.md` dan `docs/openapi.yaml` (bisa diimpor ke Postman/Insomnia)

Tip Swagger:
- Anda dapat mengisi default API key pada Swagger Authorize secara otomatis dengan menambahkan variabel berikut pada `.env`:
	- `SWAGGER_DEFAULT_API_KEY=your_api_key` (prioritas pertama), atau
	- `API_KEY=your_api_key` (akan dipakai jika `SWAGGER_DEFAULT_API_KEY` tidak diisi)
	Swagger UI akan otomatis ter-authorize saat halaman dibuka, dan akan menyimpan otorisasi (persistAuthorization: true).
- Auth: gunakan header `x-api-key: <API_KEY>` jika Anda mengisi `API_KEY` pada `.env` (opsional). Jika kosong, API terbuka.

0) Status WhatsApp client
	- `GET /api/status`
	- Response: `{ success: true, ready: true|false, number: "62xxxx" | null }`

1) Kirim teks
	- `POST /api/send-text`
	- Body (JSON): `{ "to": "62812xxxxxx", "message": "Halo", "type": "user|group" }`
	- Response: `{ success: true, id: "..." }`

2) Kirim gambar (URL atau base64)
	- `POST /api/send-image`
	- Body (JSON) via URL: `{ "to": "62812xxxxxx", "imageUrl": "https://example.com/a.jpg", "caption": "Gambar", "type": "user|group" }`
	- Body (JSON) via base64: `{ "to": "62812xxxxxx", "imageBase64": "<base64>", "mimeType": "image/jpeg", "filename": "foto.jpg", "caption": "Gambar", "type": "user|group" }`

3) Kirim PDF (URL atau base64)
	- `POST /api/send-pdf`
	- Body (JSON) via URL: `{ "to": "62812xxxxxx", "fileUrl": "https://example.com/a.pdf", "filename": "dokumen.pdf", "caption": "File", "type": "user|group" }`
	- Body (JSON) via base64: `{ "to": "62812xxxxxx", "fileBase64": "<base64>", "filename": "dokumen.pdf", "type": "user|group" }`

4) Kirim dokumen non-PDF
	- `POST /api/send-document`
	- Body (JSON) via URL: `{ "to": "62812xxxxxx", "fileUrl": "https://example.com/a.docx", "filename": "file.docx", "caption": "Dokumen", "type": "user|group" }`
	- Body (JSON) via base64 (wajib `mimeType`): `{ "to": "62812xxxxxx", "fileBase64": "<base64>", "mimeType": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "filename": "file.docx", "type": "user|group" }`

5) Kirim audio/voice note
	- `POST /api/send-audio`
	- Body (JSON) via URL: `{ "to": "62812xxxxxx", "audioUrl": "https://example.com/a.ogg", "filename": "voice.ogg", "sendAsVoice": true, "type": "user|group" }`
	- Body (JSON) via base64 (wajib `mimeType`): `{ "to": "62812xxxxxx", "audioBase64": "<base64>", "mimeType": "audio/ogg", "filename": "voice.ogg", "sendAsVoice": true, "type": "user|group" }`

6) Resolve Chat ID (cek nomor/grup)
	- `POST /api/resolve-chat`
	- Body (JSON): `{ "to": "62812xxxxxx", "type": "user|group" }` atau `{ "to": "XXXXXXXX@g.us" }`
	- Response: `{ success: true, chatId: "...@c.us|...@g.us", exists: true|false, isGroup: true|false|null, name: string|null }`

Catatan:
- `to` dapat diisi nomor tanpa sufiks (akan diubah otomatis ke `@c.us` untuk user atau `@g.us` jika `type=group`), atau chatId lengkap (`xxx@c.us`/`xxx@g.us`).
- Untuk base64, sertakan `mimeType` yang sesuai (wajib untuk gambar; PDF otomatis `application/pdf`).

## Notes & Tips
- On Windows, logout is cross-platform using `fs.rm`.
- Make sure DB tables exist (e.g., `ip_list(ip_address, server_name)` for `ping server`).
 

## Scripts
- `npm run dev` uses nodemon
- `npm start` runs node directly
