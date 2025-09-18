"use strict";
const { MessageMedia } = require('whatsapp-web.js');

/**
 * Membuat MessageMedia dari URL atau base64.
 * @param {Object} p
 * @param {string} [p.url]
 * @param {string} [p.base64]
 * @param {string} [p.mimeType]
 * @param {string} [p.filename]
 * @param {string} [p.defaultName]
 */
async function createMediaFromInput({ url, base64, mimeType, filename, defaultName }) {
  if (base64) {
    if (!mimeType) throw new Error('mimeType required when sending base64');
    return new MessageMedia(mimeType, base64, filename || defaultName);
  }
  if (url) {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`fetch failed: ${resp.status}`);
    const buf = Buffer.from(await resp.arrayBuffer());
    const ct = mimeType || resp.headers.get('content-type') || 'application/octet-stream';
    const name = filename || (url.split('/').pop() || defaultName);
    return new MessageMedia(ct, buf.toString('base64'), name);
  }
  throw new Error('Either url or base64 must be provided');
}

module.exports = { createMediaFromInput };
