# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install        # Install dependencies
npm start          # Start server (node server/index.js)
npm run dev        # Start with nodemon (auto-restart on change)
npm run seed       # Create initial users in DB (run once after deploy)
```

No test suite. Syntax-check JS files with `node --check <file>`.

## Architecture

**Vanilla JS SPA** served by an **Express** backend. No build step, no bundler — changes to `public/` are live immediately.

### Backend (`server/`)
- **`index.js`** — Express app, JWT auth middleware, all REST routes, WebSocket server (`ws`), file uploads (`multer`). Routes follow the pattern: `autenticar` → `exigePerfil(...)` → handler. The SPA fallback (`res.sendFile('index.html')`) must stay last.
- **`db.js`** — All DB access. Exports a single `module.exports = { ... }` object with async methods. Supports both **PostgreSQL** (Railway, via `pg`) and **SQLite** (local, via `sql.js` in-memory). The `USE_PG` flag switches modes. **Critical**: all functions must be inside the `module.exports = { ... }` block — code after the closing `};` causes SyntaxError on startup.
- **`seed.js`** — Creates initial users. Re-running is safe.

### Frontend (`public/`)
- **`index.html`** — Single HTML file, all tab panels, all modals. Tabs: dashboard, ocorrências, frequência, gestão (diretor only), chat, Busca Ativa (coordenador/vice/diretor only).
- **`js/app.js`** — All UI logic. Tab switching via `showTab(name, btn)`. Auth state from `getUsuario()` (parsed JWT). API calls via `apiFetch(path, opts)` which adds the Bearer token. WebSocket events from `ws.js` trigger re-renders.
- **`js/auth.js`** — JWT storage/retrieval from `localStorage`.
- **`js/ws.js`** — WebSocket client. Dispatches events like `ocorrencia_nova`, `busca_ativa_nova`, etc. that `app.js` listens to.
- **`sw.js`** — Service Worker with network-first strategy. Cache version string (`sisroe-vN`) must be bumped whenever static assets change.

### DB Schema (key tables)
- `usuarios` — perfil: `professor | coordenador | vice | diretor`
- `ocorrencias` — school incident records
- `frequencia_diaria`, `dias_letivos` — attendance tracking
- `busca_ativa` — active student search cases (visible to coordenador/vice/diretor)
- `acoes_busca_ativa` — action log per Busca Ativa case
- `auditoria` — audit log for sensitive actions

### Auth / Permissions
JWT issued at login (8h expiry). `exigePerfil(...roles)` middleware enforces role-based access server-side. Frontend hides UI elements based on `cu.perfil` from the decoded JWT, but server is the authority.

### Railway Deployment
- Deployed from `main` branch. Healthcheck: `GET /` with 30s timeout — server crash = healthcheck failure.
- Add env var `JWT_SECRET` on Railway. Run `npm run seed` in Railway terminal after first deploy.
- PostgreSQL addon provides `DATABASE_URL` automatically; `db.js` reads it to enable `USE_PG`.
- `railway.toml` configures build/start commands and healthcheck path.

### Real-time sync
WebSocket broadcasts in `server/index.js` (`broadcast({ type, ... })`) push updates to all connected clients. `ws.js` receives them and fires DOM event handlers registered in `app.js`. New event types require: (1) broadcast call in route, (2) handler in `ws.js` or `app.js`.
