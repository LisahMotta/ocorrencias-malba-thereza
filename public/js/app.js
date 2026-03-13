// app.js — lógica principal do sistema de ocorrências
import { conectar, onEvento, enviar } from './ws.js';
import { mostrarNotifOcorrencia, pedirPermissaoNotif } from './notif.js';
import { iniciarChat, fecharChat, receberMsgChat } from './chat.js';

// ─── DADOS ────────────────────────────────────────────────────────────────────
const USUARIOS = [
  {id:1,nome:'ADRIANA PEREIRA DOS SANTOS',perfil:'professor'},
  {id:2,nome:'ANA CLAUDIA PINHEIRO DA SILVA CRUZ',perfil:'professor'},
  {id:3,nome:'ARIADNE DA SILVA RODRIGUES',perfil:'coordenador'},
  {id:4,nome:'ARINE IWAMOTO SANCHES FAGUNDES',perfil:'professor'},
  {id:5,nome:'BRUNO PACHECO DOS SANTOS',perfil:'vice'},
  {id:6,nome:'CAMILO DE LELIS AMARAL',perfil:'professor'},
  {id:7,nome:'CRISTIANE SERPA QUILICI',perfil:'professor'},
  {id:8,nome:'CRISTINA MARIA MARTINS LANDIM RIBEIRO',perfil:'professor'},
  {id:9,nome:'DALVA MARIA SILVÉRIO',perfil:'professor'},
  {id:10,nome:'DANIEL CÉSAR DE OLIVEIRA',perfil:'professor'},
  {id:11,nome:'DIANA RIBEIRO ANDRADE LIMA',perfil:'professor'},
  {id:12,nome:'EDMILSON APARECIDO DE SOUSA',perfil:'professor'},
  {id:13,nome:'ERICA DE PAULA APARECIDA CABERLIM',perfil:'professor'},
  {id:14,nome:'ERICK RODRIGUES DE CARVALHO',perfil:'professor'},
  {id:15,nome:'EUNICE APARECIDA DE FARIA QUADROS',perfil:'professor'},
  {id:16,nome:'GABRIEL GUIDO DE ALMEIDA',perfil:'professor'},
  {id:17,nome:'GIOVANNA PONTES SANTOS',perfil:'professor'},
  {id:18,nome:'IVANILDA DE JESUS PAIVA',perfil:'professor'},
  {id:19,nome:'JESSICA KAREN DOS SANTOS SOLEO',perfil:'professor'},
  {id:20,nome:'JOÃO FLAVIO FRAGA',perfil:'professor'},
  {id:21,nome:'JUSCELENE SUMARA LESSA LANCELOTTI DI LUCCIO',perfil:'professor'},
  {id:22,nome:'KARINA DE SOUZA RIBEIRO',perfil:'professor'},
  {id:23,nome:'KARINA KOIBUCHI SAKANE',perfil:'professor'},
  {id:24,nome:'LAURENTINA ELIAS DUARTE',perfil:'professor'},
  {id:25,nome:'LEACIRA FREITAS DE ANDRADES SIMAN',perfil:'professor'},
  {id:26,nome:'LUANA CRISTINA FERREIRA DE OLIVEIRA',perfil:'professor'},
  {id:27,nome:'MAGALI RAMOS FERREIRA',perfil:'professor'},
  {id:28,nome:'MARIA CRISTINA DE ALMEIDA PORTO SILVA',perfil:'professor'},
  {id:29,nome:'MARIA DE FÁTIMA DIAS',perfil:'professor'},
  {id:30,nome:'MAYARA SELMA PURCINO MACEDO',perfil:'professor'},
  {id:31,nome:'MEIRE APARECIDA GAEFKE',perfil:'professor'},
  {id:32,nome:'NILCELENA SOUZA PORTILHO',perfil:'professor'},
  {id:33,nome:'PAULO CESAR ROCHA GOMES',perfil:'professor'},
  {id:34,nome:'RENATA APARECIDA MOYSES DE FREITAS',perfil:'professor'},
  {id:35,nome:'ROSEANE MOREIRA DA SILVA SALES',perfil:'professor'},
  {id:36,nome:'SAMANTHA MARINA RIBEIRO MARTINS LEITE',perfil:'professor'},
  {id:37,nome:'SILVANA MÁRCIA DE SOUZA',perfil:'professor'},
  {id:38,nome:'SILVIA FERREIRA LOPES DE OLIVEIRA',perfil:'professor'},
  {id:39,nome:'SIOMARA VILELA PRADO FONSECA',perfil:'professor'},
  {id:40,nome:'SOLANGE SANTOS ARAÚJO',perfil:'professor'},
  {id:41,nome:'SONIA MARIA DA SILVA GABRIEL',perfil:'professor'},
  {id:42,nome:'THAÍS JOSÉ SOARES',perfil:'vice'},
  {id:43,nome:'THIAGO JOSÉ DIOGO ALVES OLIVEIRA',perfil:'professor'},
  {id:44,nome:'VICENTE CESAR DA SILVA',perfil:'professor'},
  {id:45,nome:'VIVIANE SANTOS DE OLIVEIRA',perfil:'professor'},
  {id:46,nome:'WALDINEIA CRISTINA RODRIGUES DOS SANTOS',perfil:'professor'},
  {id:47,nome:'WELLINGTON ROBERTO GALVAO BORGES DE OLIVEIRA',perfil:'professor'},
  {id:48,nome:'WAGNER GONÇALVES DA SILVA JUNIOR FERRO FAZAN',perfil:'coordenador'},
  {id:49,nome:'RENATA VALÉRIA',perfil:'coordenador'},
  {id:50,nome:'MARIA CRISTINA DA SILVA',perfil:'vice'},
  {id:51,nome:'SANDRA REGINA XAVIER DA SILVA',perfil:'diretor'},
];

