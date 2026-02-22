# Tiny Remote — Frontend

React + Tailwind UI with an Express proxy to the FastAPI backend. Console-style, hacker aesthetic.

## Setup

1. **Run the FastAPI server** (from the project root):
   ```bash
   python main.py
   ```
   It must be listening on `http://localhost:8765`.

2. **Install and run the frontend** (from this folder):
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   - Vite dev server: **http://localhost:5173**
   - Express proxy: **http://localhost:3001** (proxies `/api` → FastAPI)

In development, the React app (Vite) proxies `/api` to the Express server, which forwards to FastAPI.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Run Vite + Express together |
| `npm run dev:client` | Run only Vite (React) |
| `npm run dev:server` | Run only Express proxy |
| `npm run build` | Build React app for production |
| `npm run preview` | Preview production build |
| `npm start` | Run Express only (serve built app if `NODE_ENV=production`) |

## Env (optional)

- `FASTAPI_URL` — FastAPI base URL (default: `http://localhost:8765`)
- `PORT` — Express port (default: `3001`)

## Production

```bash
npm run build
NODE_ENV=production npm start
```

Express will serve the built React app and proxy `/api` to FastAPI.
