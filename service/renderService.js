"use strict";
let puppeteer;
try {
  // Prefer puppeteer if installed at root
  puppeteer = require('puppeteer');
} catch (_) {
  // Fallback: gunakan puppeteer bawaan dari whatsapp-web.js
  puppeteer = require('whatsapp-web.js/node_modules/puppeteer');
}

/**
 * Render HTML menjadi gambar PNG (full viewport sesuai konten).
 * @param {string} html
 * @returns {Promise<Buffer>}
 */
async function renderHtmlToImage(html) {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 10, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: 'networkidle0' });
    // auto-fit tinggi konten
    const bodyHeight = await page.evaluate(() => document.body.scrollHeight);
    await page.setViewport({ width: 1200, height: Math.max(400, Math.min(bodyHeight, 5000)), deviceScaleFactor: 2 });
    const buf = await page.screenshot({ type: 'png', fullPage: true });
    return buf;
  } finally {
    await browser.close();
  }
}

module.exports = { renderHtmlToImage };