const PL = {
  professor:'Professor',
  poc:'P.O.C. (Prof. Orientador de Convivência)',
  coordenador:'Coordenador Pedagógico',
  vice:'Vice-Diretor',
  diretor:'Diretor de Escola',
};
const GL = { urgencia:'Urgência/Emergência', grave:'Grave', media:'Média', leve:'Leve' };
const SL = { pendente:'Aguard. complemento', encerrado:'Encerrado' };
const GORDEM = ['leve','media','grave','urgencia'];
const PODE_EDIT = ['poc','coordenador','vice','diretor'];
const PODE_REL  = ['coordenador','vice','diretor'];
const TU = [
  {n:'I',  l:'Ameaça/risco iminente à vida (atirador, massacres)'},
  {n:'II', l:'Fenômenos naturais com risco à UE (inundação, desabamento)'},
  {n:'XII',l:'Mal súbito com resultado morte'},
  {n:'XX', l:'Fake News — ameaça de massacre/atentado'},
  {n:'XXI',l:'Posse de arma (branca, fogo, réplica ou objeto perigoso)'},
  {n:'XXII',l:'Agressão física grave (lesão corporal)'},
  {n:'XXIII',l:'Homicídio / Homicídio tentado'},
  {n:'XXV',l:'Importunação sexual'},
  {n:'XXVII',l:'Violência contra criança/adolescente / abuso sexual'},
];
const TG = [
  {n:'III', l:'Agressão verbal entre estudantes e/ou servidores'},
  {n:'IV',  l:'Uso de tabaco, cigarro eletrônico ou fumígeno'},
  {n:'V',   l:'Porte/uso de entorpecentes'},
  {n:'VI',  l:'Bullying / Cyberbullying / Humilhação sistêmica'},
  {n:'VII', l:'Estudante com sinais de maus-tratos ou abandono'},
  {n:'VIII',l:'Sinais de alerta / tentativa de suicídio'},
  {n:'IX',  l:'Desaparecimento de estudante comunicado por familiares'},
  {n:'X',   l:'Mal súbito (comunidade escolar)'},
  {n:'XI',  l:'Mal súbito com necessidade de condução a pronto-socorro'},
  {n:'XIII',l:'Estelionato / Falso PIX'},
  {n:'XIV', l:'Roubo / furto entre membros da UE'},
  {n:'XV',  l:'Racismo / injúria racial'},
  {n:'XVI', l:'Homofobia / Transfobia'},
  {n:'XVII',l:'Dano ao patrimônio público'},
  {n:'XVIII',l:'Invasão da unidade escolar'},
  {n:'XIX', l:'Ameaça (palavra, escrito ou gesto)'},
  {n:'XXIV',l:'Ato obsceno'},
  {n:'XXVI',l:'Assédio moral ou sexual'},
];
const PROT = {
  urgencia:{
    professor:['Manter calma e preservar a segurança de todos','Acionar a PM imediatamente (190) ou Botão do Pânico','Comunicar o Diretor/Vice-Diretor imediatamente'],
    gestao:['Comunicar a Unidade Regional de Ensino de São José dos Campos','Registrar na Plataforma CONVIVA (Placon)','Preservar imagens de câmeras (solicitar em até 3 dias)','Manter sigilo sobre os envolvidos'],
  },
  grave:{
    professor:['Acolher e escutar as partes envolvidas','Comunicar a equipe gestora (Diretor/Vice/Coord.)'],
    gestao:['Comunicar a família dos estudantes','Registrar na Plataforma CONVIVA (Placon)','Verificar necessidade de acionar o Conselho Tutelar','Acompanhar o caso e registrar as providências'],
  },
};

// ─── ESTADO ───────────────────────────────────────────────────────────────────
let cu = null;       // usuário corrente
let occ = [];        // ocorrências
let chats = {};      // chats
let TD = {};         // turmas data
let sTipo = null;
let selAlunos = [];
let atuais = [];
let chatNaoLidos = {};  // occId → count

