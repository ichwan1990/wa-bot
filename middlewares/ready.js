"use strict";

function ensureClientReadyFactory(isReadyRef) {
  return function ensureClientReady(req, res, next) {
    if (!isReadyRef()) {
      return res.status(503).json({ success: false, error: 'WhatsApp client not ready' });
    }
    next();
  };
}

module.exports = { ensureClientReadyFactory };
