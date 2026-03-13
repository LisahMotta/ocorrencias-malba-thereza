const express = require('express');
const { WebSocketServer } = require('ws');
const http = require('http');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// ─── ESTADO EM MEMÓRIA ────────────────────────────────────────────────────────
// Em produção, substitua por banco de dados (PostgreSQL, SQLite, etc.)
const state = {
  ocorrencias: [],
  chats: {},       // chatId → [mensagens]
  nextOccId: 1,
};

// ─── CLIENTES WEBSOCKET ───────────────────────────────────────────────────────
// Map: userId → Set de WebSockets (um usuário pode ter múltiplas abas)
const clients = new Map();

function broadcast(userIds, payload) {
  const msg = JSON.stringify(payload);
  userIds.forEach(uid => {
    const sockets = clients.get(uid);
    if (!sockets) return;
    sockets.forEach(ws => {
      if (ws.readyState === ws.OPEN) ws.send(msg);
    });
  });
}

function broadcastAll(payload) {
  const msg = JSON.stringify(payload);
  clients.forEach(sockets => {
    sockets.forEach(ws => {
      if (ws.readyState === ws.OPEN) ws.send(msg);
    });
  });
}

// ─── WEBSOCKET ────────────────────────────────────────────────────────────────
wss.on('connection', (ws) => {
  let userId = null;

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    // Registro do cliente
    if (msg.type === 'auth') {
      userId = String(msg.userId);
      if (!clients.has(userId)) clients.set(userId, new Set());
      clients.get(userId).add(ws);

      // Envia ocorrências existentes e chats ao conectar
      ws.send(JSON.stringify({
        type: 'init',
        ocorrencias: state.ocorrencias,
        chats: state.chats,
      }));
      return;
    }

    // Mensagem de chat
    if (msg.type === 'chat_msg') {
      const { occId, texto, remetenteId, remetenteNome, remetentePerfil } = msg;
      const chatId = String(occId);
      if (!state.chats[chatId]) state.chats[chatId] = [];

      const novaMsg = {
        id: uuidv4(),
        occId,
        texto,
        remetenteId,
        remetenteNome,
        remetentePerfil,
        hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        timestamp: Date.now(),
      };
      state.chats[chatId].push(novaMsg);

      // Envia para todos os clientes conectados
      broadcastAll({ type: 'chat_msg', msg: novaMsg });
      return;
    }

    // Marcar notificação como lida
    if (msg.type === 'notif_lida') {
      const occ = state.ocorrencias.find(o => o.id === msg.occId);
      if (occ) {
        if (!occ.notifLidas) occ.notifLidas = [];
        if (!occ.notifLidas.includes(userId)) occ.notifLidas.push(userId);
      }
      return;
    }
  });

  ws.on('close', () => {
    if (userId && clients.has(userId)) {
      clients.get(userId).delete(ws);
      if (clients.get(userId).size === 0) clients.delete(userId);
    }
  });
});

// ─── API REST ─────────────────────────────────────────────────────────────────

// Listar ocorrências
app.get('/api/ocorrencias', (req, res) => {
  res.json(state.ocorrencias);
});

// Registrar nova ocorrência
app.post('/api/ocorrencias', (req, res) => {
  const occ = {
    ...req.body,
    id: state.nextOccId++,
    status: 'pendente',
    criadoEm: new Date().toISOString(),
    notifLidas: [],
  };
  state.ocorrencias.push(occ);

  // Notifica todos os gestores conectados
  const payload = {
    type: 'nova_ocorrencia',
    occ,
  };
  broadcastAll(payload);

  res.json(occ);
});

// Complementar ocorrência
app.patch('/api/ocorrencias/:id/complementar', (req, res) => {
  const occ = state.ocorrencias.find(o => o.id === parseInt(req.params.id));
  if (!occ) return res.status(404).json({ erro: 'Não encontrada' });

  Object.assign(occ, req.body, {
    status: 'encerrado',
    dataComp: new Date().toLocaleDateString('pt-BR'),
  });

  broadcastAll({ type: 'occ_atualizada', occ });
  res.json(occ);
});

// Editar ocorrência (gravidade, tipo, relato)
app.patch('/api/ocorrencias/:id/editar', (req, res) => {
  const occ = state.ocorrencias.find(o => o.id === parseInt(req.params.id));
  if (!occ) return res.status(404).json({ erro: 'Não encontrada' });

  Object.assign(occ, req.body);
  broadcastAll({ type: 'occ_atualizada', occ });
  res.json(occ);
});

// Buscar chat de uma ocorrência
app.get('/api/chats/:occId', (req, res) => {
  res.json(state.chats[req.params.occId] || []);
});

// Rota catch-all para SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// ─── INICIAR ──────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n✅ Servidor rodando em http://localhost:${PORT}`);
  console.log(`   WebSocket ativo na mesma porta`);
  console.log(`   EE Professora Malba Thereza Ferraz Campaner — Protocolo 179\n`);
});
