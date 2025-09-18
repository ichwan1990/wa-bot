"use strict";

function requireApiKeyFactory(apiKey) {
  return function requireApiKey(req, res, next) {
    if (!apiKey) return next();
    const key = req.header('x-api-key');
    if (key && key === apiKey) return next();
    res.status(401).json({ success: false, error: 'Unauthorized' });
  };
}

module.exports = { requireApiKeyFactory };
