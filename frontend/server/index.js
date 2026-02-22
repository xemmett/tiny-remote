/**
 * Express server that proxies API requests to the FastAPI backend (tiny-remote).
 * Run the FastAPI server on port 8765 before using this frontend.
 */
import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FASTAPI_URL = process.env.FASTAPI_URL || 'http://localhost:8765';
const PORT = process.env.PORT || 3001;

const app = express();

app.use((req, res, next) => {
  console.log(`[express] ${req.method} ${req.url}`);
  next();
});
app.use(cors());

// Proxy /api/* to FastAPI
app.use('/api', createProxyMiddleware({
  target: FASTAPI_URL,
  changeOrigin: true,
  pathRewrite: { '^/api': '' },
  timeout: 10_000,
  proxyTimeout: 10_000,
  onError: (err, req, res) => {
    console.error('[proxy error]', err.message);
    res.status(502).json({ error: 'Backend unreachable. Is the FastAPI server running on ' + FASTAPI_URL + '?' });
  },
}));

// Proxy WebSocket /ws/* to FastAPI (same origin, no CORS)
app.use('/ws', createProxyMiddleware({
  target: FASTAPI_URL,
  changeOrigin: true,
  ws: true,
  onError: (err, req, res) => {
    console.error('[proxy ws error]', err.message);
  },
}));

app.use(express.json());

// In production, serve the built React app
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`[tiny-remote proxy] http://localhost:${PORT} -> ${FASTAPI_URL}`);
});
