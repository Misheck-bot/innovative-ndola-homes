// Catch-all Vercel serverless function to route any /api/* path into the Express app
// Reuse the handler exported by api/index.js
module.exports = require('./index.js');
