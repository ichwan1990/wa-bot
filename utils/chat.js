"use strict";

/**
 * Konversi nomor/ID menjadi chatId lengkap WhatsApp.
 * @param {string} to - Nomor atau chat id.
 * @param {'user'|'group'} [type='user'] - Jenis tujuan.
 * @returns {string}
 */
function toChatId(to, type = 'user') {
  if (!to) return '';
  const t = String(to).trim();
  if (t.includes('@')) return t; // already a full chat id
  const suffix = type === 'group' ? '@g.us' : '@c.us';
  return `${t}${suffix}`;
}

module.exports = { toChatId };