// ─── INIT ─────────────────────────────────────────────────────────────────────
async function init() {
  // Carrega turmas
  const resp = await fetch('/assets/turmas.json');
  TD = await resp.json();

  _montarLoginSelect();
  _montarTurmasSelect();
  _montarGridTipos();
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────
function _montarLoginSelect() {
  const sel = document.getElementById('loginUsuario');
  USUARIOS.forEach(u => {
    const o = document.createElement('option');
    o.value = u.id;
    o.textContent = u.nome + ' — ' + PL[u.perfil];
    sel.appendChild(o);
  });

  // Demo buttons
  const perfis = ['professor','poc','coordenador','vice','diretor'];
  const pn = {professor:'Professor',poc:'P.O.C.',coordenador:'Coordenador',vice:'Vice-Diretor',diretor:'Diretor'};
  document.getElementById('demoButtons').innerHTML = perfis.map(p =>
    `<button class="db" onclick="window._qLogin('${p}')">${pn[p]}</button>`
  ).join('');
}

window._qLogin = (p) => {
  const u = USUARIOS.find(x => x.perfil === p);
  if (u) _autenticar(u);
};
window._doLogin = () => {
  const uid = parseInt(document.getElementById('loginUsuario').value);
  if (!uid) { alert('Selecione seu nome.'); return; }
  const u = USUARIOS.find(x => x.id === uid);
  if (u) _autenticar(u);
};
window._doLogout = () => {
  cu = null; sTipo = null; selAlunos = []; atuais = [];
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('mainScreen').style.display = 'none';
};

async function _autenticar(usuario) {
  cu = usuario;

  // Solicita permissão de notificação do SO
  pedirPermissaoNotif();

  // Conecta WebSocket
  _iniciarWS();

  // Carrega dados do servidor
  const r = await fetch('/api/ocorrencias');
  occ = await r.json();

  _renderMain();
}

// ─── WEBSOCKET ────────────────────────────────────────────────────────────────
function _iniciarWS() {
  conectar(cu.id);

  onEvento('status', (s) => {
    const el = document.getElementById('wsStatus');
    if (!el) return;
    el.className = 'ws-status ' + (s === 'conectado' ? 'ok' : 'err');
    el.textContent = s === 'conectado' ? '● online' : '● offline';
  });

  onEvento('init', (msg) => {
    occ = msg.ocorrencias || [];
    chats = msg.chats || {};
    renderDash();
    renderOcc();
  });

  onEvento('nova_ocorrencia', (msg) => {
    // Adiciona se ainda não existe
    if (!occ.find(o => o.id === msg.occ.id)) occ.push(msg.occ);
    renderDash();
    renderOcc();
    // Notifica gestores
    mostrarNotifOcorrencia(msg.occ, cu, (occId) => {
      const o = occ.find(x => x.id === occId);
      if (o) abrirChat(o);
    });
  });

  onEvento('occ_atualizada', (msg) => {
    const idx = occ.findIndex(o => o.id === msg.occ.id);
    if (idx >= 0) occ[idx] = msg.occ;
    else occ.push(msg.occ);
    renderDash();
    renderOcc();
  });

  onEvento('chat_msg', (msg) => {
    receberMsgChat(msg.msg);
    // Incrementa badge se não for o remetente
    if (msg.msg.remetenteId !== cu.id) {
      const id = String(msg.msg.occId);
      chatNaoLidos[id] = (chatNaoLidos[id] || 0) + 1;
      _atualizarBadgeChat();
    }
  });
}

function _atualizarBadgeChat() {
  const total = Object.values(chatNaoLidos).reduce((a,b)=>a+b,0);
  const badge = document.getElementById('chatBadge');
  if (badge) {
    badge.textContent = total;
    badge.style.display = total > 0 ? 'flex' : 'none';
  }
}

// ─── RENDER MAIN ─────────────────────────────────────────────────────────────
function _renderMain() {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('mainScreen').style.display = 'block';
  document.getElementById('topName').textContent = cu.nome.split(' ').slice(0,2).join(' ');
  document.getElementById('topRole').textContent = PL[cu.perfil];

  const isB1 = PODE_EDIT.includes(cu.perfil);
  document.getElementById('blocoI').style.display = isB1 ? 'block' : 'none';
  document.getElementById('campoRelato').style.display = 'block'; // todos relatam
  document.getElementById('campoGestao').style.display = isGest() ? 'block' : 'none';
  document.getElementById('optUrg').style.display = isB1 ? '' : 'none';
  document.getElementById('tabRel').style.display = PODE_REL.includes(cu.perfil) ? '' : 'none';
  document.getElementById('tabGes').style.display = cu.perfil === 'diretor' ? '' : 'none';

  const icons = {professor:'👨‍🏫',poc:'🔵',coordenador:'📋',vice:'🏫',diretor:'⭐'};
  const descs = {
    professor:'Registra ocorrências do Bloco II com relato. Complemento e providências serão feitos pela equipe gestora.',
    poc:'Registra Blocos I e II. Pode complementar, editar gravidade e abrir chat com professores.',
    coordenador:'Acesso completo: registro, complemento, edição, relatórios, chat e geração de documento.',
    vice:'Acesso completo: registro, complemento, edição, relatórios, chat e geração de documento.',
    diretor:'Acesso total: registro, complemento, edição, relatórios, gestão, chat e geração de documento.',
  };
  document.getElementById('perfilHeader').innerHTML =
    `<div class="ph"><span class="pi">${icons[cu.perfil]}</span><div><div class="pn2">${cu.nome}</div><div class="pd">${descs[cu.perfil]}</div></div></div>`;

  _setDatas();
  renderDash();
}

// ─── TURMAS ───────────────────────────────────────────────────────────────────
function _montarTurmasSelect() {
  // Aguarda TD ser carregado (chamado após fetch)
}
function _montarTurmasSelectReal() {
  const ord = _ordTurmas(Object.keys(TD));
  const ts = document.getElementById('occTurma');
  const gef = document.createElement('optgroup'); gef.label='Ensino Fundamental';
  const gem = document.createElement('optgroup'); gem.label='Ensino Médio';
  ord.forEach(t => {
    const o = document.createElement('option'); o.value=t; o.textContent=t;
    (TD[t].nivel==='Ensino Fundamental'?gef:gem).appendChild(o);
  });
  ts.appendChild(gef); ts.appendChild(gem);

  ['fTurma','relTurma'].forEach(id => {
    const e = document.getElementById(id); if(!e) return;
    const a = document.createElement('option'); a.value=''; a.textContent='Todas as turmas'; e.appendChild(a);
    ord.forEach(t => {
      const o = document.createElement('option'); o.value=t;
      o.textContent = t+' ('+(TD[t].nivel==='Ensino Médio'?'EM':'EF')+')';
      e.appendChild(o);
    });
  });
}
function _ordTurmas(arr) {
  const ef=[], em=[];
  arr.forEach(t => { (TD[t].nivel==='Ensino Fundamental'?ef:em).push(t); });
  const n = t => { const m=t.match(/\d+/); return m?parseInt(m[0]):0; };
  ef.sort((a,b)=>n(a)-n(b)||a.localeCompare(b,'pt'));
  em.sort((a,b)=>n(a)-n(b)||a.localeCompare(b,'pt'));
  return [...ef,...em];
}

window.onTurmaChange = () => {
  const t = document.getElementById('occTurma').value;
  selAlunos = []; document.getElementById('filtroAluno').value = '';
  if (!t||!TD[t]) { document.getElementById('painelWrap').style.display='none'; return; }
  atuais = [...TD[t].alunos];
  document.getElementById('painelWrap').style.display='block';
  document.getElementById('lblTurma').textContent = t;
  document.getElementById('lblTotal').textContent = t+' · '+atuais.length+' alunos';
  renderAlunos(atuais); renderTags();
};
window.filtrarAlunos = () => {
  const q = document.getElementById('filtroAluno').value.trim().toUpperCase();
  renderAlunos(q ? atuais.filter(a=>a.nome.includes(q)) : atuais);
};
function renderAlunos(lista) {
  const c = document.getElementById('listaAlunos');
  if (!lista.length) { c.innerHTML='<div style="padding:1rem;text-align:center;font-size:13px;color:var(--mu)">Nenhum aluno encontrado.</div>'; return; }
  c.innerHTML = lista.map((a,i) => {
    const s = selAlunos.some(x=>x.ra===a.ra);
    return `<div class="ai${s?' sel':''}" onclick="window._togAluno('${a.ra}',this)"><input type="checkbox"${s?' checked':''} onclick="event.stopPropagation();window._togAluno('${a.ra}',this.closest('.ai'))"/><span class="anum">${i+1}.</span><span class="an">${a.nome}</span></div>`;
  }).join('');
  document.getElementById('lblCount').textContent = selAlunos.length+' selecionado(s)';
}
window._togAluno = (ra, el) => {
  const a = atuais.find(x=>x.ra===ra); if(!a) return;
  const i = selAlunos.findIndex(x=>x.ra===ra);
  if(i>=0){selAlunos.splice(i,1);el.classList.remove('sel');el.querySelector('input').checked=false;}
  else{selAlunos.push(a);el.classList.add('sel');el.querySelector('input').checked=true;}
  document.getElementById('lblCount').textContent = selAlunos.length+' selecionado(s)';
  renderTags();
};
window._remAluno = (ra) => {
  selAlunos = selAlunos.filter(a=>a.ra!==ra);
  document.getElementById('lblCount').textContent = selAlunos.length+' selecionado(s)';
  renderTags(); window.filtrarAlunos();
};
function renderTags() {
  document.getElementById('tagsAlunos').innerHTML = selAlunos.map(a =>
    `<span class="at2">${a.nome}<button onclick="window._remAluno('${a.ra}')">×</button></span>`
  ).join('');
}

// ─── TIPOS ────────────────────────────────────────────────────────────────────
function _montarGridTipos() {
  // Aguarda DOM
}
function _montarGridTiposReal() {
  document.getElementById('gridUrg').innerHTML = TU.map(t =>
    `<button class="tb2 ub2" onclick="window._selTipo('${t.n}',this,'urgencia')"><span class="tn">${t.n}</span><span>${t.l}</span></button>`
  ).join('');
  document.getElementById('gridGrav').innerHTML = TG.map(t =>
    `<button class="tb2 gb2" onclick="window._selTipo('${t.n}',this,'grave')"><span class="tn">${t.n}</span><span>${t.l}</span></button>`
  ).join('');
}
window._selTipo = (num, btn, nivel) => {
  const todos = [...TU,...TG];
  const tipo = todos.find(t=>t.n===num);
  const label = tipo ? tipo.l : '';
  document.querySelectorAll('.tb2').forEach(b=>b.classList.remove('sel'));
  btn.classList.add('sel');
  sTipo = {num, label, nivel};
  document.getElementById('tipoLabel').textContent = 'Art. '+num+' — '+label;
  if(!PODE_EDIT.includes(cu.perfil) && nivel==='urgencia') nivel='grave';
  document.getElementById('occGrav').value = nivel==='urgencia'?'urgencia':'grave';
  const p = PROT[nivel]||PROT.grave;
  const ehProf = cu.perfil==='professor';
  const rowsProf = p.professor.map((s,i)=>`<div class="ps"><span class="pn">${i+1}</span><span>${s}</span></div>`).join('');
  const rowsGest = ehProf
    ? p.gestao.map((s,i)=>`<div class="ps" style="opacity:.4"><span class="pn" style="background:#bbb">${p.professor.length+i+1}</span><span>${s}</span></div>`).join('')
    : p.gestao.map((s,i)=>`<div class="ps"><span class="pn">${p.professor.length+i+1}</span><span>${s}</span></div>`).join('');
  const rodape = ehProf ? `<div style="margin-top:6px;font-size:11px;color:var(--or);padding:4px 8px;background:var(--orl);border-radius:4px">Os demais passos serão executados pela equipe gestora.</div>` : '';
  document.getElementById('protBox').innerHTML = `<div class="pb"><strong>Protocolo 179 — Procedimentos obrigatórios:</strong>${rowsProf}${rowsGest}${rodape}</div>`;
  document.getElementById('protBox').style.display='block';
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const isGest = () => ['coordenador','vice','diretor'].includes(cu.perfil);
const isEdit = () => PODE_EDIT.includes(cu.perfil);
const isImprimir = () => PODE_EDIT.includes(cu.perfil);

function _setDatas() {
  const d=document.getElementById('occData'); if(d) d.value=new Date().toISOString().split('T')[0];
  const h=document.getElementById('occHora'); if(h) h.value=new Date().toTimeString().slice(0,5);
}

// ─── CARDS ───────────────────────────────────────────────────────────────────
function cardHTML(o) {
  const reg = USUARIOS.find(u=>u.id===o.registradoPorId);
  const nomes = o.alunos&&o.alunos.length ? o.alunos.map(a=>a.nome).join(', ') : '—';
  const pchip = reg?(reg.perfil==='professor'?'background:#E8EAF6;color:#3949AB':reg.perfil==='poc'?'background:var(--orl);color:var(--or)':'background:var(--mgl);color:var(--mg)'):'';
  const naoLidos = chatNaoLidos[String(o.id)] || 0;
  const badgeChat = naoLidos > 0 ? `<span style="background:var(--re);color:#fff;border-radius:50%;width:16px;height:16px;font-size:9px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;margin-left:4px">${naoLidos}</span>` : '';
  return `<div class="oc ${o.gravidade}">
    <div class="oh"><div style="flex:1;min-width:0">
      <div class="ot">Art. ${o.numero} — ${o.tipo}</div>
      <div class="om">${o.data} às ${o.hora} · ${o.local} · <strong>${o.turma}</strong></div>
      <div class="om">Aluno(s): ${nomes}</div>
      ${reg?`<div class="om">Por: ${reg.nome} <span style="font-size:10px;padding:1px 6px;border-radius:10px;font-weight:500;${pchip}">${reg.perfil.toUpperCase()}</span></div>`:''}
    </div>
    <div class="bs">
      <span class="bg bg-${o.gravidade}">${GL[o.gravidade]}</span>
      <span class="bg bg-${o.status}">${SL[o.status]||o.status}</span>
    </div></div>
    <div class="oa">
      <button class="bn" onclick="window._verDet(${o.id})">Ver detalhes</button>
      ${isEdit()&&o.status==='pendente'?`<button class="bn mg" onclick="window._abrirComp(${o.id})">✏ Complementar</button>`:''}
      ${isEdit()?`<button class="bn or" onclick="window._abrirEdit(${o.id})">⬆ Editar</button>`:''}
      ${isEdit()?`<button class="bn vd" onclick="window._abrirChat(${o.id})">💬 Chat${badgeChat}</button>`:''}
      ${isImprimir()?`<button class="bn bl" onclick="window._gerarDoc(${o.id})">📄 Gerar Documento</button>`:''}
    </div></div>`;
}

// ─── DASHBOARD ───────────────────────────────────────────────────────────────
function renderDash() {
  const total=occ.length, urg=occ.filter(o=>o.gravidade==='urgencia').length;
  const pend=occ.filter(o=>o.status==='pendente').length, enc=occ.filter(o=>o.status==='encerrado').length;
  document.getElementById('statsGrid').innerHTML=`
    <div class="sc re"><div class="sn">${urg}</div><div class="sl">Urgência</div></div>
    <div class="sc or"><div class="sn">${pend}</div><div class="sl">Aguard. complemento</div></div>
    <div class="sc mg"><div class="sn">${total}</div><div class="sl">Total</div></div>
    <div class="sc gr"><div class="sn">${enc}</div><div class="sl">Encerradas</div></div>`;
  const al=[];
  if(urg>0) al.push(`<div class="ab re" style="margin-bottom:8px">⚠ ${urg} ocorrência(s) de urgência/emergência.</div>`);
  if(pend>0&&isEdit()) al.push(`<div class="ab or" style="margin-bottom:8px">📋 ${pend} ocorrência(s) aguardando complemento.</div>`);
  document.getElementById('dashAlerts').innerHTML=al.join('');
  const rec = [...occ].sort((a,b)=>b.id-a.id).slice(0,5);
  document.getElementById('dashList').innerHTML = rec.length
    ? rec.map(cardHTML).join('')
    : '<div class="es">Nenhuma ocorrência registrada ainda.</div>';
}

function renderOcc() {
  const fN=document.getElementById('fNivel').value;
  const fT=document.getElementById('fTurma').value;
  const fG=document.getElementById('fGrav').value;
  const fS=document.getElementById('fStatus').value;
  let lista=[...occ].sort((a,b)=>b.id-a.id);
  if(fN) lista=lista.filter(o=>TD[o.turma]&&TD[o.turma].nivel===fN);
  if(fT) lista=lista.filter(o=>o.turma===fT);
  if(fG) lista=lista.filter(o=>o.gravidade===fG);
  if(fS) lista=lista.filter(o=>o.status===fS);
  document.getElementById('occList').innerHTML=lista.length
    ? lista.map(cardHTML).join('')
    : '<div class="es">Nenhuma ocorrência encontrada.</div>';
}

// ─── REGISTRAR ────────────────────────────────────────────────────────────────
window._registrarOcorrencia = async () => {
  if(!sTipo){alert('Selecione o tipo de ocorrência.');return;}
  const data=document.getElementById('occData').value;
  const hora=document.getElementById('occHora').value;
  const local=document.getElementById('occLocal').value;
  const grav=document.getElementById('occGrav').value;
  const turma=document.getElementById('occTurma').value;
  if(!data||!hora||!local||!grav||!turma){alert('Preencha: tipo, data, horário, local, gravidade e turma.');return;}

  const relato=document.getElementById('occRelato').value;
  const desc=isGest()?document.getElementById('occDesc').value:'';
  const prov=isGest()?document.getElementById('occProv').value:'';
  const bo=isGest()?document.getElementById('occBO').value:'';
  const fam=isGest()?document.getElementById('occFam').value:'';

  const payload = {
    tipo:sTipo.label, numero:sTipo.num, data, hora, local, gravidade:grav, turma,
    alunos:[...selAlunos],
    envolvido:document.getElementById('occEnv').value||'Estudante(s)',
    relato, descricao:desc, providencias:prov, bo, familia:fam,
    registradoPorId: cu.id,
    registradoPorNome: cu.nome,
    registradoPorPerfil: cu.perfil,
  };

  const resp = await fetch('/api/ocorrencias', {
    method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload),
  });
  const novaOcc = await resp.json();
  if(!occ.find(o=>o.id===novaOcc.id)) occ.push(novaOcc);

  _limparForm(); renderDash();
  showTab('ocorrencias', document.querySelectorAll('.nt button')[2]);
  alert('Ocorrência registrada!\n'+(isGest()?'Use "📄 Gerar Documento" para visualizar.':'Aguardando complemento da equipe gestora.'));
};

function _limparForm() {
  sTipo=null; selAlunos=[]; atuais=[];
  document.getElementById('tipoLabel').textContent='nenhum';
  document.getElementById('protBox').style.display='none';
  document.querySelectorAll('.tb2').forEach(b=>b.classList.remove('sel'));
  document.getElementById('painelWrap').style.display='none';
  document.getElementById('listaAlunos').innerHTML='';
  document.getElementById('tagsAlunos').innerHTML='';
  document.getElementById('filtroAluno').value='';
  ['occData','occHora','occLocal','occGrav','occTurma','occEnv','occRelato','occDesc','occProv','occBO','occFam'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});
  _setDatas();
}

