# WA Bot REST API

Dokumentasi ini menjelaskan cara memakai REST API untuk mengirim pesan WhatsApp melalui aplikasi ini.

## Ringkasan
- Base URL: `http://localhost:3000`
- Format: JSON request/response
- Autentikasi: Header `x-api-key: <API_KEY>` (opsional; wajib jika `API_KEY` di `.env` diisi)
- Kesiapan: WhatsApp client harus `ready` (lihat `GET /api/status`)

## Autentikasi
Jika Anda mengisi `API_KEY` pada `.env`, sertakan header berikut pada setiap request API kirim pesan:
```
x-api-key: YOUR_API_KEY
```

## Status Client
GET `/api/status`
- Response:
```json
{ "success": true, "ready": true, "number": "62812xxxxxxx" }
```

## Kirim Teks
POST `/api/send-text`
- Body:
```json
{ "to": "62812xxxxxxx", "message": "Halo", "type": "user" }
```
- Catatan: `type` opsional. Pilihan: `user` (default) atau `group`.
- Contoh PowerShell:
```powershell
curl -X POST http://localhost:3000/api/send-text `
  -H "Content-Type: application/json" `
  -H "x-api-key: YOUR_API_KEY" `
  -d '{ "to": "62812xxxxxxx", "message": "Halo", "type": "user" }'
```
- Response:
```json
{ "success": true, "id": "true_62812...@c.us_..." }
```

## Kirim Gambar
POST `/api/send-image`
- Body via URL:
```json
{ "to": "62812xxxxxxx", "imageUrl": "https://example.com/foto.jpg", "caption": "Gambar", "type": "user" }
```
- Body via base64 (wajib `mimeType`):
```json
{ "to": "62812xxxxxxx", "imageBase64": "<BASE64>", "mimeType": "image/jpeg", "filename": "foto.jpg", "caption": "Gambar" }
```
- Response:
```json
{ "success": true, "id": "..." }
```

## Kirim PDF
POST `/api/send-pdf`
- Body via URL:
```json
{ "to": "62812xxxxxxx", "fileUrl": "https://example.com/dokumen.pdf", "filename": "dokumen.pdf", "caption": "PDF", "type": "group" }
```
- Body via base64:
```json
{ "to": "62812xxxxxxx", "fileBase64": "<BASE64>", "filename": "dokumen.pdf" }
```

## Kirim Dokumen (Non-PDF)
POST `/api/send-document`
- Body via URL:
```json
{ "to": "62812xxxxxxx", "fileUrl": "https://example.com/file.docx", "filename": "file.docx", "caption": "Dokumen" }
```
- Body via base64 (wajib `mimeType`):
```json
{ "to": "62812xxxxxxx", "fileBase64": "<BASE64>", "mimeType": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "filename": "file.docx" }
```

## Kirim Audio / Voice Note
POST `/api/send-audio`
- Body via URL:
```json
{ "to": "62812xxxxxxx", "audioUrl": "https://example.com/voice.ogg", "filename": "voice.ogg", "sendAsVoice": true }
```
- Body via base64 (wajib `mimeType`):
```json
{ "to": "62812xxxxxxx", "audioBase64": "<BASE64>", "mimeType": "audio/ogg", "filename": "voice.ogg", "sendAsVoice": true }
```

## Resolve Chat ID
POST `/api/resolve-chat`
- Body contoh (user):
```json
{ "to": "62812xxxxxxx", "type": "user" }
```
- Body contoh (grup by id singkat):
```json
{ "to": "1203630xxxxxxxx", "type": "group" }
```
- Body contoh (chat id penuh):
```json
{ "to": "1203630xxxxxxxx@g.us" }
```
- Response contoh:
```json
{ "success": true, "chatId": "1203630xxxxxxxx@g.us", "exists": true, "isGroup": true, "name": "Nama Grup" }
```

## Catatan Umum
- Field `to` bisa nomor hp saja (akan jadi `@c.us`) atau chatId penuh (`...@c.us`/`...@g.us`). Jika mengirim ke grup, gunakan `type: "group"` atau chatId `...@g.us`.
- Untuk konten base64, pastikan `mimeType` sesuai (gambar/audio wajib). PDF otomatis `application/pdf`.
- Semua endpoint kirim pesan memerlukan WhatsApp client `ready`. Gunakan `GET /api/status` untuk cek.
