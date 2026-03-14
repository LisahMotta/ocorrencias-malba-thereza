const express = require('express');
const { WebSocketServer } = require('ws');
const http = require('http');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const db = require('./db');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

// Tratamento explícito do upgrade — necessário para Railway/proxies reversos
server.on('upgrade', (req, socket, head) => {
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, req);
  });
});

const JWT_SECRET = process.env.JWT_SECRET || 'malba-thereza-2025-secret-key';
const JWT_EXPIRA = '24h'; // 1 dia completo

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// ─── MIDDLEWARE JWT ───────────────────────────────────────────────────────────
function autenticar(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ erro: 'Não autenticado' });
  }
  try {
    req.usuario = jwt.verify(auth.slice(7), JWT_SECRET);
    next();
  } catch(err) {
    console.log('[auth] Token rejeitado:', err.message);
    res.status(401).json({ erro: 'Token inválido ou expirado. Faça login novamente.' });
  }
}

function exigePerfil(...perfis) {
  return (req, res, next) => {
    if (!req.usuario) return res.status(401).json({ erro: 'Não autenticado' });
    if (!perfis.includes(req.usuario.perfil)) {
      return res.status(403).json({ erro: 'Sem permissão' });
    }
    next();
  };
}

const PODE_EDIT = ['poc', 'coordenador', 'vice', 'diretor'];

// ─── CLIENTES WEBSOCKET ───────────────────────────────────────────────────────
const clients = new Map();

function broadcast(payload) {
  const msg = JSON.stringify(payload);
  let enviados = 0;
  // Usa wss.clients para garantir que TODOS os sockets conectados recebam
  wss.clients.forEach(ws => {
    if (ws.readyState === ws.OPEN) {
      ws.send(msg);
      enviados++;
    }
  });
  console.log(`[broadcast] ${payload.type} → ${enviados} cliente(s) conectado(s)`);
}

// ─── WEBSOCKET ────────────────────────────────────────────────────────────────
// Heartbeat — mantém conexão viva no Railway (timeout de 30s)
setInterval(() => {
  wss.clients.forEach(ws => {
    if (ws.isAlive === false) { ws.terminate(); return; }
    ws.isAlive = false;
    ws.ping();
  });
}, 25000);

wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  let userId = null;

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    if (msg.type === 'auth') {
      try {
        const payload = jwt.verify(msg.token, JWT_SECRET);
        userId = String(payload.id);
        if (!clients.has(userId)) clients.set(userId, new Set());
        clients.get(userId).add(ws);
        console.log(`[WS] Usuário autenticado: ${payload.nome} (${payload.perfil}) — total conectados: ${wss.clients.size}`);
        const todasOcc = db.listarOcc();
        // Ocorrências pendentes das últimas 2h — para notificar gestor que acabou de conectar
        const doisHAtras = Date.now() - (2 * 60 * 60 * 1000);
        const pendentesRecentes = todasOcc.filter(o => {
          if (o.status !== 'pendente') return false;
          try {
            // data formato dd/mm/yyyy
            const [dd,mm,yyyy] = (o.data||'').split('/');
            const hora = o.hora||'00:00';
            const [hh,mi] = hora.split(':');
            const ts = new Date(parseInt(yyyy), parseInt(mm)-1, parseInt(dd), parseInt(hh), parseInt(mi)).getTime();
            return ts >= doisHAtras;
          } catch { return false; }
        });
        ws.send(JSON.stringify({
          type: 'init',
          ocorrencias: todasOcc,
          chats: _todosChats(),
          pendentesRecentes, // gestor vai exibir notificações perdidas
        }));
      } catch {
        ws.send(JSON.stringify({ type: 'erro', msg: 'Token inválido' }));
      }
      return;
    }

    if (msg.type === 'chat_msg') {
      if (!userId) return;
      const usuario = db.getUsuario(parseInt(userId));
      if (!usuario) return;

      // Gestão sempre pode enviar
      // Professor só pode se a gestão já iniciou a conversa nesta ocorrência
      if (!PODE_EDIT.includes(usuario.perfil)) {
        const msgsOcc = db.listarChat(msg.occId);
        const gestaoJaFalou = msgsOcc.some(m =>
          PODE_EDIT.includes(m.remetente_perfil || m.remetentePerfil)
        );
        if (!gestaoJaFalou) return; // bloqueia professor se gestão não iniciou
      }
      const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const nova = db.inserirChat({
        occId: msg.occId, texto: msg.texto,
        remetenteId: parseInt(userId), remetenteNome: usuario.nome,
        remetentePerfil: usuario.perfil, hora,
      });
      // Normaliza para o frontend
      const msgNorm = {
        id:              Number(nova.id),
        occId:           Number(msg.occId),
        texto:           msg.texto,
        remetenteId:     parseInt(userId),
        remetenteNome:   usuario.nome,
        remetentePerfil: usuario.perfil,
        hora,
      };
      broadcast({ type: 'chat_msg', msg: msgNorm });
    }
  });

  ws.on('close', () => {
    if (userId && clients.has(userId)) {
      clients.get(userId).delete(ws);
      if (clients.get(userId).size === 0) clients.delete(userId);
    }
  });
});

