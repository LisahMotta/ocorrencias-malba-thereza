const express = require('express');
const { WebSocketServer } = require('ws');
const http = require('http');
const fs = require('fs');
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
  const ip = req.ip || req.connection.remoteAddress;
  const agora = Date.now();
  const t = tentativasLogin.get(ip) || { count: 0, bloqueadoAte: null };
  if (t.bloqueadoAte && agora < t.bloqueadoAte) {
    const restam = Math.ceil((t.bloqueadoAte - agora) / 1000 / 60);
    return res.status(429).json({ erro: `Muitas tentativas. Tente novamente em ${restam} minuto(s).` });
  }

  const { nome, senha } = req.body;
  if (!nome || !senha) return res.status(400).json({ erro: 'Informe nome e senha' });
  const usuario = db.getUsuarioNome(nome.trim().toUpperCase());
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
  db.inserirAuditoria(usuario.id, usuario.nome, 'login', { ip, perfil: usuario.perfil });
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
  db.inserirAuditoria(req.usuario.id, req.usuario.nome, 'trocar_senha', null);
  res.json({ ok: true });
});

// ─── OCORRÊNCIAS ──────────────────────────────────────────────────────────────
app.get('/api/ocorrencias', autenticar, (req, res) => res.json(db.listarOcc()));

app.post('/api/ocorrencias', autenticar, (req, res) => {
  const { tipo, numero, data, hora, local, gravidade, turma } = req.body;
  if (!tipo || !numero || !data || !hora || !local || !gravidade || !turma) {
    return res.status(400).json({ erro: 'Campos obrigatórios ausentes: tipo, numero, data, hora, local, gravidade, turma' });
  }
  try {
    const nova = db.inserirOcc({
      ...req.body,
      registradoPorId: req.usuario.id,
      registradoPorNome: req.usuario.nome,
      registradoPorPerfil: req.usuario.perfil,
    });
    console.log(`[nova_ocorrencia] id=${nova.id} por ${nova.registradoPorNome} — clientes: ${wss.clients.size}`);
    db.inserirAuditoria(req.usuario.id, req.usuario.nome, 'nova_ocorrencia', { occId: nova.id, tipo: nova.tipo, turma: nova.turma });
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
  db.inserirAuditoria(req.usuario.id, req.usuario.nome, 'complementar_ocorrencia', { occId: occ.id, tipo: occ.tipo });
  broadcast({ type: 'occ_atualizada', occ });
  res.json(occ);
});

app.patch('/api/ocorrencias/:id/editar', autenticar, exigePerfil(...PODE_EDIT), (req, res) => {
  const occ = db.editarOcc(parseInt(req.params.id), req.body);
  if (!occ) return res.status(404).json({ erro: 'Não encontrada' });
  db.inserirAuditoria(req.usuario.id, req.usuario.nome, 'editar_ocorrencia', { occId: occ.id, campos: Object.keys(req.body) });
  broadcast({ type: 'occ_atualizada', occ });
  res.json(occ);
});

// ─── GESTÃO ───────────────────────────────────────────────────────────────────

// Lista pública — usada na tela de login (sem autenticação)
app.get('/api/usuarios/lista-publica', (req, res) => {
  const lista = db.listarUsuarios().filter(u => u.ativo).map(u => ({
    id: u.id, nome: u.nome, perfil: u.perfil,
  }));
  res.json(lista);
});

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
  db.inserirAuditoria(req.usuario.id, req.usuario.nome, 'criar_usuario', { novoUsuario: nome.trim().toUpperCase(), perfil });
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
    db.inserirAuditoria(req.usuario.id, req.usuario.nome, 'alterar_perfil', { usuarioAlvo: u.nome, perfilAnterior: u.perfil_anterior, perfilNovo: perfil });
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
  const alvo = db.getUsuario(parseInt(req.params.id));
  const hash = await bcrypt.hash('Malba@2025', 10);
  db.atualizarSenha(parseInt(req.params.id), hash);
  db.inserirAuditoria(req.usuario.id, req.usuario.nome, 'resetar_senha', { usuarioAlvo: alvo?.nome });
  res.json({ ok: true, novaSenha: 'Malba@2025' });
});

// Ativar/desativar usuário
app.post('/api/usuarios/:id/toggle', autenticar, exigePerfil('diretor', 'vice'), (req, res) => {
  if (parseInt(req.params.id) === req.usuario.id) return res.status(400).json({ erro: 'Não é possível desativar sua própria conta' });
  const alvo = db.getUsuario(parseInt(req.params.id));
  db.toggleUsuario(parseInt(req.params.id), req.body.ativo ? 1 : 0);
  db.inserirAuditoria(req.usuario.id, req.usuario.nome, req.body.ativo ? 'ativar_usuario' : 'desativar_usuario', { usuarioAlvo: alvo?.nome });
  res.json({ ok: true });
});

// ─── BACKUP ──────────────────────────────────────────────────────────────────

// Backup JSON completo
app.get('/api/backup/json', autenticar, exigePerfil('diretor','coordenador','vice'), (req, res) => {
  db.inserirAuditoria(req.usuario.id, req.usuario.nome, 'exportar_backup', { formato: 'json' });
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
  db.inserirAuditoria(req.usuario.id, req.usuario.nome, 'exportar_backup', { formato: 'csv' });
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

// ─── AUDITORIA ────────────────────────────────────────────────────────────────
app.get('/api/auditoria', autenticar, exigePerfil('diretor', 'vice'), (req, res) => {
  const limite = Math.min(parseInt(req.query.limite) || 200, 500);
  res.json(db.listarAuditoria(limite));
});

// ─── RESET (só diretor) ──────────────────────────────────────────────────────
app.post('/api/admin/resetar-ocorrencias', autenticar, exigePerfil('diretor','vice'), (req, res) => {
  try {
    const total = db.listarOcc().length;
    db.inserirAuditoria(req.usuario.id, req.usuario.nome, 'resetar_ocorrencias', { totalApagadas: total });
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

// ─── BACKUP AUTOMÁTICO ───────────────────────────────────────────────────────
function _fazerBackupAutomatico() {
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
  const usuarios = db.listarUsuarios();
  if (usuarios.length > 0) return; // banco já populado
  console.log('\n🌱 Banco vazio — executando seed automático...');
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
  ];
  for (const u of lista) db.inserirUsuario(u.nome, u.perfil, hash);
  console.log(`✅ ${lista.length} usuários criados com senha padrão Malba@2025\n`);
}

// ─── START ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
db.inicializar().then(async () => {
  await _autoSeed();
  server.listen(PORT, () => {
    console.log(`\n✅ Servidor rodando em http://localhost:${PORT}`);
    console.log(`   Banco: sql.js | JWT: ${JWT_EXPIRA}`);
  });
  // Backup automático diário (executa 1h após o start e depois a cada 24h)
  setTimeout(() => {
    _fazerBackupAutomatico();
    setInterval(_fazerBackupAutomatico, 24 * 60 * 60 * 1000);
  }, 60 * 60 * 1000);
}).catch(err => {
  console.error('Erro ao inicializar banco:', err);
  process.exit(1);
});