// ─── VER DETALHES ─────────────────────────────────────────────────────────────
window._verDet = (id) => {
  const o=occ.find(x=>x.id===id); if(!o) return;
  const reg=USUARIOS.find(u=>u.id===o.registradoPorId);
  const comp=o.complementadoPorId?USUARIOS.find(u=>u.id===o.complementadoPorId):null;
  const nomes=o.alunos&&o.alunos.length?o.alunos.map(a=>a.nome).join('<br>'):'—';
  document.getElementById('modalTit').textContent='Ocorrência #'+o.id+' — Art. '+o.numero;
  document.getElementById('modalBody').innerHTML=`
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:1rem">
      <span class="bg bg-${o.gravidade}" style="font-size:12px;padding:4px 10px">${GL[o.gravidade]}</span>
      <span class="bg bg-${o.status}" style="font-size:12px;padding:4px 10px">${SL[o.status]||o.status}</span>
    </div>
    <div class="ir"><span class="il">Tipo</span><span style="text-align:right;max-width:60%">${o.tipo}</span></div>
    <div class="ir"><span class="il">Data / Hora</span><span>${o.data} às ${o.hora}</span></div>
    <div class="ir"><span class="il">Local</span><span>${o.local}</span></div>
    <div class="ir"><span class="il">Turma</span><span>${o.turma}</span></div>
    <div class="ir"><span class="il">Aluno(s)</span><span style="text-align:right;max-width:60%;font-size:12px">${nomes}</span></div>
    <div class="ir"><span class="il">Registrado por</span><span>${reg?reg.nome:'—'}</span></div>
    ${o.relato?`<div style="margin-top:10px;background:#f9f9f9;border-radius:8px;padding:10px"><p style="font-size:12px;color:var(--mu);font-weight:500;margin-bottom:4px">Relato</p><p style="font-size:13px">${o.relato}</p></div>`:''}
    ${o.descricao?`<div style="margin-top:8px;background:var(--mgl);border-radius:8px;padding:10px"><p style="font-size:12px;color:var(--mg);font-weight:500;margin-bottom:4px">Descrição — ${comp?comp.nome:'Coordenação'}</p><p style="font-size:13px">${o.descricao}</p>${o.providencias?`<p style="font-size:12px;color:var(--mu);font-weight:500;margin:6px 0 3px">Providências</p><p style="font-size:13px">${o.providencias}</p>`:''}</div>`:''}
    <div style="display:flex;gap:6px;margin-top:1rem;flex-wrap:wrap">
      ${isEdit()&&o.status==='pendente'?`<button class="bn mg" onclick="closeModal();window._abrirComp(${id})">✏ Complementar</button>`:''}
      ${isEdit()?`<button class="bn or" onclick="closeModal();window._abrirEdit(${id})">⬆ Editar</button>`:''}
      ${isEdit()?`<button class="bn vd" onclick="closeModal();window._abrirChat(${id})">💬 Chat</button>`:''}
      ${isImprimir()?`<button class="bn bl" onclick="closeModal();window._gerarDoc(${id})">📄 Gerar Documento</button>`:''}
    </div>`;
  document.getElementById('modalOv').classList.add('show');
};