function _todosChats() {
  const resultado = {};
  db.listarOcc().forEach(o => {
    const msgs = db.listarChat(o.id);
    if (msgs.length) {
      // Normaliza: remetenteId como número, occId como número
      resultado[String(o.id)] = msgs.map(m => ({
        ...m,
        id:          Number(m.id),
        occId:       Number(m.occ_id || o.id),
        remetenteId: Number(m.remetente_id || m.remetenteId),
        remetenteNome:   m.remetente_nome   || m.remetenteNome   || '',
        remetentePerfil: m.remetente_perfil || m.remetentePerfil || '',
        hora: m.hora || '',
      }));
    }
  });
  return resultado;
}

// ─── AUTH ─────────────────────────────────────────────────────────────────────
app.post('/api/auth/login', async (req, res) => {
  const { nome, senha } = req.body;
  if (!nome || !senha) return res.status(400).json({ erro: 'Informe nome e senha' });
  const usuario = db.getUsuarioNome(nome.trim().toUpperCase());
  if (!usuario) return res.status(401).json({ erro: 'Usuário não encontrado' });
  if (!usuario.ativo) return res.status(401).json({ erro: 'Usuário inativo' });
  const ok = await bcrypt.compare(senha, usuario.senha);
  if (!ok) return res.status(401).json({ erro: 'Senha incorreta' });
  const token = jwt.sign(
    { id: usuario.id, nome: usuario.nome, perfil: usuario.perfil },
    JWT_SECRET, { expiresIn: JWT_EXPIRA }
  );
  res.json({ token, usuario: { id: usuario.id, nome: usuario.nome, perfil: usuario.perfil } });
});

app.post('/api/auth/trocar-senha', autenticar, async (req, res) => {
  const { senhaAtual, novaSenha } = req.body;
  if (!senhaAtual || !novaSenha) return res.status(400).json({ erro: 'Preencha todos os campos' });
  if (novaSenha.length < 6) return res.status(400).json({ erro: 'Nova senha deve ter pelo menos 6 caracteres' });
  const usuario = db.getUsuario(req.usuario.id);
  const ok = await bcrypt.compare(senhaAtual, usuario.senha);
  if (!ok) return res.status(401).json({ erro: 'Senha atual incorreta' });
  const hash = await bcrypt.hash(novaSenha, 10);
  db.atualizarSenha(req.usuario.id, hash);
  res.json({ ok: true });
});

// ─── OCORRÊNCIAS ──────────────────────────────────────────────────────────────
app.get('/api/ocorrencias', autenticar, (req, res) => res.json(db.listarOcc()));

