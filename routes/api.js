"use strict";
const express = require('express');
const { toChatId } = require('../utils/chat');
const { createMediaFromInput } = require('../utils/media');

function buildApiRouter(client, ensureClientReady, requireApiKey) {
  const router = express.Router();

  // Status endpoint tanpa auth agar mudah dicek
  router.get('/status', (req, res) => {
    try {
      const info = client?.info;
      res.json({ success: true, ready: !!info, number: info?.wid?.user || null });
    } catch (_) {
      res.json({ success: false, ready: false, number: null });
    }
  });

  // Auth + readiness untuk endpoint lain
  router.use(requireApiKey, ensureClientReady);

  router.post('/send-text', async (req, res) => {
    try {
      const { to, message, type } = req.body || {};
      if (!to || !message) return res.status(400).json({ success: false, error: 'Missing to or message' });
      const chatId = toChatId(to, type);
      const msg = await client.sendMessage(chatId, message);
      res.json({ success: true, id: msg.id?._serialized || null });
    } catch (e) {
      console.error('send-text error:', e);
      res.status(500).json({ success: false, error: e.message || 'Internal error' });
    }
  });

  router.post('/send-image', async (req, res) => {
    try {
      const { to, caption, imageUrl, imageBase64, mimeType, filename, type } = req.body || {};
      if (!to || (!imageUrl && !imageBase64)) return res.status(400).json({ success: false, error: 'Missing to and imageUrl/imageBase64' });
      const chatId = toChatId(to, type);
      const media = await createMediaFromInput({ url: imageUrl, base64: imageBase64, mimeType, filename, defaultName: 'image.jpg' });
      const msg = await client.sendMessage(chatId, media, caption ? { caption } : {});
      res.json({ success: true, id: msg.id?._serialized || null });
    } catch (e) {
      console.error('send-image error:', e);
      res.status(500).json({ success: false, error: e.message || 'Internal error' });
    }
  });

  router.post('/send-pdf', async (req, res) => {
    try {
      const { to, caption, fileUrl, fileBase64, filename, type } = req.body || {};
      if (!to || (!fileUrl && !fileBase64)) return res.status(400).json({ success: false, error: 'Missing to and fileUrl/fileBase64' });
      const chatId = toChatId(to, type);
      const media = await createMediaFromInput({ url: fileUrl, base64: fileBase64, mimeType: 'application/pdf', filename, defaultName: 'file.pdf' });
      const msg = await client.sendMessage(chatId, media, caption ? { caption } : {});
      res.json({ success: true, id: msg.id?._serialized || null });
    } catch (e) {
      console.error('send-pdf error:', e);
      res.status(500).json({ success: false, error: e.message || 'Internal error' });
    }
  });

  router.post('/send-document', async (req, res) => {
    try {
      const { to, caption, fileUrl, fileBase64, filename, mimeType, type } = req.body || {};
      if (!to || (!fileUrl && !fileBase64)) return res.status(400).json({ success: false, error: 'Missing to and fileUrl/fileBase64' });
      if (fileBase64 && !mimeType) return res.status(400).json({ success: false, error: 'mimeType is required when sending base64' });
      const chatId = toChatId(to, type);
      const media = await createMediaFromInput({ url: fileUrl, base64: fileBase64, mimeType, filename, defaultName: 'file.bin' });
      const msg = await client.sendMessage(chatId, media, caption ? { caption } : {});
      res.json({ success: true, id: msg.id?._serialized || null });
    } catch (e) {
      console.error('send-document error:', e);
      res.status(500).json({ success: false, error: e.message || 'Internal error' });
    }
  });

  router.post('/send-audio', async (req, res) => {
    try {
      const { to, caption, audioUrl, audioBase64, mimeType, filename, sendAsVoice, type } = req.body || {};
      if (!to || (!audioUrl && !audioBase64)) return res.status(400).json({ success: false, error: 'Missing to and audioUrl/audioBase64' });
      if (audioBase64 && !mimeType) return res.status(400).json({ success: false, error: 'mimeType is required when sending base64' });
      const chatId = toChatId(to, type);
      const media = await createMediaFromInput({ url: audioUrl, base64: audioBase64, mimeType, filename, defaultName: 'audio.ogg' });
      const options = {};
      if (sendAsVoice) options.sendAudioAsVoice = true;
      if (caption) options.caption = caption;
      const msg = await client.sendMessage(chatId, media, options);
      res.json({ success: true, id: msg.id?._serialized || null });
    } catch (e) {
      console.error('send-audio error:', e);
      res.status(500).json({ success: false, error: e.message || 'Internal error' });
    }
  });

  router.post('/resolve-chat', async (req, res) => {
    try {
      const { to, type } = req.body || {};
      if (!to && !type) return res.status(400).json({ success: false, error: 'Missing to or type' });
      if (String(to).includes('@')) {
        try {
          const chat = await client.getChatById(String(to));
          return res.json({ success: true, chatId: String(to), exists: true, isGroup: !!chat?.isGroup, name: chat?.name || null });
        } catch {
          return res.json({ success: true, chatId: String(to), exists: false, isGroup: null, name: null });
        }
      }
      if (type === 'group') {
        const chatId = toChatId(to, 'group');
        try {
          const chat = await client.getChatById(chatId);
          return res.json({ success: true, chatId, exists: true, isGroup: !!chat?.isGroup, name: chat?.name || null });
        } catch {
          return res.json({ success: true, chatId, exists: false, isGroup: null, name: null });
        }
      }
      try {
        const result = await client.getNumberId(String(to));
        if (!result) return res.json({ success: true, chatId: null, exists: false, isGroup: false, name: null });
        const chatId = result._serialized;
        return res.json({ success: true, chatId, exists: true, isGroup: false, name: null });
      } catch (e) {
        return res.status(500).json({ success: false, error: e.message || 'Failed to resolve number' });
      }
    } catch (e) {
      res.status(500).json({ success: false, error: e.message || 'Internal error' });
    }
  });

  return router;
}

module.exports = { buildApiRouter };