// ─── EDITAR ───────────────────────────────────────────────────────────────────
window._abrirEdit = (id) => {
  const o=occ.find(x=>x.id===id); if(!o) return;
  const iAtual=GORDEM.indexOf(o.gravidade);
  const optsG=GORDEM.map((g,i)=>`<option value="${g}"${i<iAtual?' disabled':''}${g===o.gravidade?' selected':''}>${GL[g]}${i<iAtual?' (não permitido)':''}</option>`).join('');
  const todos=[...TU,...TG];
  const optsT=['<optgroup label="Bloco I — Urgência/Emergência">',
    ...TU.map(t=>`<option value="${t.n}||urgencia"${o.numero===t.n?' selected':''}>Art. ${t.n} — ${t.l}</option>`),
    '</optgroup><optgroup label="Bloco II — Convivência e Proteção">',
    ...TG.map(t=>`<option value="${t.n}||grave"${o.numero===t.n?' selected':''}>Art. ${t.n} — ${t.l}</option>`),
    '</optgroup>'].join('');
  document.getElementById('modalTit').textContent='Editar Ocorrência #'+o.id;
  document.getElementById('modalBody').innerHTML=`
    <div class="fg"><label>Gravidade</label><select id="eGrav">${optsG}</select></div>
    <div class="fg"><label>Tipo (Art.)</label><select id="eTipo" style="font-size:13px">${optsT}</select></div>
    <div class="fg"><label>Relato do professor</label><textarea id="eRelato" rows="3">${o.relato||''}</textarea></div>
    <div style="display:flex;gap:8px;margin-top:8px">
      <button class="bp" style="flex:1" onclick="window._salvarEdit(${id})">Salvar</button>
      <button class="bn" style="flex:1;padding:10px" onclick="closeModal()">Cancelar</button>
    </div>`;
  document.getElementById('modalOv').classList.add('show');
};
window._salvarEdit = async (id) => {
  const o=occ.find(x=>x.id===id); if(!o) return;
  const ng=document.getElementById('eGrav').value;
  if(GORDEM.indexOf(ng)<GORDEM.indexOf(o.gravidade)){alert('A gravidade não pode ser reduzida.');return;}
  const tv=document.getElementById('eTipo').value.split('||');
  const todos=[...TU,...TG]; const tipo=todos.find(t=>t.n===tv[0]);
  const body={gravidade:ng,numero:tv[0],tipo:tipo?tipo.l:o.tipo,relato:document.getElementById('eRelato').value,editadoPorId:cu.id};
  await fetch('/api/ocorrencias/'+id+'/editar',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  closeModal();
};

// ─── COMPLEMENTAR ─────────────────────────────────────────────────────────────
window._abrirComp = (id) => {
  const o=occ.find(x=>x.id===id); if(!o) return;
  const nomes=o.alunos&&o.alunos.length?o.alunos.map(a=>a.nome).join(', '):'—';
  const camposAlunos=o.alunos&&o.alunos.length
    ? o.alunos.map((a,i)=>{const val=(o.relatosAlunos&&o.relatosAlunos[i])||'';
        return `<div class="fg"><label style="font-weight:500">Relato: ${a.nome} <span style="font-size:10px;color:var(--mu)">(RA: ${a.ra||'—'})</span></label><textarea id="cRelAl_${i}" rows="2">${val}</textarea></div>`;
      }).join('')
    : `<div class="fg"><label>Relato do(a) estudante</label><textarea id="cRelAl_0" rows="2"></textarea></div>`;
  document.getElementById('modalTit').textContent='Complementar Ocorrência #'+o.id;
  document.getElementById('modalBody').innerHTML=`
    <div style="background:#f9f9f9;border-radius:8px;padding:10px;margin-bottom:1rem;font-size:13px">
      <strong>Art. ${o.numero} — ${o.tipo}</strong><br>
      <span style="color:var(--mu)">${o.data} às ${o.hora} · ${o.turma} · ${nomes}</span>
      ${o.relato?`<div style="margin-top:6px;font-size:12px"><strong>Relato:</strong> ${o.relato}</div>`:''}
    </div>
    <div class="cw">
      <h4>✏ Complemento — ${PL[cu.perfil]}</h4>
      <div class="fl" style="font-size:11px;margin-bottom:8px">Relatos dos Envolvidos</div>
      ${camposAlunos}
      <div class="fg"><label style="font-weight:500">Relato da Família / Responsável</label><textarea id="cRelResp" rows="2">${o.relatoResponsavel||''}</textarea></div>
      <div class="fl" style="font-size:11px;margin-bottom:8px">Apuração da Equipe Gestora</div>
      <div class="fg"><label>Descrição detalhada</label><textarea id="cDesc" rows="4">${o.descricao||''}</textarea></div>
      <div class="fg"><label>Providências tomadas</label><textarea id="cProv" rows="3">${o.providencias||''}</textarea></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div class="fg"><label>B.O. registrado?</label><select id="cBO"><option value="">Selecione...</option><option${o.bo==='Sim'?' selected':''}>Sim</option><option${o.bo==='Não se aplica'?' selected':''}>Não se aplica</option><option${o.bo==='Não'?' selected':''}>Não</option></select></div>
        <div class="fg"><label>Família comunicada?</label><select id="cFam"><option value="">Selecione...</option><option${o.familia==='Sim'?' selected':''}>Sim</option><option${o.familia==='Não'?' selected':''}>Não</option><option${o.familia==='Não se aplica'?' selected':''}>Não se aplica</option></select></div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
        <button class="bp" style="flex:1;min-width:140px" onclick="window._salvarComp(${id})">Salvar e Encerrar</button>
        <button class="bn" style="flex:1;min-width:100px;padding:10px" onclick="closeModal()">Cancelar</button>
      </div>
    </div>`;
  document.getElementById('modalOv').classList.add('show');
};
window._salvarComp = async (id) => {
  const o=occ.find(x=>x.id===id); if(!o) return;
  const d=document.getElementById('cDesc').value;
  if(!d.trim()){alert('Preencha a descrição detalhada.');return;}
  const relatosAlunos=o.alunos&&o.alunos.length
    ? o.alunos.map((_,i)=>{const el=document.getElementById('cRelAl_'+i);return el?el.value:'';})
    : [document.getElementById('cRelAl_0')?.value||''];
  const body={
    relatosAlunos, relatoResponsavel:document.getElementById('cRelResp').value||'',
    descricao:d, providencias:document.getElementById('cProv').value,
    bo:document.getElementById('cBO').value||'Não informado',
    familia:document.getElementById('cFam').value||'Não informado',
    complementadoPorId:cu.id,
  };
  await fetch('/api/ocorrencias/'+id+'/complementar',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  closeModal();
  alert('Encerrada! Use "📄 Gerar Documento" para visualizar e imprimir.');
};

// ─── CHAT ─────────────────────────────────────────────────────────────────────
window._abrirChat = (id) => {
  const o=occ.find(x=>x.id===id); if(!o) return;
  // Limpa badge de não lidos
  delete chatNaoLidos[String(id)];
  _atualizarBadgeChat();
  iniciarChat(o, cu, chats);
};
function abrirChat(o) { window._abrirChat(o.id); }

// ─── GERAR DOCUMENTO ─────────────────────────────────────────────────────────
window._gerarDoc = (id) => {
  const o=occ.find(x=>x.id===id); if(!o) return;
  const doc=montarDoc(o);
  const frame=document.getElementById('frameDoc');
  frame.srcdoc=doc;
  document.getElementById('modalDoc').classList.add('show');
  document.body.style.overflow='hidden';
};
window._fecharModalDoc = () => {
  document.getElementById('modalDoc').classList.remove('show');
  document.getElementById('frameDoc').srcdoc='';
  document.body.style.overflow='';
};
window._imprimirFrame = () => {
  const frame=document.getElementById('frameDoc');
  frame.contentWindow.focus();
  frame.contentWindow.print();
};

// ─── MODAL ────────────────────────────────────────────────────────────────────
window.closeModal = (e) => {
  if(!e||e.target===document.getElementById('modalOv'))
    document.getElementById('modalOv').classList.remove('show');
};

// ─── TABS ─────────────────────────────────────────────────────────────────────
window.showTab = (name, btn) => {
  ['dashboard','registrar','ocorrencias','relatorio','gestao'].forEach(t => {
    document.getElementById('tab-'+t).style.display = t===name ? '' : 'none';
  });
  document.querySelectorAll('.nt button').forEach(b=>b.classList.remove('act'));
  if(btn) btn.classList.add('act');
  if(name==='ocorrencias') renderOcc();
  if(name==='gestao') renderGestao();
  if(name==='dashboard') renderDash();
};

function renderGestao() {
  document.getElementById('gestaoList').innerHTML=USUARIOS.map(u=>`
    <div class="oc leve" style="border-left-color:var(--mg)">
      <div class="oh"><div><div class="ot">${u.nome}</div></div>
      <span class="bg" style="background:var(--mgl);color:var(--mg);font-size:11px;padding:3px 10px">${PL[u.perfil]}</span>
    </div></div>`).join('');
}

window._gerarRel = () => {
  const fT=document.getElementById('relTurma').value;
  const fG=document.getElementById('relGrav').value;
  let lista=[...occ];
  if(fT) lista=lista.filter(o=>o.turma===fT);
  if(fG) lista=lista.filter(o=>o.gravidade===fG);
  const total=lista.length,urg=lista.filter(o=>o.gravidade==='urgencia').length;
  const enc=lista.filter(o=>o.status==='encerrado').length,pend=lista.filter(o=>o.status==='pendente').length;
  const boR=lista.filter(o=>o.bo==='Sim').length;
  const tc={};lista.forEach(o=>{tc[o.tipo]=(tc[o.tipo]||0)+1;});
  const top=Object.entries(tc).sort((a,b)=>b[1]-a[1]).slice(0,5);
  document.getElementById('relOutput').innerHTML=`<div class="fc">
    <div class="sg">
      <div class="sc mg"><div class="sn">${total}</div><div class="sl">Total</div></div>
      <div class="sc re"><div class="sn">${urg}</div><div class="sl">Urgência</div></div>
      <div class="sc or"><div class="sn">${pend}</div><div class="sl">Pendentes</div></div>
      <div class="sc gr"><div class="sn">${enc}</div><div class="sl">Encerradas</div></div>
    </div>
    <div class="ir"><span class="il">Com B.O.</span><span>${boR}</span></div>
    ${top.length?top.map(([t,c])=>`<div class="ir"><span class="il" style="font-size:12px;max-width:70%">${t}</span><span style="font-weight:500">${c}</span></div>`).join(''):''}
  </div>`;
};

// ─── MONTAR DOCUMENTO ─────────────────────────────────────────────────────────
function montarDoc(o) {
  const reg=USUARIOS.find(u=>u.id===o.registradoPorId);
  const comp=o.complementadoPorId?USUARIOS.find(u=>u.id===o.complementadoPorId):null;
  const hoje=new Date().toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'});
  const numF='OC-'+new Date().getFullYear()+'-'+String(o.id).padStart(4,'0');
  const GL2={urgencia:'URGÊNCIA / EMERGÊNCIA',grave:'GRAVE',media:'MÉDIA',leve:'LEVE'};
  const nomeAlunos=o.alunos&&o.alunos.length?o.alunos.map((a,i)=>`
    <tr><td style="padding:4px 8px;border:1px solid #999;font-size:10pt">${i+1}</td>
        <td style="padding:4px 8px;border:1px solid #999;font-size:10pt">${a.nome}</td>
        <td style="padding:4px 8px;border:1px solid #999;font-size:10pt">${a.ra||'—'}</td></tr>`).join('')
    :'<tr><td colspan="3" style="padding:4px 8px;border:1px solid #999;font-size:10pt;color:#666">Não identificado</td></tr>';
  const protCompleto={
    urgencia:['Manter calma e preservar a segurança de todos','Acionar a Polícia Militar imediatamente (190) ou Botão do Pânico','Comunicar o Diretor/Vice-Diretor da unidade escolar','Comunicar a Unidade Regional de Ensino de São José dos Campos','Registrar na Plataforma CONVIVA (Placon)','Preservar imagens de câmeras (solicitar em até 3 dias úteis)','Manter sigilo sobre os envolvidos','Aguardar orientação da URE São José dos Campos'],
    grave:['Acolher e escutar as partes envolvidas com imparcialidade','Comunicar a equipe gestora (Diretor/Vice-Diretor/Coordenador)','Comunicar a família dos estudantes envolvidos','Registrar na Plataforma CONVIVA (Placon)','Verificar necessidade de acionamento do Conselho Tutelar','Verificar necessidade de lavratura de Boletim de Ocorrência','Acompanhar o caso e registrar todas as providências tomadas','Realizar escuta individualizada dos envolvidos quando necessário'],
  };
  const passos=protCompleto[o.gravidade==='urgencia'?'urgencia':'grave'];
  // Logo em base64 embutido no HTML do documento
  const logoBase64='LOGO_BASE64_PLACEHOLDER';
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
  <title>Ocorrência ${numF}</title>
  <style>
    @page{size:A4;margin:1.5cm 2cm}
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,Helvetica,sans-serif;font-size:10pt;color:#000;background:#fff}
    .page{width:100%;max-width:21cm;margin:0 auto}
    .cabecalho{display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid #C2185B;padding-bottom:10px;margin-bottom:6px}
    .cab-logo{width:90px}
    .cab-centro{flex:1;text-align:center;padding:0 12px}
    .cab-escola{font-size:12pt;font-weight:bold;color:#222}
    .cab-seduc{font-size:8.5pt;color:#555;margin-top:2px}
    .cab-dir{font-size:8.5pt;color:#555}
    .cab-direita{text-align:right;min-width:110px}
    .cab-num{font-size:9pt;font-weight:bold;color:#C2185B;border:1px solid #C2185B;padding:3px 8px;border-radius:4px;display:inline-block}
    .cab-data{font-size:8pt;color:#666;margin-top:4px}
    .secao{margin-bottom:10px}
    .secao-titulo{font-size:9pt;font-weight:bold;text-transform:uppercase;background:#C2185B;color:#fff;padding:4px 10px;border-radius:3px;margin-bottom:6px}
    .secao-titulo.cinza{background:#555}.secao-titulo.azul{background:#1565C0}
    .campo-grid{display:grid;grid-template-columns:1fr 1fr;gap:4px 12px}
    .campo-grid-3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px 12px}
    .campo{margin-bottom:4px}
    .campo label{font-size:8pt;color:#555;font-weight:bold;display:block}
    .campo .valor{font-size:10pt;border-bottom:1px solid #bbb;padding-bottom:1px;min-height:18px}
    .grav-badge{display:inline-block;padding:2px 12px;border-radius:10px;font-size:9pt;font-weight:bold}
    .grav-urgencia{background:#FFEBEE;color:#C62828;border:1px solid #FFCDD2}
    .grav-grave{background:#FFF3E0;color:#E65100;border:1px solid #FFE0B2}
    .grav-media{background:#FFF8E1;color:#F57F17;border:1px solid #FFE082}
    .grav-leve{background:#E8F5E9;color:#2E7D32;border:1px solid #C8E6C9}
    .tab-alunos{width:100%;border-collapse:collapse;margin-top:4px}
    .tab-alunos th{background:#f5f5f5;border:1px solid #bbb;padding:4px 8px;font-size:8.5pt;text-align:left}
    .caixa-texto{border:1px solid #bbb;border-radius:3px;padding:8px;min-height:50px;font-size:10pt;white-space:pre-wrap;background:#fafafa}
    .caixa-vazia{border:1px solid #bbb;border-radius:3px;min-height:50px;background:#fff}
    .protocolo-lista{list-style:none;padding:0}
    .protocolo-lista li{display:flex;gap:8px;align-items:flex-start;padding:3px 0;border-bottom:0.5px solid #eee;font-size:9.5pt}
    .protocolo-lista li:last-child{border-bottom:none}
    .step-n{background:#C2185B;color:#fff;border-radius:50%;width:16px;height:16px;display:flex;align-items:center;justify-content:center;font-size:8pt;font-weight:bold;flex-shrink:0;margin-top:1px}
    .assinaturas-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px 24px;margin-top:4px}
    .assinatura-box{padding-top:4px}
    .assinatura-linha{border-bottom:1px solid #333;height:42px;margin-bottom:3px}
    .assinatura-nome{font-size:9pt;font-weight:bold;text-align:center}
    .assinatura-cargo{font-size:8pt;color:#555;text-align:center}
    .assinatura-cpf{font-size:8pt;color:#888;text-align:center}
    .rodape{margin-top:12px;border-top:1px solid #ccc;padding-top:6px;display:flex;justify-content:space-between}
    .rodape div{font-size:7.5pt;color:#888}
    .aviso-legal{background:#FFF8E1;border:1px solid #FFE082;border-radius:4px;padding:6px 10px;font-size:8pt;color:#555;margin-top:8px;text-align:center}
    @media print{body{margin:0}}
  </style></head><body><div class="page">
    <div class="cabecalho">
      <img class="cab-logo" src="/assets/logo_sp.png" alt="SP"/>
      <div class="cab-centro">
        <div class="cab-escola">EE PROFESSORA MALBA THEREZA FERRAZ CAMPANER</div>
        <div class="cab-seduc">Unidade Regional de Ensino de São José dos Campos · Secretaria da Educação do Estado de São Paulo</div>
        <div class="cab-dir" style="margin-top:6px;font-weight:bold;color:#C2185B">REGISTRO DE OCORRÊNCIA ESCOLAR</div>
        <div class="cab-dir">Protocolo 179 · CONVIVA SP · SEDUC SP</div>
      </div>
      <div class="cab-direita">
        <div class="cab-num">${numF}</div>
        <div class="cab-data">Emissão: ${hoje}</div>
      </div>
    </div>
    <p style="font-size:8pt;color:#888;text-align:center;margin-bottom:8px">Documento com valor legal — Art. 5º LDB 9394/96 · Res. SE nº 19/2010 · Protocolo 179 CONVIVA SP</p>
    <div class="secao"><div class="secao-titulo">1. Identificação da Ocorrência</div>
      <div class="campo-grid">
        <div class="campo"><label>Tipo / Artigo</label><div class="valor">Art. ${o.numero} — ${o.tipo}</div></div>
        <div class="campo"><label>Gravidade</label><div class="valor"><span class="grav-badge grav-${o.gravidade}">${GL2[o.gravidade]}</span></div></div>
        <div class="campo"><label>Data</label><div class="valor">${o.data}</div></div>
        <div class="campo"><label>Horário</label><div class="valor">${o.hora}</div></div>
        <div class="campo"><label>Local</label><div class="valor">${o.local}</div></div>
        <div class="campo"><label>Turma</label><div class="valor">${o.turma}</div></div>
        <div class="campo"><label>Envolvido</label><div class="valor">${o.envolvido||'—'}</div></div>
        <div class="campo"><label>Status</label><div class="valor">${o.status==='encerrado'?'Encerrado':'Em andamento'}</div></div>
      </div>
    </div>
    <div class="secao"><div class="secao-titulo">2. Aluno(s) Envolvido(s)</div>
      <table class="tab-alunos"><thead><tr><th style="width:30px">Nº</th><th>Nome Completo</th><th style="width:120px">RA</th></tr></thead>
      <tbody>${nomeAlunos}</tbody></table>
    </div>
    <div class="secao"><div class="secao-titulo">3. Relato do Professor / Servidor</div>
      <div class="campo"><label>Por: ${reg?reg.nome+' ('+PL[reg.perfil]+')':'—'} · ${o.data} às ${o.hora}</label></div>
      ${o.relato?`<div class="caixa-texto">${o.relato}</div>`:`<div class="caixa-vazia"></div>`}
    </div>
    <div class="secao"><div class="secao-titulo cinza">4. Relato(s) dos Envolvidos / Família</div>
      ${o.alunos&&o.alunos.length?o.alunos.map((a,i)=>{
        const rel=o.relatosAlunos&&o.relatosAlunos[i]?o.relatosAlunos[i]:'';
        return `<div style="margin-bottom:8px"><div class="campo"><label>Estudante: ${a.nome} · RA: ${a.ra||'—'}</label></div>
          ${rel?`<div class="caixa-texto" style="min-height:38px">${rel}</div>`:`<div class="caixa-vazia" style="min-height:38px"></div>`}
        </div>`;
      }).join(''):`<div class="caixa-vazia" style="min-height:38px;margin-bottom:8px"></div>`}
      <div class="campo"><label>Relato da Família / Responsável</label></div>
      ${o.relatoResponsavel?`<div class="caixa-texto" style="min-height:38px">${o.relatoResponsavel}</div>`:`<div class="caixa-vazia" style="min-height:38px"></div>`}
    </div>
    <div class="secao"><div class="secao-titulo azul">5. Descrição e Providências — Equipe Gestora</div>
      <div class="campo"><label>Por: ${comp?comp.nome+' ('+PL[comp.perfil]+')':'—'} · Em: ${o.dataComp||'—'}</label></div>
      <div class="campo"><label>Descrição detalhada</label></div>
      ${o.descricao?`<div class="caixa-texto" style="min-height:60px">${o.descricao}</div>`:`<div class="caixa-vazia" style="min-height:60px"></div>`}
      <div class="campo" style="margin-top:6px"><label>Providências tomadas</label></div>
      ${o.providencias?`<div class="caixa-texto" style="min-height:40px">${o.providencias}</div>`:`<div class="caixa-vazia" style="min-height:40px"></div>`}
      <div class="campo-grid-3" style="margin-top:6px">
        <div class="campo"><label>B.O.</label><div class="valor">${o.bo||'☐ Sim  ☐ Não  ☐ N/A'}</div></div>
        <div class="campo"><label>Família</label><div class="valor">${o.familia||'☐ Sim  ☐ Não'}</div></div>
        <div class="campo"><label>Conselho Tutelar</label><div class="valor">☐ Sim  ☐ Não  ☐ N/A</div></div>
      </div>
    </div>
    <div class="secao"><div class="secao-titulo">6. Providências — Protocolo 179 · CONVIVA SP</div>
      <ul class="protocolo-lista">${passos.map((p,i)=>`<li><span class="step-n">${i+1}</span><span>${p}</span></li>`).join('')}</ul>
    </div>
    <div class="secao"><div class="secao-titulo">7. Assinaturas</div>
      <div class="assinaturas-grid">
        <div class="assinatura-box"><div class="assinatura-linha"></div>
          <div class="assinatura-nome">${reg?reg.nome:'Professor(a)'}</div>
          <div class="assinatura-cargo">${reg?PL[reg.perfil]:'Professor'}</div>
          <div class="assinatura-cpf">CPF: ___.___.___-__ · Data: ____/____/________</div></div>
        ${o.alunos&&o.alunos.length?o.alunos.map(a=>`
        <div class="assinatura-box"><div class="assinatura-linha"></div>
          <div class="assinatura-nome">${a.nome}</div>
          <div class="assinatura-cargo">Estudante · RA: ${a.ra||'—'}</div>
          <div class="assinatura-cpf">Data: ____/____/________</div></div>`).join(''):''}
        <div class="assinatura-box"><div class="assinatura-linha"></div>
          <div class="assinatura-nome">Responsável pelo(a) Estudante</div>
          <div class="assinatura-cargo">Nome: ____________________________________________</div>
          <div class="assinatura-cpf">CPF: ___.___.___-__ · Data: ____/____/________</div></div>
        <div class="assinatura-box"><div class="assinatura-linha"></div>
          <div class="assinatura-nome">P.O.C. — Prof. Orientador de Convivência</div>
          <div class="assinatura-cargo">Nome: ____________________________________________</div>
          <div class="assinatura-cpf">CPF: ___.___.___-__ · Data: ____/____/________</div></div>
        <div class="assinatura-box"><div class="assinatura-linha"></div>
          <div class="assinatura-nome">${comp?comp.nome:'Coordenador(a) Pedagógico(a)'}</div>
          <div class="assinatura-cargo">${comp?PL[comp.perfil]:'Coordenação Pedagógica'}</div>
          <div class="assinatura-cpf">CPF: ___.___.___-__ · Data: ____/____/________</div></div>
        <div class="assinatura-box"><div class="assinatura-linha"></div>
          <div class="assinatura-nome">Diretor(a) / Vice-Diretor(a)</div>
          <div class="assinatura-cargo">Equipe Gestora</div>
          <div class="assinatura-cpf">CPF: ___.___.___-__ · Data: ____/____/________</div></div>
        <div class="assinatura-box"><div class="assinatura-linha"></div>
          <div class="assinatura-nome">Testemunha</div>
          <div class="assinatura-cargo">Nome: ____________________________________________</div>
          <div class="assinatura-cpf">CPF: ___.___.___-__ · Data: ____/____/________</div></div>
      </div>
    </div>
    <div class="aviso-legal">Este documento possui valor legal e deve ser arquivado na UE, conforme Res. SE nº 19/2010 e Protocolo 179 CONVIVA SP. Falsificação: Art. 299 CP.</div>
    <div class="rodape">
      <div>EE Professora Malba Thereza Ferraz Campaner · Protocolo 179 · CONVIVA SP · SEDUC SP · ${numF}</div>
      <div style="text-align:right">Emitido em: ${hoje}</div>
    </div>
  </div></body></html>`;
}

// ─── BOOTSTRAP ────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await init();
  _montarTurmasSelectReal();
  _montarGridTiposReal();
});