app.post('/api/ocorrencias', autenticar, (req, res) => {
  try {
    const nova = db.inserirOcc({
      ...req.body,
      registradoPorId: req.usuario.id,
      registradoPorNome: req.usuario.nome,
      registradoPorPerfil: req.usuario.perfil,
    });
    console.log(`[nova_ocorrencia] id=${nova.id} por ${nova.registradoPorNome} — clientes: ${wss.clients.size}`);
    broadcast({ type: 'nova_ocorrencia', occ: nova });
    res.json(nova);
  } catch(err) {
    console.error('[nova_ocorrencia] ERRO:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

app.patch('/api/ocorrencias/:id/complementar', autenticar, exigePerfil(...PODE_EDIT), (req, res) => {
  const occ = db.complementarOcc(parseInt(req.params.id), {
    ...req.body,
    complementadoPorId:    req.usuario.id,
    complementadoPorNome:  req.usuario.nome,
    complementadoPorPerfil:req.usuario.perfil,
  });
  if (!occ) return res.status(404).json({ erro: 'Não encontrada' });
  broadcast({ type: 'occ_atualizada', occ });
  res.json(occ);
});

app.patch('/api/ocorrencias/:id/editar', autenticar, exigePerfil(...PODE_EDIT), (req, res) => {
  const occ = db.editarOcc(parseInt(req.params.id), req.body);
  if (!occ) return res.status(404).json({ erro: 'Não encontrada' });
  broadcast({ type: 'occ_atualizada', occ });
  res.json(occ);
});

// ─── GESTÃO ───────────────────────────────────────────────────────────────────
app.get('/api/usuarios', autenticar, exigePerfil('diretor', 'coordenador', 'vice'), (req, res) => {
  res.json(db.listarUsuarios());
});

// Adicionar novo usuário
app.post('/api/usuarios', autenticar, exigePerfil('diretor', 'vice'), async (req, res) => {
  const { nome, perfil } = req.body;
  if (!nome || !perfil) return res.status(400).json({ erro: 'Nome e perfil obrigatórios' });
  const existe = db.getUsuarioNome(nome.trim().toUpperCase());
  if (existe) return res.status(400).json({ erro: 'Usuário já existe com este nome' });
  const hash = await bcrypt.hash('Malba@2025', 10);
  const id = db.inserirUsuario(nome.trim().toUpperCase(), perfil, hash);
  res.json({ ok: true, id, nome: nome.trim().toUpperCase(), perfil, novaSenha: 'Malba@2025' });
});

// Alterar perfil do usuário
app.patch('/api/usuarios/:id/perfil', autenticar, exigePerfil('diretor', 'vice'), (req, res) => {
  const { perfil } = req.body;
  if (!perfil) return res.status(400).json({ erro: 'Perfil obrigatório' });
  if (parseInt(req.params.id) === req.usuario.id) return res.status(400).json({ erro: 'Não é possível alterar seu próprio perfil' });
  try {
    db.atualizarPerfil(parseInt(req.params.id), perfil);
    // Verifica se salvou corretamente
    const u = db.getUsuario(parseInt(req.params.id));
    console.log(`[perfil] Usuário ${u.nome} → ${perfil} (salvo: ${u.perfil})`);
    if (u.perfil !== perfil) throw new Error('Perfil não foi salvo corretamente');
    // Notifica todos via WebSocket para recarregar se necessário
    broadcast({ type: 'perfil_atualizado', userId: parseInt(req.params.id), perfil });
    res.json({ ok: true, perfil: u.perfil });
  } catch(err) {
    console.error('[perfil] ERRO:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

// Resetar senha
app.post('/api/usuarios/:id/resetar-senha', autenticar, exigePerfil('diretor', 'vice'), async (req, res) => {
  const hash = await bcrypt.hash('Malba@2025', 10);
  db.atualizarSenha(parseInt(req.params.id), hash);
  res.json({ ok: true, novaSenha: 'Malba@2025' });
});

// Ativar/desativar usuário
app.post('/api/usuarios/:id/toggle', autenticar, exigePerfil('diretor', 'vice'), (req, res) => {
  if (parseInt(req.params.id) === req.usuario.id) return res.status(400).json({ erro: 'Não é possível desativar sua própria conta' });
  db.toggleUsuario(parseInt(req.params.id), req.body.ativo ? 1 : 0);
  res.json({ ok: true });
});

// ─── BACKUP ──────────────────────────────────────────────────────────────────

// Backup JSON completo
app.get('/api/backup/json', autenticar, exigePerfil('diretor','coordenador','vice'), (req, res) => {
  const ocorrencias = db.listarOcc();
  const usuarios = db.listarUsuarios();
  const payload = {
    geradoEm: new Date().toISOString(),
    geradoPor: req.usuario.nome,
    totalOcorrencias: ocorrencias.length,
    ocorrencias,
    usuarios,
  };
  res.setHeader('Content-Disposition', `attachment; filename="ocorrencias_backup_${new Date().toISOString().slice(0,10)}.json"`);
  res.json(payload);
});

// Backup CSV — ocorrências
app.get('/api/backup/csv', autenticar, exigePerfil('diretor','coordenador','vice'), (req, res) => {
  const ocorrencias = db.listarOcc();

  const cabecalho = [
    'ID','Número','Tipo','Data','Hora','Local','Gravidade','Turma',
    'Aluno(s)','RA(s)','Relato','Descrição','Providências',
    'B.O.','Família','Conselho Tutelar',
    'Registrado Por','Perfil Registrante',
    'Complementado Por','Data Complemento','Status'
  ].join(';');

  const linhas = ocorrencias.map(o => {
    const nomes = (o.alunos||[]).map(a=>a.nome).join(' | ');
    const ras   = (o.alunos||[]).map(a=>a.ra||'—').join(' | ');
    const cols = [
      o.id, o.numero,
      `"${(o.tipo||'').replace(/"/g,'""')}"`,
      o.data, o.hora,
      `"${(o.local||'').replace(/"/g,'""')}"`,
      o.gravidade, o.turma,
      `"${nomes.replace(/"/g,'""')}"`,
      `"${ras}"`,
      `"${(o.relato||'').replace(/"/g,'""')}"`,
      `"${(o.descricao||'').replace(/"/g,'""')}"`,
      `"${(o.providencias||'').replace(/"/g,'""')}"`,
      o.bo||'', o.familia||'', o.conselhoTutelar||'',
      `"${(o.registradoPorNome||'').replace(/"/g,'""')}"`,
      o.registradoPorPerfil||'',
      `"${(o.complementadoPorNome||'').replace(/"/g,'""')}"`,
      o.dataComp||'', o.status
    ];
    return cols.join(';');
  });

  const csv = [cabecalho, ...linhas].join("\n");
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="ocorrencias_backup_${new Date().toISOString().slice(0,10)}.csv"`);
  res.send(csv);
});

// ─── RESET (só diretor) ──────────────────────────────────────────────────────
app.post('/api/admin/resetar-ocorrencias', autenticar, exigePerfil('diretor','vice'), (req, res) => {
  try {
    db.resetarOcorrencias();
    broadcast({ type: 'init', ocorrencias: [], chats: {} });
    res.json({ ok: true, msg: 'Todas as ocorrências foram apagadas.' });
  } catch (err) {
    console.error('[reset] ERRO:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ─── SPA ──────────────────────────────────────────────────────────────────────
app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../public/index.html')));

// ─── START ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
db.inicializar().then(() => {
  server.listen(PORT, () => {
    console.log(`\n✅ Servidor rodando em http://localhost:${PORT}`);
    console.log(`   Banco: sql.js | JWT: ${JWT_EXPIRA}`);
    console.log(`   👉 Primeiro uso? rode: npm run seed\n`);
  });
}).catch(err => {
  console.error('Erro ao inicializar banco:', err);
  process.exit(1);
});
