"use strict";
const { MessageMedia } = require('whatsapp-web.js');

/**
 * Buat MessageMedia PNG dari Buffer.
 * @param {Buffer} buffer
 * @param {string} [filename]
 */
function mediaFromPngBuffer(buffer, filename = 'report.png') {
  const base64 = buffer.toString('base64');
  return new MessageMedia('image/png', base64, filename);
}

module.exports = { mediaFromPngBuffer };
