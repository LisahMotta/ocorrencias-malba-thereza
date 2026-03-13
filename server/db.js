// db.js — banco de dados usando sql.js (puro JavaScript, sem compilação)
const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const dataDir = process.env.RAILWAY_VOLUME_MOUNT_PATH
  ? process.env.RAILWAY_VOLUME_MOUNT_PATH
  : path.join(__dirname, '../data');

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const DB_PATH = path.join(dataDir, 'ocorrencias.db');
let db = null;

function salvar() {
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

async function inicializar() {
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    db = new SQL.Database(fs.readFileSync(DB_PATH));
  } else {
    db = new SQL.Database();
  }
  db.run(`
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
  `);
  // ─── MIGRAÇÕES AUTOMÁTICAS ─────────────────────────────────────────────────
  // Adiciona colunas novas sem apagar dados existentes
  const migracoes = [
    "ALTER TABLE ocorrencias ADD COLUMN conselho_tutelar TEXT",
    "ALTER TABLE ocorrencias ADD COLUMN complementado_por_nome TEXT",
    "ALTER TABLE ocorrencias ADD COLUMN complementado_por_perfil TEXT",
  ];
  migracoes.forEach(sql => {
    try { db.run(sql); } catch(e) { /* coluna já existe, ignora */ }
  });

  salvar();
  console.log('✅ Banco pronto:', DB_PATH);
}

function queryAll(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}
function queryOne(sql, params = []) { return queryAll(sql, params)[0] || null; }
function run(sql, params = []) {
  db.run(sql, params);
  salvar();
  return db.exec('SELECT last_insert_rowid() as id')[0]?.values[0][0];
}
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
  };
}

module.exports = {
  inicializar,
  getUsuario:     (id)   => queryOne('SELECT * FROM usuarios WHERE id = ?', [id]),
  getUsuarioNome: (nome) => queryOne('SELECT * FROM usuarios WHERE nome = ? AND ativo = 1', [nome]),
  listarUsuarios: ()     => queryAll('SELECT id, nome, perfil, ativo, criado_em FROM usuarios ORDER BY perfil, nome'),
  inserirUsuario: (nome, perfil, senha) => run('INSERT INTO usuarios (nome, perfil, senha) VALUES (?, ?, ?)', [nome, perfil, senha]),
  atualizarSenha: (id, hash) => run('UPDATE usuarios SET senha = ? WHERE id = ?', [hash, id]),
  toggleUsuario:  (id, ativo) => run('UPDATE usuarios SET ativo = ? WHERE id = ?', [ativo, id]),
  listarOcc: () => queryAll('SELECT * FROM ocorrencias ORDER BY id DESC').map(parseOcc),
  getOcc:    (id) => parseOcc(queryOne('SELECT * FROM ocorrencias WHERE id = ?', [id])),
  inserirOcc: (d) => {
    const id = run(
      `INSERT INTO ocorrencias (tipo,numero,data,hora,local,gravidade,turma,envolvido,alunos,relato,descricao,providencias,bo,familia,registrado_por_id,registrado_por_nome,registrado_por_perfil)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [d.tipo,d.numero,d.data,d.hora,d.local,d.gravidade,d.turma,d.envolvido||'',
       JSON.stringify(d.alunos||[]),d.relato||'',d.descricao||'',d.providencias||'',
       d.bo||'',d.familia||'',d.registradoPorId,d.registradoPorNome,d.registradoPorPerfil]
    );
    return parseOcc(queryOne('SELECT * FROM ocorrencias WHERE id = ?', [id]));
  },
  complementarOcc: (id, d) => {
    run(`UPDATE ocorrencias SET descricao=?,providencias=?,bo=?,familia=?,conselho_tutelar=?,relatos_alunos=?,relato_responsavel=?,complementado_por_id=?,complementado_por_nome=?,complementado_por_perfil=?,data_comp=?,status='encerrado' WHERE id=?`,
      [d.descricao||'',d.providencias||'',d.bo||'',d.familia||'',d.conselhoTutelar||'',
       JSON.stringify(d.relatosAlunos||[]),d.relatoResponsavel||'',
       d.complementadoPorId,d.complementadoPorNome||'',d.complementadoPorPerfil||'',
       new Date().toLocaleDateString('pt-BR'),id]);
    return parseOcc(queryOne('SELECT * FROM ocorrencias WHERE id = ?', [id]));
  },
  editarOcc: (id, d) => {
    run('UPDATE ocorrencias SET gravidade=?,numero=?,tipo=?,relato=? WHERE id=?',
      [d.gravidade,d.numero,d.tipo,d.relato||'',id]);
    return parseOcc(queryOne('SELECT * FROM ocorrencias WHERE id = ?', [id]));
  },
  resetarOcorrencias: () => {
    run('DELETE FROM ocorrencias');
    run('DELETE FROM chats');
    run("DELETE FROM sqlite_sequence WHERE name='ocorrencias'");
    run("DELETE FROM sqlite_sequence WHERE name='chats'");
  },

  listarChat: (occId) => queryAll('SELECT * FROM chats WHERE occ_id = ? ORDER BY id ASC', [occId]),
  inserirChat: (d) => {
    const id = run(
      'INSERT INTO chats (occ_id,texto,remetente_id,remetente_nome,remetente_perfil,hora) VALUES (?,?,?,?,?,?)',
      [d.occId,d.texto,d.remetenteId,d.remetenteNome,d.remetentePerfil,d.hora]
    );
    return { id, ...d };
  },
};
