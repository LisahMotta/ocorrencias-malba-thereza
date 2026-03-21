const express = require('express');
const { WebSocketServer } = require('ws');
const http = require('http');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const db = require('./db');

// ─── MULTER — upload de fotos (salvo fora de /public) ────────────────────────
const FOTOS_DIR = path.join(__dirname, '../uploads/fotos');
if (!fs.existsSync(FOTOS_DIR)) fs.mkdirSync(FOTOS_DIR, { recursive: true });

const _uploadFoto = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, FOTOS_DIR),
    filename: (req, file, cb) => {
      // Nome do arquivo: ra.<ext> — sem path traversal possível
      const ra = req.params.ra.replace(/[^a-zA-Z0-9_-]/g, '_');
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${ra}${ext}`);
    },
  }),
  limits: { fileSize: 3 * 1024 * 1024 }, // 3 MB máx
  fileFilter: (req, file, cb) => {
    if (/^image\/(jpeg|png|webp)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Somente imagens JPG, PNG ou WEBP são permitidas'));
  },
});

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
const JWT_EXPIRA = '30d'; // 30 dias — dados permanecem até exclusão explícita pela gestão

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

// ─── RATE LIMITING (login) ────────────────────────────────────────────────────
const tentativasLogin = new Map(); // ip → { count, bloqueadoAte }
setInterval(() => {
  const agora = Date.now();
  tentativasLogin.forEach((v, k) => {
    if (!v.bloqueadoAte || agora > v.bloqueadoAte + 10 * 60 * 1000) tentativasLogin.delete(k);
  });
}, 10 * 60 * 1000);

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

  ws.on('message', async (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    if (msg.type === 'auth') {
      // Etapa 1: verificar JWT — erros aqui forçam novo login no cliente
      let payload;
      try {
        payload = jwt.verify(msg.token, JWT_SECRET);
      } catch {
        ws.send(JSON.stringify({ type: 'erro', msg: 'Token inválido' }));
        return;
      }
      // Etapa 2: carregar dados — erros aqui não devem forçar logout
      try {
        userId = String(payload.id);
        if (!clients.has(userId)) clients.set(userId, new Set());
        clients.get(userId).add(ws);
        console.log(`[WS] Usuário autenticado: ${payload.nome} (${payload.perfil}) — total conectados: ${wss.clients.size}`);
        const todasOcc = await db.listarOcc();
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
          chats: await _todosChats(),
          pendentesRecentes,
        }));
      } catch(e) {
        console.error('[WS auth] Erro ao carregar dados:', e.message);
        // Envia init vazio para não deixar o cliente preso — não força logout
        ws.send(JSON.stringify({ type: 'init', ocorrencias: [], chats: {}, pendentesRecentes: [] }));
      }
      return;
    }

    if (msg.type === 'chat_msg') {
      if (!userId) return;
      const usuario = await db.getUsuario(parseInt(userId));
      if (!usuario) return;

      // Gestão sempre pode enviar
      // Professor só pode se a gestão já iniciou a conversa nesta ocorrência
      if (!PODE_EDIT.includes(usuario.perfil)) {
        const msgsOcc = await db.listarChat(msg.occId);
        const gestaoJaFalou = msgsOcc.some(m =>
          PODE_EDIT.includes(m.remetente_perfil || m.remetentePerfil)
        );
        if (!gestaoJaFalou) return; // bloqueia professor se gestão não iniciou
      }
      const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const nova = await db.inserirChat({
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

async function _todosChats() {
  const resultado = {};
  const occs = await db.listarOcc();
  for (const o of occs) {
    const msgs = await db.listarChat(o.id);
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
  }
  return resultado;
}

// ─── AUTH ─────────────────────────────────────────────────────────────────────
app.post('/api/auth/login', async (req, res) => {
  const ip = req.ip || req.connection.remoteAddress;
  const agora = Date.now();
  const t = tentativasLogin.get(ip) || { count: 0, bloqueadoAte: null };
  if (t.bloqueadoAte && agora < t.bloqueadoAte) {
    const restam = Math.ceil((t.bloqueadoAte - agora) / 1000 / 60);
    return res.status(429).json({ erro: `Muitas tentativas. Tente novamente em ${restam} minuto(s).` });
  }

  const { nome, senha } = req.body;
  if (!nome || !senha) return res.status(400).json({ erro: 'Informe nome e senha' });
  const usuario = await db.getUsuarioNome(nome.trim().toUpperCase());
  if (!usuario) return res.status(401).json({ erro: 'Usuário não encontrado' });
  if (!usuario.ativo) return res.status(401).json({ erro: 'Usuário inativo' });
  const ok = await bcrypt.compare(senha, usuario.senha);
  if (!ok) {
    t.count++;
    if (t.count >= 5) {
      t.bloqueadoAte = agora + 5 * 60 * 1000;
      console.log(`[auth] IP ${ip} bloqueado por 5min após ${t.count} tentativas`);
    }
    tentativasLogin.set(ip, t);
    return res.status(401).json({ erro: 'Senha incorreta' });
  }

  tentativasLogin.delete(ip);
  await db.inserirAuditoria(usuario.id, usuario.nome, 'login', { ip, perfil: usuario.perfil });
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
  const usuario = await db.getUsuario(req.usuario.id);
  const ok = await bcrypt.compare(senhaAtual, usuario.senha);
  if (!ok) return res.status(401).json({ erro: 'Senha atual incorreta' });
  const hash = await bcrypt.hash(novaSenha, 10);
  await db.atualizarSenha(req.usuario.id, hash);
  await db.inserirAuditoria(req.usuario.id, req.usuario.nome, 'trocar_senha', null);
  res.json({ ok: true });
});

// Renova o token silenciosamente sem precisar de nova senha
app.post('/api/auth/refresh', autenticar, async (req, res) => {
  const usuario = await db.getUsuario(req.usuario.id);
  if (!usuario || !usuario.ativo) return res.status(401).json({ erro: 'Usuário inativo' });
  const token = jwt.sign(
    { id: usuario.id, nome: usuario.nome, perfil: usuario.perfil },
    JWT_SECRET, { expiresIn: JWT_EXPIRA }
  );
  res.json({ token });
});

// ─── OCORRÊNCIAS ──────────────────────────────────────────────────────────────
app.get('/api/ocorrencias', autenticar, async (req, res) => res.json(await db.listarOcc()));

app.post('/api/ocorrencias', autenticar, async (req, res) => {
  const { tipo, numero, data, hora, local, gravidade, turma } = req.body;
  if (!tipo || !numero || !data || !hora || !local || !gravidade || !turma) {
    return res.status(400).json({ erro: 'Campos obrigatórios ausentes: tipo, numero, data, hora, local, gravidade, turma' });
  }
  try {
    const nova = await db.inserirOcc({
      ...req.body,
      registradoPorId: req.usuario.id,
      registradoPorNome: req.usuario.nome,
      registradoPorPerfil: req.usuario.perfil,
    });
    console.log(`[nova_ocorrencia] id=${nova.id} por ${nova.registradoPorNome} — clientes: ${wss.clients.size}`);
    await db.inserirAuditoria(req.usuario.id, req.usuario.nome, 'nova_ocorrencia', { occId: nova.id, tipo: nova.tipo, turma: nova.turma });
    broadcast({ type: 'nova_ocorrencia', occ: nova });
    res.json(nova);
  } catch(err) {
    console.error('[nova_ocorrencia] ERRO:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

app.patch('/api/ocorrencias/:id/complementar', autenticar, exigePerfil(...PODE_EDIT), async (req, res) => {
  const occ = await db.complementarOcc(parseInt(req.params.id), {
    ...req.body,
    complementadoPorId:    req.usuario.id,
    complementadoPorNome:  req.usuario.nome,
    complementadoPorPerfil:req.usuario.perfil,
  });
  if (!occ) return res.status(404).json({ erro: 'Não encontrada' });
  await db.inserirAuditoria(req.usuario.id, req.usuario.nome, 'complementar_ocorrencia', { occId: occ.id, tipo: occ.tipo });
  broadcast({ type: 'occ_atualizada', occ });
  res.json(occ);
});

app.patch('/api/ocorrencias/:id/editar', autenticar, exigePerfil(...PODE_EDIT), async (req, res) => {
  const occ = await db.editarOcc(parseInt(req.params.id), req.body);
  if (!occ) return res.status(404).json({ erro: 'Não encontrada' });
  await db.inserirAuditoria(req.usuario.id, req.usuario.nome, 'editar_ocorrencia', { occId: occ.id, campos: Object.keys(req.body) });
  broadcast({ type: 'occ_atualizada', occ });
  res.json(occ);
});

// ─── GESTÃO ───────────────────────────────────────────────────────────────────

// Lista pública — usada na tela de login (sem autenticação)
app.get('/api/usuarios/lista-publica', async (req, res) => {
  const lista = (await db.listarUsuarios()).filter(u => u.ativo).map(u => ({
    id: u.id, nome: u.nome, perfil: u.perfil,
  }));
  res.json(lista);
});

app.get('/api/usuarios', autenticar, exigePerfil('diretor', 'coordenador', 'vice'), async (req, res) => {
  res.json(await db.listarUsuarios());
});

// Adicionar novo usuário
app.post('/api/usuarios', autenticar, exigePerfil('diretor', 'vice'), async (req, res) => {
  const { nome, perfil } = req.body;
  if (!nome || !perfil) return res.status(400).json({ erro: 'Nome e perfil obrigatórios' });
  const existe = await db.getUsuarioNome(nome.trim().toUpperCase());
  if (existe) return res.status(400).json({ erro: 'Usuário já existe com este nome' });
  const hash = await bcrypt.hash('Malba@2025', 10);
  const id = await db.inserirUsuario(nome.trim().toUpperCase(), perfil, hash);
  await db.inserirAuditoria(req.usuario.id, req.usuario.nome, 'criar_usuario', { novoUsuario: nome.trim().toUpperCase(), perfil });
  res.json({ ok: true, id, nome: nome.trim().toUpperCase(), perfil, novaSenha: 'Malba@2025' });
});

// Alterar perfil do usuário
app.patch('/api/usuarios/:id/perfil', autenticar, exigePerfil('diretor', 'vice'), async (req, res) => {
  const { perfil } = req.body;
  if (!perfil) return res.status(400).json({ erro: 'Perfil obrigatório' });
  if (parseInt(req.params.id) === req.usuario.id) return res.status(400).json({ erro: 'Não é possível alterar seu próprio perfil' });
  try {
    await db.atualizarPerfil(parseInt(req.params.id), perfil);
    // Verifica se salvou corretamente
    const u = await db.getUsuario(parseInt(req.params.id));
    console.log(`[perfil] Usuário ${u.nome} → ${perfil} (salvo: ${u.perfil})`);
    if (u.perfil !== perfil) throw new Error('Perfil não foi salvo corretamente');
    await db.inserirAuditoria(req.usuario.id, req.usuario.nome, 'alterar_perfil', { usuarioAlvo: u.nome, perfilAnterior: u.perfil_anterior, perfilNovo: perfil });
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
  const alvo = await db.getUsuario(parseInt(req.params.id));
  const hash = await bcrypt.hash('Malba@2025', 10);
  await db.atualizarSenha(parseInt(req.params.id), hash);
  await db.inserirAuditoria(req.usuario.id, req.usuario.nome, 'resetar_senha', { usuarioAlvo: alvo?.nome });
  res.json({ ok: true, novaSenha: 'Malba@2025' });
});

// Ativar/desativar usuário
app.post('/api/usuarios/:id/toggle', autenticar, exigePerfil('diretor', 'vice'), async (req, res) => {
  if (parseInt(req.params.id) === req.usuario.id) return res.status(400).json({ erro: 'Não é possível desativar sua própria conta' });
  const alvo = await db.getUsuario(parseInt(req.params.id));
  await db.toggleUsuario(parseInt(req.params.id), req.body.ativo ? 1 : 0);
  await db.inserirAuditoria(req.usuario.id, req.usuario.nome, req.body.ativo ? 'ativar_usuario' : 'desativar_usuario', { usuarioAlvo: alvo?.nome });
  res.json({ ok: true });
});

// ─── BACKUP ──────────────────────────────────────────────────────────────────

// Backup JSON completo
app.get('/api/backup/json', autenticar, exigePerfil('diretor','coordenador','vice'), async (req, res) => {
  await db.inserirAuditoria(req.usuario.id, req.usuario.nome, 'exportar_backup', { formato: 'json' });
  const ocorrencias = await db.listarOcc();
  const usuarios = await db.listarUsuarios();
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
app.get('/api/backup/csv', autenticar, exigePerfil('diretor','coordenador','vice'), async (req, res) => {
  await db.inserirAuditoria(req.usuario.id, req.usuario.nome, 'exportar_backup', { formato: 'csv' });
  const ocorrencias = await db.listarOcc();

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

// ─── ALUNOS MONITORADOS ───────────────────────────────────────────────────────
const PODE_MONITORAR = ['poc', 'coordenador', 'vice', 'diretor'];

app.get('/api/alunos-monitorados', autenticar, exigePerfil(...PODE_MONITORAR), async (req, res) => {
  res.json(await db.listarMonitorados());
});

app.post('/api/alunos-monitorados', autenticar, exigePerfil(...PODE_MONITORAR), async (req, res) => {
  const { ra, nome, turma, motivo } = req.body;
  if (!ra || !nome) return res.status(400).json({ erro: 'RA e nome obrigatórios' });
  await db.inserirMonitorado(ra, nome, turma, motivo, req.usuario.nome);
  await db.inserirAuditoria(req.usuario.id, req.usuario.nome, 'sinalizar_aluno', { ra, nome, turma, motivo });
  res.json({ ok: true });
});

app.delete('/api/alunos-monitorados/:ra', autenticar, exigePerfil(...PODE_MONITORAR), async (req, res) => {
  const ra = decodeURIComponent(req.params.ra);
  const lista = await db.listarMonitorados();
  const aluno = lista.find(a => a.ra === ra);
  await db.removerMonitorado(ra);
  if (aluno) await db.inserirAuditoria(req.usuario.id, req.usuario.nome, 'remover_monitoramento', { ra, nome: aluno.nome });
  res.json({ ok: true });
});

// ─── AUDITORIA ────────────────────────────────────────────────────────────────
app.get('/api/auditoria', autenticar, exigePerfil('diretor', 'vice'), async (req, res) => {
  const limite = Math.min(parseInt(req.query.limite) || 200, 500);
  res.json(await db.listarAuditoria(limite));
});

// ─── RESET (só diretor) ──────────────────────────────────────────────────────
app.post('/api/admin/resetar-ocorrencias', autenticar, exigePerfil('diretor','vice'), async (req, res) => {
  try {
    const occs = await db.listarOcc();
    await db.inserirAuditoria(req.usuario.id, req.usuario.nome, 'resetar_ocorrencias', { totalApagadas: occs.length });
    await db.resetarOcorrencias();
    broadcast({ type: 'init', ocorrencias: [], chats: {} });
    res.json({ ok: true, msg: 'Todas as ocorrências foram apagadas.' });
  } catch (err) {
    console.error('[reset] ERRO:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ─── CARÔMETRO ────────────────────────────────────────────────────────────────
const PODE_VER_CAROMETRO    = ['professor', 'poc', 'coordenador', 'vice', 'diretor'];
const PODE_EDITAR_CAROMETRO = ['vice', 'diretor'];

// Bytes mágicos dos formatos permitidos
const MAGIC_BYTES = [
  { bytes: [0xFF, 0xD8, 0xFF],             tipo: 'image/jpeg' },
  { bytes: [0x89, 0x50, 0x4E, 0x47],       tipo: 'image/png'  },
  { bytes: [0x52, 0x49, 0x46, 0x46],       tipo: 'image/webp' }, // RIFF....WEBP
];
function _validarMagicBytes(filepath) {
  const buf = Buffer.alloc(12);
  const fd  = fs.openSync(filepath, 'r');
  fs.readSync(fd, buf, 0, 12, 0);
  fs.closeSync(fd);
  // WEBP: bytes 0-3 = RIFF, bytes 8-11 = WEBP
  if (buf.slice(0,4).toString() === 'RIFF' && buf.slice(8,12).toString() === 'WEBP') return true;
  return MAGIC_BYTES.slice(0, 2).some(m => m.bytes.every((b, i) => buf[i] === b));
}

// Rate limit: máx 60 fotos/minuto por usuário (impede scraping automatizado)
const _limiteVisualizacao = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  keyGenerator: (req) => req.usuario?.id || req.ip,
  handler: (req, res) => res.status(429).json({ erro: 'Muitas requisições. Aguarde um momento.' }),
  skip: (req) => !req.usuario, // autenticar já rejeita sem token; evita erro antes do middleware
});

// Rate limit: máx 10 uploads/hora por usuário
const _limiteUpload = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.usuario?.id || req.ip,
  handler: (req, res) => res.status(429).json({ erro: 'Limite de uploads atingido. Tente novamente mais tarde.' }),
});

// Lista metadados de todos os alunos com foto
app.get('/api/carometro', autenticar, exigePerfil(...PODE_VER_CAROMETRO), async (req, res) => {
  res.json(await db.listarFotos());
});

// Serve a foto protegida por JWT — nunca exposta como arquivo estático
app.get('/api/foto/:ra', autenticar, exigePerfil(...PODE_VER_CAROMETRO), _limiteVisualizacao, async (req, res) => {
  const ra = req.params.ra.replace(/[^a-zA-Z0-9_-]/g, '_');
  const registro = await db.getFoto(ra);
  if (!registro) return res.status(404).json({ erro: 'Foto não encontrada' });
  const filepath = path.join(FOTOS_DIR, registro.filename);
  if (!fs.existsSync(filepath)) return res.status(404).json({ erro: 'Arquivo não encontrado' });
  // Garante que o caminho resolvido está dentro de FOTOS_DIR (sem path traversal)
  if (!path.resolve(filepath).startsWith(path.resolve(FOTOS_DIR))) {
    return res.status(403).json({ erro: 'Acesso negado' });
  }
  // Registra visualização na auditoria (quem viu, qual aluno, quando)
  await db.inserirAuditoria(req.usuario.id, req.usuario.nome, 'visualizar_foto', { ra, alunoNome: registro.nome });
  // Cache curto e privado — não fica em cache de proxy/CDN
  res.setHeader('Cache-Control', 'private, no-store');
  // Inline impede que o navegador ofereça "Salvar como" automaticamente
  res.setHeader('Content-Disposition', `inline; filename="${ra}.jpg"`);
  // Impede que a foto seja embutida em outros sites (clickjacking de imagem)
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.sendFile(filepath);
});

// Upload ou substituição de foto
app.post('/api/foto/:ra', autenticar, exigePerfil(...PODE_EDITAR_CAROMETRO), _limiteUpload,
  (req, res, next) => _uploadFoto.single('foto')(req, res, (err) => {
    if (err) return res.status(400).json({ erro: err.message });
    next();
  }),
  async (req, res) => {
    if (!req.file) return res.status(400).json({ erro: 'Nenhum arquivo enviado' });
    // Valida bytes mágicos — rejeita arquivos que mentem a extensão
    if (!_validarMagicBytes(req.file.path)) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ erro: 'Arquivo inválido: não é uma imagem real.' });
    }
    const ra = req.params.ra.replace(/[^a-zA-Z0-9_-]/g, '_');
    const { nome, turma } = req.body;
    if (!nome) return res.status(400).json({ erro: 'Nome do aluno obrigatório' });
    // Remove arquivo antigo se existir e tiver nome diferente
    const antigo = await db.getFoto(ra);
    if (antigo && antigo.filename !== req.file.filename) {
      try { fs.unlinkSync(path.join(FOTOS_DIR, antigo.filename)); } catch {}
    }
    await db.salvarFoto(ra, nome.toUpperCase(), turma||'', req.file.filename, req.usuario.nome);
    await db.inserirAuditoria(req.usuario.id, req.usuario.nome, 'upload_foto', { ra, nome });
    res.json({ ok: true });
  }
);

// Remove foto
app.delete('/api/foto/:ra', autenticar, exigePerfil(...PODE_EDITAR_CAROMETRO), async (req, res) => {
  const ra = req.params.ra.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = await db.deletarFoto(ra);
  if (!filename) return res.status(404).json({ erro: 'Foto não encontrada' });
  try { fs.unlinkSync(path.join(FOTOS_DIR, filename)); } catch {}
  await db.inserirAuditoria(req.usuario.id, req.usuario.nome, 'deletar_foto', { ra });
  res.json({ ok: true });
});

// ─── SPA ──────────────────────────────────────────────────────────────────────
app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../public/index.html')));

// ─── BACKUP AUTOMÁTICO (apenas SQLite) ───────────────────────────────────────
function _fazerBackupAutomatico() {
  // No modo PostgreSQL, o banco persiste automaticamente — sem necessidade de backup de arquivo
  if (process.env.DATABASE_URL) return;
  try {
    const backupDir = path.join(
      process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(__dirname, '../data'),
      'backups'
    );
    fs.mkdirSync(backupDir, { recursive: true });
    const nome = `backup_${new Date().toISOString().slice(0, 10)}.db`;
    const destino = path.join(backupDir, nome);
    const origem = path.join(
      process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(__dirname, '../data'),
      'ocorrencias.db'
    );
    if (fs.existsSync(origem)) {
      fs.copyFileSync(origem, destino);
      console.log(`[backup-auto] Salvo: ${nome}`);
      // Manter apenas os últimos 30 backups
      const arquivos = fs.readdirSync(backupDir)
        .filter(f => f.startsWith('backup_') && f.endsWith('.db'))
        .sort();
      if (arquivos.length > 30) {
        arquivos.slice(0, arquivos.length - 30).forEach(f => {
          try { fs.unlinkSync(path.join(backupDir, f)); } catch {}
        });
      }
    }
  } catch(e) { console.error('[backup-auto] Erro:', e.message); }
}

// ─── AUTO-SEED ───────────────────────────────────────────────────────────────
async function _autoSeed() {
  console.log('\n🌱 Verificando usuários no banco...');
  const bcrypt = require('bcryptjs');
  const hash = await bcrypt.hash('Malba@2025', 10);
  const lista = [
    { nome: 'SANDRA REGINA XAVIER DA SILVA',                perfil: 'diretor'     },
    { nome: 'BRUNO PACHECO DOS SANTOS',                     perfil: 'vice'        },
    { nome: 'THAÍS JOSÉ SOARES',                            perfil: 'vice'        },
    { nome: 'MARIA CRISTINA DA SILVA',                      perfil: 'vice'        },
    { nome: 'ARIADNE DA SILVA RODRIGUES',                   perfil: 'coordenador' },
    { nome: 'WAGNER GONÇALVES DA SILVA JUNIOR FERRO FAZAN', perfil: 'coordenador' },
    { nome: 'RENATA VALÉRIA',                               perfil: 'coordenador' },
    { nome: 'ADRIANA PEREIRA DOS SANTOS',                   perfil: 'professor'   },
    { nome: 'ANA CLAUDIA PINHEIRO DA SILVA CRUZ',           perfil: 'professor'   },
    { nome: 'ARINE IWAMOTO SANCHES FAGUNDES',               perfil: 'professor'   },
    { nome: 'CAMILO DE LELIS AMARAL',                       perfil: 'professor'   },
    { nome: 'CRISTIANE SERPA QUILICI',                      perfil: 'professor'   },
    { nome: 'CRISTINA MARIA MARTINS LANDIM RIBEIRO',        perfil: 'professor'   },
    { nome: 'DALVA MARIA SILVÉRIO',                         perfil: 'professor'   },
    { nome: 'DANIEL CÉSAR DE OLIVEIRA',                     perfil: 'professor'   },
    { nome: 'DIANA RIBEIRO ANDRADE LIMA',                   perfil: 'professor'   },
    { nome: 'EDMILSON APARECIDO DE SOUSA',                  perfil: 'professor'   },
    { nome: 'ERICA DE PAULA APARECIDA CABERLIM',            perfil: 'professor'   },
    { nome: 'ERICK RODRIGUES DE CARVALHO',                  perfil: 'professor'   },
    { nome: 'EUNICE APARECIDA DE FARIA QUADROS',            perfil: 'professor'   },
    { nome: 'GABRIEL GUIDO DE ALMEIDA',                     perfil: 'professor'   },
    { nome: 'GIOVANNA PONTES SANTOS',                       perfil: 'professor'   },
    { nome: 'IVANILDA DE JESUS PAIVA',                      perfil: 'professor'   },
    { nome: 'JESSICA KAREN DOS SANTOS SOLEO',               perfil: 'professor'   },
    { nome: 'JOÃO FLAVIO FRAGA',                            perfil: 'professor'   },
    { nome: 'JUSCELENE SUMARA LESSA LANCELOTTI DI LUCCIO',  perfil: 'professor'   },
    { nome: 'KARINA DE SOUZA RIBEIRO',                      perfil: 'professor'   },
    { nome: 'KARINA KOIBUCHI SAKANE',                       perfil: 'professor'   },
    { nome: 'LAURENTINA ELIAS DUARTE',                      perfil: 'professor'   },
    { nome: 'LEACIRA FREITAS DE ANDRADES SIMAN',            perfil: 'professor'   },
    { nome: 'LUANA CRISTINA FERREIRA DE OLIVEIRA',          perfil: 'professor'   },
    { nome: 'MAGALI RAMOS FERREIRA',                        perfil: 'professor'   },
    { nome: 'MARIA CRISTINA DE ALMEIDA PORTO SILVA',        perfil: 'professor'   },
    { nome: 'MARIA DE FÁTIMA DIAS',                         perfil: 'professor'   },
    { nome: 'MAYARA SELMA PURCINO MACEDO',                  perfil: 'professor'   },
    { nome: 'MEIRE APARECIDA GAEFKE',                       perfil: 'professor'   },
    { nome: 'NILCELENA SOUZA PORTILHO',                     perfil: 'professor'   },
    { nome: 'PAULO CESAR ROCHA GOMES',                      perfil: 'professor'   },
    { nome: 'RENATA APARECIDA MOYSES DE FREITAS',           perfil: 'professor'   },
    { nome: 'ROSEANE MOREIRA DA SILVA SALES',               perfil: 'professor'   },
    { nome: 'SAMANTHA MARINA RIBEIRO MARTINS LEITE',        perfil: 'professor'   },
    { nome: 'SILVANA MÁRCIA DE SOUZA',                      perfil: 'professor'   },
    { nome: 'SILVIA FERREIRA LOPES DE OLIVEIRA',            perfil: 'professor'   },
    { nome: 'SIOMARA VILELA PRADO FONSECA',                 perfil: 'professor'   },
    { nome: 'SOLANGE SANTOS ARAÚJO',                        perfil: 'professor'   },
    { nome: 'SONIA MARIA DA SILVA GABRIEL',                 perfil: 'professor'   },
    { nome: 'THIAGO JOSÉ DIOGO ALVES OLIVEIRA',             perfil: 'professor'   },
    { nome: 'VICENTE CESAR DA SILVA',                       perfil: 'professor'   },
    { nome: 'VIVIANE SANTOS DE OLIVEIRA',                   perfil: 'professor'   },
    { nome: 'WALDINEIA CRISTINA RODRIGUES DOS SANTOS',      perfil: 'professor'   },
    { nome: 'WELLINGTON ROBERTO GALVAO BORGES DE OLIVEIRA', perfil: 'professor'   },
    // Agentes de Organização Escolar
    { nome: 'KÁTIA MARA FERREIRA DIAS MARTINS',             perfil: 'agente'      },
    { nome: 'ALINE BAUMGARTER',                             perfil: 'agente'      },
    { nome: 'ELISABETH APARECIDA BERNARDES DE FARIA',       perfil: 'agente'      },
    { nome: 'LILIAN DAS GRAÇAS DA SILVA NEVES',             perfil: 'agente'      },
    { nome: 'PEDRO DINIZ SILVEIRA DAS NEVES',               perfil: 'agente'      },
    { nome: 'LUCIMAR DE OLIVEIRA SANTOS',                   perfil: 'agente'      },
    { nome: 'MARIA APARECIDA GOMES FRANCISCO',              perfil: 'agente'      },
    { nome: 'RODOLFO JESUS DO PRADO FILHO',                 perfil: 'agente'      },
    // Secretaria de Escola
    { nome: 'ROSEMARY ALVES FERREIRA ANDRADE EUGÊNIO',      perfil: 'secretaria'  },
    // Gerente de Organização Escolar
    { nome: 'VANESSA OSÓRIO VENTURA',                       perfil: 'gerente'     },
  ];
  // Busca todos os usuários de uma vez, incluindo inativos (getUsuarioNome filtra
  // por ativo=1 e causaria recriação de usuários desativados com senha padrão)
  const todosUsuarios = await db.listarUsuarios();
  const mapaUsuarios = new Map(todosUsuarios.map(u => [u.nome, u]));

  let criados = 0, atualizados = 0;
  for (const u of lista) {
    const existente = mapaUsuarios.get(u.nome);
    if (!existente) {
      await db.inserirUsuario(u.nome, u.perfil, hash);
      criados++;
    } else if (existente.perfil !== u.perfil) {
      await db.atualizarPerfil(existente.id, u.perfil);
      atualizados++;
    }
  }
  if (criados > 0) console.log(`✅ ${criados} usuário(s) novo(s) criado(s) com senha padrão Malba@2025\n`);
  if (atualizados > 0) console.log(`✅ ${atualizados} perfil(is) atualizado(s)\n`);
  if (criados === 0 && atualizados === 0) console.log('✅ Todos os usuários já cadastrados e atualizados.\n');
}

// ─── START ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
const DB_TIPO = process.env.DATABASE_URL ? 'PostgreSQL' : 'SQLite';
db.inicializar().then(async () => {
  await _autoSeed();
  server.listen(PORT, () => {
    console.log(`\n✅ Servidor rodando em http://localhost:${PORT}`);
    console.log(`   Banco: ${DB_TIPO} | JWT: ${JWT_EXPIRA}`);
    if (!process.env.DATABASE_URL) {
      console.log('   ⚠️  Usando SQLite local — configure DATABASE_URL (PostgreSQL) para persistência no Railway');
    }
  });
  // Backup automático diário (apenas SQLite — executa 1h após o start e depois a cada 24h)
  if (!process.env.DATABASE_URL) {
    setTimeout(() => {
      _fazerBackupAutomatico();
      setInterval(_fazerBackupAutomatico, 24 * 60 * 60 * 1000);
    }, 60 * 60 * 1000);
  }
}).catch(err => {
  console.error('Erro ao inicializar banco:', err);
  process.exit(1);
});
