/* eslint-disable no-console */
const express = require('express');
const http = require('http');
const path = require('path');
const WebSocket = require('ws');
const chokidar = require('chokidar');
const rateLimit = require('express-rate-limit');

const app = express();
app.set('trust proxy', true);

// Set up rate limiter: max 300 requests per 1 minute per IP
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 300, // limit each IP to 300 requests per windowMs
});
app.use(limiter);

const publicDir = path.join(process.cwd(), 'public');
app.use(express.static(publicDir));

// Fallback index if needed
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});
const server = http.createServer(app);

// WebSocket server on same HTTP server
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws, req) => {
  console.log('[live] client connected:', req.socket.remoteAddress);
  ws.send(JSON.stringify({ type: 'hello' }));
});

// Watch files in publicDir for changes
const watcher = chokidar.watch(publicDir, {
  ignored: /(^|[/\\])\../, // ignore dotfiles
  ignoreInitial: true,
});

watcher.on('all', (event, filePath) => {
  console.log(`[live] ${event} — ${filePath}`);
  const msg = JSON.stringify({ type: 'reload', event, path: filePath });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) client.send(msg);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`[live] server running at port ${PORT}`));
