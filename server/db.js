// db.js — suporte a PostgreSQL (DATABASE_URL) e SQLite (sql.js como fallback)
const path = require('path');
const fs   = require('fs');

const USE_PG = !!process.env.DATABASE_URL;

// ─── SQLITE ───────────────────────────────────────────────────────────────────
let sqliteDb = null;

const dataDir = process.env.RAILWAY_VOLUME_MOUNT_PATH
  ? process.env.RAILWAY_VOLUME_MOUNT_PATH
  : path.join(__dirname, '../data');

const DB_PATH = path.join(dataDir, 'ocorrencias.db');

function _salvar() {
  const data = sqliteDb.export();
  const tmp  = DB_PATH + '.tmp';
  fs.writeFileSync(tmp, Buffer.from(data));
  fs.renameSync(tmp, DB_PATH);
}

async function _initSqlite() {
  const initSqlJs = require('sql.js');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    sqliteDb = new SQL.Database(fs.readFileSync(DB_PATH));
  } else {
    sqliteDb = new SQL.Database();
  }
  sqliteDb.run(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL, perfil TEXT NOT NULL, senha TEXT NOT NULL,
      ativo INTEGER NOT NULL DEFAULT 1,
      criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS ocorrencias (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tipo TEXT NOT NULL, numero TEXT NOT NULL, data TEXT NOT NULL,
      hora TEXT NOT NULL, local TEXT NOT NULL, gravidade TEXT NOT NULL,
      turma TEXT NOT NULL, envolvido TEXT, alunos TEXT, relato TEXT,
      descricao TEXT, providencias TEXT, bo TEXT, familia TEXT,
      relatos_alunos TEXT, relato_responsavel TEXT,
      status TEXT NOT NULL DEFAULT 'pendente',
      registrado_por_id INTEGER, registrado_por_nome TEXT, registrado_por_perfil TEXT,
      complementado_por_id INTEGER, data_comp TEXT,
      criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS chats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      occ_id INTEGER NOT NULL, texto TEXT NOT NULL,
      remetente_id INTEGER NOT NULL, remetente_nome TEXT NOT NULL,
      remetente_perfil TEXT NOT NULL, hora TEXT NOT NULL,
      criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS auditoria (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER, usuario_nome TEXT,
      acao TEXT NOT NULL, detalhes TEXT,
      criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS alunos_monitorados (
      ra TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      turma TEXT,
      motivo TEXT,
      sinalizado_por TEXT,
      sinalizado_em TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS fotos_alunos (
      ra TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      turma TEXT,
      filename TEXT NOT NULL,
      enviado_por TEXT,
      enviado_em TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
  `);
  const migracoes = [
    "ALTER TABLE ocorrencias ADD COLUMN conselho_tutelar TEXT",
    "ALTER TABLE ocorrencias ADD COLUMN complementado_por_nome TEXT",
    "ALTER TABLE ocorrencias ADD COLUMN complementado_por_perfil TEXT",
    "ALTER TABLE ocorrencias ADD COLUMN placon TEXT",
    "ALTER TABLE usuarios ADD COLUMN perfil_anterior TEXT",
    "CREATE INDEX IF NOT EXISTS idx_occ_status ON ocorrencias(status)",
    "CREATE INDEX IF NOT EXISTS idx_occ_data   ON ocorrencias(data)",
    "CREATE INDEX IF NOT EXISTS idx_chat_occ   ON chats(occ_id)",
  ];
  try { sqliteDb.run("SELECT placon FROM ocorrencias LIMIT 1"); }
  catch { migracoes.forEach(sql => { try { sqliteDb.run(sql); } catch {} }); }
  migracoes.forEach(sql => { try { sqliteDb.run(sql); } catch {} });
  _salvar();
  console.log('✅ Banco SQLite pronto:', DB_PATH);
}

function _sqAll(sql, params = []) {
  const stmt = sqliteDb.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}
function _sqOne(sql, params = []) { return _sqAll(sql, params)[0] || null; }
function _sqRun(sql, params = []) {
  sqliteDb.run(sql, params);
  let lastId = null;
  try {
    const res = sqliteDb.exec('SELECT last_insert_rowid()');
    lastId = res && res[0] && res[0].values && res[0].values[0] ? res[0].values[0][0] : null;
  } catch {}
  _salvar();
  return lastId;
}

// ─── POSTGRESQL ───────────────────────────────────────────────────────────────
let pgPool = null;

async function _initPg() {
  const { Pool } = require('pg');
  pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
  });
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id SERIAL PRIMARY KEY,
      nome TEXT NOT NULL, perfil TEXT NOT NULL, senha TEXT NOT NULL,
      ativo INTEGER NOT NULL DEFAULT 1,
      perfil_anterior TEXT,
      criado_em TEXT NOT NULL DEFAULT to_char(NOW() AT TIME ZONE 'America/Sao_Paulo','DD/MM/YYYY HH24:MI')
    );
    CREATE TABLE IF NOT EXISTS ocorrencias (
      id SERIAL PRIMARY KEY,
      tipo TEXT NOT NULL, numero TEXT NOT NULL, data TEXT NOT NULL,
      hora TEXT NOT NULL, local TEXT NOT NULL, gravidade TEXT NOT NULL,
      turma TEXT NOT NULL, envolvido TEXT, alunos TEXT, relato TEXT,
      descricao TEXT, providencias TEXT, bo TEXT, familia TEXT,
      relatos_alunos TEXT, relato_responsavel TEXT,
      status TEXT NOT NULL DEFAULT 'pendente',
      registrado_por_id INTEGER, registrado_por_nome TEXT, registrado_por_perfil TEXT,
      complementado_por_id INTEGER, complementado_por_nome TEXT, complementado_por_perfil TEXT,
      data_comp TEXT, conselho_tutelar TEXT, placon TEXT,
      criado_em TEXT NOT NULL DEFAULT to_char(NOW() AT TIME ZONE 'America/Sao_Paulo','DD/MM/YYYY HH24:MI')
    );
    CREATE TABLE IF NOT EXISTS chats (
      id SERIAL PRIMARY KEY,
      occ_id INTEGER NOT NULL, texto TEXT NOT NULL,
      remetente_id INTEGER NOT NULL, remetente_nome TEXT NOT NULL,
      remetente_perfil TEXT NOT NULL, hora TEXT NOT NULL,
      criado_em TEXT NOT NULL DEFAULT to_char(NOW() AT TIME ZONE 'America/Sao_Paulo','DD/MM/YYYY HH24:MI')
    );
    CREATE TABLE IF NOT EXISTS auditoria (
      id SERIAL PRIMARY KEY,
      usuario_id INTEGER, usuario_nome TEXT,
      acao TEXT NOT NULL, detalhes TEXT,
      criado_em TEXT NOT NULL DEFAULT to_char(NOW() AT TIME ZONE 'America/Sao_Paulo','DD/MM/YYYY HH24:MI')
    );
    CREATE TABLE IF NOT EXISTS alunos_monitorados (
      ra TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      turma TEXT,
      motivo TEXT,
      sinalizado_por TEXT,
      sinalizado_em TEXT NOT NULL DEFAULT to_char(NOW() AT TIME ZONE 'America/Sao_Paulo','DD/MM/YYYY HH24:MI')
    );
    CREATE TABLE IF NOT EXISTS fotos_alunos (
      ra TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      turma TEXT,
      filename TEXT NOT NULL,
      enviado_por TEXT,
      enviado_em TEXT NOT NULL DEFAULT to_char(NOW() AT TIME ZONE 'America/Sao_Paulo','DD/MM/YYYY HH24:MI')
    );
  `);
  console.log('✅ Banco PostgreSQL pronto');
}

async function _pgAll(sql, params = []) {
  const res = await pgPool.query(sql, params);
  return res.rows;
}
async function _pgOne(sql, params = []) {
  const rows = await _pgAll(sql, params);
  return rows[0] || null;
}
async function _pgRun(sql, params = []) {
  const res = await pgPool.query(sql, params);
  return res.rows[0]?.id || null;
}

// ─── parseOcc ─────────────────────────────────────────────────────────────────
function parseOcc(row) {
  if (!row) return null;
  return {
    ...row,
    alunos:              row.alunos             ? JSON.parse(row.alunos)             : [],
    relatosAlunos:       row.relatos_alunos     ? JSON.parse(row.relatos_alunos)     : [],
    relatoResponsavel:   row.relato_responsavel || '',
    registradoPorId:     row.registrado_por_id,
    registradoPorNome:   row.registrado_por_nome,
    registradoPorPerfil: row.registrado_por_perfil,
    complementadoPorId:    row.complementado_por_id,
    complementadoPorNome:  row.complementado_por_nome  || null,
    complementadoPorPerfil:row.complementado_por_perfil|| null,
    dataComp:              row.data_comp,
    conselhoTutelar:       row.conselho_tutelar || '',
    placon:                row.placon || '',
  };
}

// ─── API PÚBLICA (todas async) ────────────────────────────────────────────────
module.exports = {
  async inicializar() {
    if (USE_PG) { await _initPg(); }
    else        { await _initSqlite(); }
  },

  // Usado apenas no modo SQLite para backup de arquivo
  exportarSqlite() {
    if (!sqliteDb) return null;
    return sqliteDb.export();
  },

  // ── Usuários ──────────────────────────────────────────────────────────────
  async getUsuario(id) {
    if (USE_PG) return _pgOne('SELECT * FROM usuarios WHERE id = $1', [id]);
    return _sqOne('SELECT * FROM usuarios WHERE id = ?', [id]);
  },
  async getUsuarioNome(nome) {
    if (USE_PG) return _pgOne('SELECT * FROM usuarios WHERE nome = $1 AND ativo = 1', [nome]);
    return _sqOne('SELECT * FROM usuarios WHERE nome = ? AND ativo = 1', [nome]);
  },
  async listarUsuarios() {
    if (USE_PG) return _pgAll('SELECT id, nome, perfil, ativo, criado_em FROM usuarios ORDER BY perfil, nome');
    return _sqAll('SELECT id, nome, perfil, ativo, criado_em FROM usuarios ORDER BY perfil, nome');
  },
  async inserirUsuario(nome, perfil, senha) {
    if (USE_PG) return _pgRun('INSERT INTO usuarios (nome, perfil, senha) VALUES ($1, $2, $3) RETURNING id', [nome, perfil, senha]);
    return _sqRun('INSERT INTO usuarios (nome, perfil, senha) VALUES (?, ?, ?)', [nome, perfil, senha]);
  },
  async atualizarSenha(id, hash) {
    if (USE_PG) return _pgRun('UPDATE usuarios SET senha = $1 WHERE id = $2', [hash, id]);
    return _sqRun('UPDATE usuarios SET senha = ? WHERE id = ?', [hash, id]);
  },
  async toggleUsuario(id, ativo) {
    if (USE_PG) return _pgRun('UPDATE usuarios SET ativo = $1 WHERE id = $2', [ativo, id]);
    return _sqRun('UPDATE usuarios SET ativo = ? WHERE id = ?', [ativo, id]);
  },
  async atualizarPerfil(id, perfil) {
    if (USE_PG) return _pgRun('UPDATE usuarios SET perfil = $1 WHERE id = $2', [perfil, id]);
    return _sqRun('UPDATE usuarios SET perfil = ? WHERE id = ?', [perfil, id]);
  },

  // ── Ocorrências ───────────────────────────────────────────────────────────
  async listarOcc() {
    if (USE_PG) return (await _pgAll('SELECT * FROM ocorrencias ORDER BY id DESC')).map(parseOcc);
    return _sqAll('SELECT * FROM ocorrencias ORDER BY id DESC').map(parseOcc);
  },
  async getOcc(id) {
    if (USE_PG) return parseOcc(await _pgOne('SELECT * FROM ocorrencias WHERE id = $1', [id]));
    return parseOcc(_sqOne('SELECT * FROM ocorrencias WHERE id = ?', [id]));
  },
  async deletarOcc(id) {
    if (USE_PG) return _pgRun('DELETE FROM ocorrencias WHERE id = $1', [id]);
    return _sqRun('DELETE FROM ocorrencias WHERE id = ?', [id]);
  },
  async inserirOcc(d) {
    let id;
    if (USE_PG) {
      id = await _pgRun(
        `INSERT INTO ocorrencias (tipo,numero,data,hora,local,gravidade,turma,envolvido,alunos,relato,descricao,providencias,bo,familia,registrado_por_id,registrado_por_nome,registrado_por_perfil)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING id`,
        [d.tipo,d.numero,d.data,d.hora,d.local,d.gravidade,d.turma,d.envolvido||'',
         JSON.stringify(d.alunos||[]),d.relato||'',d.descricao||'',d.providencias||'',
         d.bo||'',d.familia||'',d.registradoPorId,d.registradoPorNome,d.registradoPorPerfil]
      );
      return parseOcc(await _pgOne('SELECT * FROM ocorrencias WHERE id = $1', [id]));
    }
    id = _sqRun(
      `INSERT INTO ocorrencias (tipo,numero,data,hora,local,gravidade,turma,envolvido,alunos,relato,descricao,providencias,bo,familia,registrado_por_id,registrado_por_nome,registrado_por_perfil)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [d.tipo,d.numero,d.data,d.hora,d.local,d.gravidade,d.turma,d.envolvido||'',
       JSON.stringify(d.alunos||[]),d.relato||'',d.descricao||'',d.providencias||'',
       d.bo||'',d.familia||'',d.registradoPorId,d.registradoPorNome,d.registradoPorPerfil]
    );
    return parseOcc(_sqOne('SELECT * FROM ocorrencias WHERE id = ?', [id]));
  },
  async complementarOcc(id, d) {
    if (USE_PG) {
      await _pgRun(
        `UPDATE ocorrencias SET descricao=$1,providencias=$2,bo=$3,familia=$4,conselho_tutelar=$5,placon=$6,relatos_alunos=$7,relato_responsavel=$8,complementado_por_id=$9,complementado_por_nome=$10,complementado_por_perfil=$11,data_comp=$12,status='encerrado' WHERE id=$13`,
        [d.descricao||'',d.providencias||'',d.bo||'',d.familia||'',d.conselhoTutelar||'',d.placon||'',
         JSON.stringify(d.relatosAlunos||[]),d.relatoResponsavel||'',
         d.complementadoPorId,d.complementadoPorNome||'',d.complementadoPorPerfil||'',
         new Date().toLocaleDateString('pt-BR'),id]
      );
      return parseOcc(await _pgOne('SELECT * FROM ocorrencias WHERE id = $1', [id]));
    }
    _sqRun(
      `UPDATE ocorrencias SET descricao=?,providencias=?,bo=?,familia=?,conselho_tutelar=?,placon=?,relatos_alunos=?,relato_responsavel=?,complementado_por_id=?,complementado_por_nome=?,complementado_por_perfil=?,data_comp=?,status='encerrado' WHERE id=?`,
      [d.descricao||'',d.providencias||'',d.bo||'',d.familia||'',d.conselhoTutelar||'',d.placon||'',
       JSON.stringify(d.relatosAlunos||[]),d.relatoResponsavel||'',
       d.complementadoPorId,d.complementadoPorNome||'',d.complementadoPorPerfil||'',
       new Date().toLocaleDateString('pt-BR'),id]
    );
    return parseOcc(_sqOne('SELECT * FROM ocorrencias WHERE id = ?', [id]));
  },
  async editarOcc(id, d) {
    if (USE_PG) {
      await _pgRun('UPDATE ocorrencias SET gravidade=$1,numero=$2,tipo=$3,relato=$4 WHERE id=$5',
        [d.gravidade,d.numero,d.tipo,d.relato||'',id]);
      return parseOcc(await _pgOne('SELECT * FROM ocorrencias WHERE id = $1', [id]));
    }
    _sqRun('UPDATE ocorrencias SET gravidade=?,numero=?,tipo=?,relato=? WHERE id=?',
      [d.gravidade,d.numero,d.tipo,d.relato||'',id]);
    return parseOcc(_sqOne('SELECT * FROM ocorrencias WHERE id = ?', [id]));
  },
  async resetarOcorrencias() {
    if (USE_PG) {
      await pgPool.query('DELETE FROM ocorrencias');
      await pgPool.query('DELETE FROM chats');
      await pgPool.query('ALTER SEQUENCE ocorrencias_id_seq RESTART WITH 1');
      await pgPool.query('ALTER SEQUENCE chats_id_seq RESTART WITH 1');
      return;
    }
    try { sqliteDb.run('DELETE FROM ocorrencias'); } catch(e) { console.error('[reset occ]', e.message); }
    try { sqliteDb.run('DELETE FROM chats'); } catch(e) { console.error('[reset chat]', e.message); }
    try { sqliteDb.run("DELETE FROM sqlite_sequence WHERE name='ocorrencias'"); } catch {}
    try { sqliteDb.run("DELETE FROM sqlite_sequence WHERE name='chats'"); } catch {}
    _salvar();
  },

  // ── Chats ─────────────────────────────────────────────────────────────────
  async listarChat(occId) {
    if (USE_PG) return _pgAll('SELECT * FROM chats WHERE occ_id = $1 ORDER BY id ASC', [occId]);
    return _sqAll('SELECT * FROM chats WHERE occ_id = ? ORDER BY id ASC', [occId]);
  },
  async inserirChat(d) {
    let id;
    if (USE_PG) {
      id = await _pgRun(
        'INSERT INTO chats (occ_id,texto,remetente_id,remetente_nome,remetente_perfil,hora) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
        [d.occId,d.texto,d.remetenteId,d.remetenteNome,d.remetentePerfil,d.hora]
      );
    } else {
      id = _sqRun(
        'INSERT INTO chats (occ_id,texto,remetente_id,remetente_nome,remetente_perfil,hora) VALUES (?,?,?,?,?,?)',
        [d.occId,d.texto,d.remetenteId,d.remetenteNome,d.remetentePerfil,d.hora]
      );
    }
    return { id, ...d };
  },

  // ── Auditoria ─────────────────────────────────────────────────────────────
  async inserirAuditoria(usuarioId, usuarioNome, acao, detalhes = null) {
    try {
      const det = detalhes ? JSON.stringify(detalhes) : null;
      if (USE_PG) {
        await _pgRun('INSERT INTO auditoria (usuario_id,usuario_nome,acao,detalhes) VALUES ($1,$2,$3,$4)',
          [usuarioId||null, usuarioNome||null, acao, det]);
      } else {
        _sqRun('INSERT INTO auditoria (usuario_id,usuario_nome,acao,detalhes) VALUES (?,?,?,?)',
          [usuarioId||null, usuarioNome||null, acao, det]);
      }
    } catch(e) { console.error('[auditoria] Erro ao registrar:', e.message); }
  },
  async listarAuditoria(limite = 200) {
    let rows;
    if (USE_PG) rows = await _pgAll('SELECT * FROM auditoria ORDER BY id DESC LIMIT $1', [limite]);
    else        rows = _sqAll('SELECT * FROM auditoria ORDER BY id DESC LIMIT ?', [limite]);
    return rows.map(r => ({ ...r, detalhes: r.detalhes ? JSON.parse(r.detalhes) : null }));
  },

  // ── Alunos monitorados ────────────────────────────────────────────────────
  async listarMonitorados() {
    if (USE_PG) return _pgAll('SELECT * FROM alunos_monitorados ORDER BY sinalizado_em DESC');
    return _sqAll('SELECT * FROM alunos_monitorados ORDER BY sinalizado_em DESC');
  },
  async inserirMonitorado(ra, nome, turma, motivo, sinalizadoPor) {
    if (USE_PG) return _pgRun(
      'INSERT INTO alunos_monitorados (ra,nome,turma,motivo,sinalizado_por) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (ra) DO UPDATE SET nome=EXCLUDED.nome,turma=EXCLUDED.turma,motivo=EXCLUDED.motivo,sinalizado_por=EXCLUDED.sinalizado_por',
      [ra, nome, turma||'', motivo||'', sinalizadoPor||'']
    );
    return _sqRun(
      'INSERT OR REPLACE INTO alunos_monitorados (ra,nome,turma,motivo,sinalizado_por) VALUES (?,?,?,?,?)',
      [ra, nome, turma||'', motivo||'', sinalizadoPor||'']
    );
  },
  async removerMonitorado(ra) {
    if (USE_PG) return _pgRun('DELETE FROM alunos_monitorados WHERE ra = $1', [ra]);
    return _sqRun('DELETE FROM alunos_monitorados WHERE ra = ?', [ra]);
  },

  // ── Fotos alunos (carômetro) ──────────────────────────────────────────────
  async listarFotos() {
    if (USE_PG) return _pgAll('SELECT * FROM fotos_alunos ORDER BY turma, nome');
    return _sqAll('SELECT * FROM fotos_alunos ORDER BY turma, nome');
  },
  async getFoto(ra) {
    if (USE_PG) return _pgOne('SELECT * FROM fotos_alunos WHERE ra = $1', [ra]);
    return _sqOne('SELECT * FROM fotos_alunos WHERE ra = ?', [ra]);
  },
  async salvarFoto(ra, nome, turma, filename, enviadoPor) {
    if (USE_PG) return _pgRun(
      'INSERT INTO fotos_alunos (ra,nome,turma,filename,enviado_por) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (ra) DO UPDATE SET nome=EXCLUDED.nome,turma=EXCLUDED.turma,filename=EXCLUDED.filename,enviado_por=EXCLUDED.enviado_por,enviado_em=to_char(NOW() AT TIME ZONE \'America/Sao_Paulo\',\'DD/MM/YYYY HH24:MI\')',
      [ra, nome, turma||'', filename, enviadoPor||'']
    );
    return _sqRun(
      'INSERT OR REPLACE INTO fotos_alunos (ra,nome,turma,filename,enviado_por) VALUES (?,?,?,?,?)',
      [ra, nome, turma||'', filename, enviadoPor||'']
    );
  },
  async deletarFoto(ra) {
    const row = await (USE_PG
      ? _pgOne('SELECT filename FROM fotos_alunos WHERE ra = $1', [ra])
      : _sqOne('SELECT filename FROM fotos_alunos WHERE ra = ?', [ra]));
    if (!row) return null;
    if (USE_PG) await _pgRun('DELETE FROM fotos_alunos WHERE ra = $1', [ra]);
    else _sqRun('DELETE FROM fotos_alunos WHERE ra = ?', [ra]);
    return row.filename;
  },
};
