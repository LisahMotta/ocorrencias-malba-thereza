// app.js — lógica principal do sistema de ocorrências
import { conectar, onEvento, enviar } from './ws.js';
import { mostrarNotifOcorrencia, pedirPermissaoNotif } from './notif.js';
import { iniciarChat, fecharChat, receberMsgChat, sincronizarChats } from './chat.js';
import { salvarSessao, limparSessao, getToken, getUsuario, temSessao, apiFetch } from './auth.js';

// ─── DADOS ────────────────────────────────────────────────────────────────────
let USUARIOS = [
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
const GL = { urgencia:'Urgência/Emergência', grave:'Grave', media:'Média', leve:'Leve', administrativa:'Administrativa' };
const SL = { pendente:'Aguard. complemento', encerrado:'Encerrado' };
const GORDEM = ['leve','media','grave','urgencia'];
const PODE_EDIT = ['poc','coordenador','vice','diretor'];
const PODE_REL  = ['poc','coordenador','vice','diretor'];

// Configuração de segmento por coordenador
const COORD_SEGMENTOS = {
  'ARIADNE DA SILVA RODRIGUES': {
    periodo: 'Manhã',
    turmas: ['6º Ano A','6º Ano B','7º Ano A','7º Ano B','8º Ano A','8º Ano B',
             '9º Ano A','9º Ano B','9º Ano C',
             '1ª Série A','1ª Série B','1ª Série C','2ª Série A'],
    desc: '6º Ano A → 2ª Série A — Ensino Fundamental II e Médio',
  },
  'RENATA VALÉRIA': {
    periodo: 'Tarde',
    turmas: ['1º Ano A','1º Ano B','2º Ano A','2º Ano B','3º Ano A','3º Ano B',
             '4º Ano A','4º Ano B','5º Ano A','5º Ano B','6º Ano A','6º Ano B'],
    desc: '1º Ano A → 6º Ano B — Ensino Fundamental I e II',
  },
  'WAGNER GONÇALVES DA SILVA JUNIOR FERRO FAZAN': {
    periodo: 'Noite',
    turmas: ['2ª Série B','2ª Série C','2ª Série D','3ª Série A','3ª Série B','3ª Série C'],
    desc: '2ª Série B → 3ª Série C — Ensino Médio',
  },
};

// Sugestões de intervenção por tipo de ocorrência
const INTERVENCOES = {
  'Aluno dormiu durante a aula': ['Conversa individual sobre rotina de sono','Contato com família','Encaminhar para orientação pedagógica'],
  'Aluno sem material escolar': ['Contato com família','Verificar vulnerabilidade socioeconômica','Disponibilizar material temporariamente'],
  'Aluno com celular em uso indevido': ['Recolher o celular','Orientar sobre regras','Comunicar família em reincidência'],
  'Aluno recusou-se a realizar atividade': ['Conversa individual','Investigar dificuldades de aprendizagem','Encaminhar para reforço'],
  'Aluno perturbou / atrapalhou a aula': ['Advertência verbal','Mudança de lugar','Contato com família em reincidência'],
  'Aluno saiu da sala sem autorização': ['Advertência','Comunicar família','Monitorar comportamento'],
  'Aluno chegou atrasado repetidamente': ['Conversa individual','Contato com família','Registrar frequência'],
  'Aluno com linguagem inadequada (palavrão)': ['Orientação sobre convivência','Contato com família','Mediação de conflitos'],
  'Aluno sem uniforme escolar': ['Orientar sobre regulamento','Comunicar família','Verificar condição financeira'],
  'Aluno danificou material da escola': ['Comunicar família','Solicitar ressarcimento','Conversa sobre responsabilidade'],
  'Aluno com comportamento desrespeitoso com professor': ['Advertência formal','Reunião com família','Encaminhar para direção'],
  'Agressão verbal entre estudantes e/ou servidores': ['Mediação imediata','Escuta individual','Reunião com famílias','Encaminhar ao Conselho Tutelar se reincidente'],
  'Bullying / Cyberbullying / Humilhação sistêmica': ['Intervenção imediata','Rodas de conversa','Projeto de convivência','Envolver toda turma'],
  'Ameaça (palavra, escrito ou gesto)': ['Registrar BO','Comunicar família','Afastamento preventivo se necessário'],
  'Racismo / injúria racial': ['Notificação obrigatória','Rodas de debate','Projeto de consciência racial'],
  'Homofobia / Transfobia': ['Suporte ao estudante','Orientar toda turma','Protocolo de proteção'],
  'Dano ao patrimônio público': ['Comunicar família','Solicitar ressarcimento','Medida socioeducativa'],
};
const TB0 = [
  {n:'A1', l:'Aluno dormiu durante a aula'},
  {n:'A2', l:'Aluno sem material escolar'},
  {n:'A3', l:'Aluno com celular em uso indevido'},
  {n:'A4', l:'Aluno recusou-se a realizar atividade'},
  {n:'A5', l:'Aluno perturbou / atrapalhou a aula'},
  {n:'A6', l:'Aluno saiu da sala sem autorização'},
  {n:'A7', l:'Aluno chegou atrasado repetidamente'},
  {n:'A8', l:'Aluno com linguagem inadequada (palavrão)'},
  {n:'A9', l:'Aluno sem uniforme escolar'},
  {n:'A10',l:'Aluno com boné/chapéu em sala'},
  {n:'A11',l:'Aluno faltou sem justificativa'},
  {n:'A12',l:'Aluno saiu mais cedo sem autorização'},
  {n:'A13',l:'Aluno danificou material da escola'},
  {n:'A14',l:'Aluno com comportamento desrespeitoso com professor'},
  {n:'A15',l:'Aluno utilizou equipamento eletrônico proibido'},
];

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
  try {
    const resp = await fetch('/assets/turmas.json');
    TD = await resp.json();
  } catch(e) {
    console.error('[init] Erro ao carregar turmas:', e);
  }

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
    o.dataset.nome = u.nome;
    o.textContent = u.nome.split(' ').slice(0,3).join(' ') + ' — ' + PL[u.perfil];
    sel.appendChild(o);
  });
}

window._doLogin = async () => {
  const sel = document.getElementById('loginUsuario');
  const nome = sel.options[sel.selectedIndex]?.dataset?.nome || '';
  const senha = document.getElementById('loginPass').value;
  const erroEl = document.getElementById('loginErro');
  erroEl.style.display = 'none';

  if (!nome) { erroEl.textContent = 'Selecione seu nome.'; erroEl.style.display = 'block'; return; }
  if (!senha) { erroEl.textContent = 'Digite sua senha.'; erroEl.style.display = 'block'; return; }

  const btn = document.querySelector('#loginScreen .bp');
  btn.textContent = 'Entrando...'; btn.disabled = true;

  try {
    const resp = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, senha }),
    });
    const data = await resp.json();
    if (!resp.ok) {
      erroEl.textContent = data.erro || 'Erro ao entrar.';
      erroEl.style.display = 'block';
      btn.textContent = 'Entrar'; btn.disabled = false;
      return;
    }
    salvarSessao(data.token, data.usuario);
    await _autenticar(data.usuario);
  } catch {
    erroEl.textContent = 'Erro de conexão com o servidor.';
    erroEl.style.display = 'block';
    btn.textContent = 'Entrar'; btn.disabled = false;
  }
};

window._doLogout = () => {
  limparSessao();
  cu = null; sTipo = null; selAlunos = []; atuais = [];
  document.getElementById('rodape-app').style.display = 'none';
  // Resetar botão de login
  const btn = document.querySelector('#loginScreen .bp');
  if (btn) { btn.textContent = 'Entrar'; btn.disabled = false; }
  // Limpar campos
  const pass = document.getElementById('loginPass');
  if (pass) pass.value = '';
  const erroEl = document.getElementById('loginErro');
  if (erroEl) erroEl.style.display = 'none';
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('mainScreen').style.display = 'none';
};

// Trocar senha
window.abrirModalSenha = () => {
  document.getElementById('senhaAtual').value = '';
  document.getElementById('senhaNova').value = '';
  document.getElementById('senhaConf').value = '';
  document.getElementById('senhaErro').style.display = 'none';
  document.getElementById('modalSenha').classList.add('show');
};
window.fecharModalSenha = () => document.getElementById('modalSenha').classList.remove('show');
window._trocarSenha = async () => {
  const atual = document.getElementById('senhaAtual').value;
  const nova = document.getElementById('senhaNova').value;
  const conf = document.getElementById('senhaConf').value;
  const erroEl = document.getElementById('senhaErro');
  erroEl.style.display = 'none';
  if (!atual || !nova || !conf) { erroEl.textContent = 'Preencha todos os campos.'; erroEl.style.display = 'block'; return; }
  if (nova !== conf) { erroEl.textContent = 'As senhas não coincidem.'; erroEl.style.display = 'block'; return; }
  if (nova.length < 6) { erroEl.textContent = 'A nova senha deve ter pelo menos 6 caracteres.'; erroEl.style.display = 'block'; return; }
  const resp = await apiFetch('/api/auth/trocar-senha', {
    method: 'POST', body: JSON.stringify({ senhaAtual: atual, novaSenha: nova }),
  });
  const data = await resp.json();
  if (!resp.ok) { erroEl.textContent = data.erro; erroEl.style.display = 'block'; return; }
  fecharModalSenha();
  alert('✅ Senha alterada com sucesso!');
};

async function _autenticar(usuario) {
  cu = usuario;
  pedirPermissaoNotif();
  _iniciarWS();
  // Dados chegam via WebSocket (evento 'init')
  _renderMain();
}

// ─── WEBSOCKET ────────────────────────────────────────────────────────────────
function _iniciarWS() {
  conectar(getToken());

  onEvento('status', (s) => {
    const el = document.getElementById('wsStatus');
    if (!el) return;
    el.className = 'ws-status ' + (s === 'conectado' ? 'ok' : 'err');
    el.textContent = s === 'conectado' ? '● online' : '● offline';
  });

  onEvento('init', (msg) => {
    occ = msg.ocorrencias || [];
    chats = msg.chats || {};
    sincronizarChats(chats);
    renderDash();
    renderOcc();

    // Mostrar notificações de ocorrências pendentes recentes (perdidas por reconexão)
    const perfisGestao = ['poc','coordenador','vice','diretor'];
    if (cu && perfisGestao.includes(cu.perfil) && msg.pendentesRecentes && msg.pendentesRecentes.length) {
      // Pequeno delay para não aparecer junto com o carregamento da página
      setTimeout(() => {
        msg.pendentesRecentes.forEach(o => {
          // Não notifica o próprio registrante
          if (o.registradoPorNome === cu.nome) return;
          mostrarNotifOcorrencia(o, cu, (occId) => {
            const oc = occ.find(x => x.id === occId);
            if (oc) abrirChat(oc);
          });
        });
      }, 1500);
    }
  });

  onEvento('nova_ocorrencia', (msg) => {
    if (!cu || !msg.occ) return; // ignora se não estiver logado
    const idx = occ.findIndex(o => o && o.id === msg.occ.id);
    if (idx >= 0) occ[idx] = msg.occ;
    else occ.unshift(msg.occ);
    renderDash();
    renderOcc();
    mostrarNotifOcorrencia(msg.occ, cu, (occId) => {
      const o = occ.find(x => x.id === occId);
      if (o) abrirChat(o);
    });
  });

  onEvento('perfil_atualizado', (msg) => {
    if (cu && msg.userId === cu.id) {
      // Perfil do próprio usuário alterado — força novo login
      alert('⚠️ Seu perfil foi alterado para ' + (PL[msg.perfil]||msg.perfil) + '.\nFaça login novamente para continuar.');
      window._doLogout();
    } else if (cu && ['diretor','vice'].includes(cu.perfil)) {
      // Diretor/vice vê a lista atualizada em tempo real
      renderGestao();
    }
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
  document.getElementById('rodape-app').style.display = 'block';
  document.getElementById('topName').textContent = cu.nome.split(' ').slice(0,2).join(' ');
  document.getElementById('topRole').textContent = PL[cu.perfil];

  const isB1 = PODE_EDIT.includes(cu.perfil);
  document.getElementById('blocoI').style.display = isB1 ? 'block' : 'none';
  document.getElementById('campoRelato').style.display = 'block'; // todos relatam
  document.getElementById('campoGestao').style.display = isGest() ? 'block' : 'none';
  document.getElementById('optUrg').style.display = isB1 ? '' : 'none';
  document.getElementById('tabRel').style.display = PODE_REL.includes(cu.perfil) ? '' : 'none';
  document.getElementById('tabAlunos').style.display = PODE_REL.includes(cu.perfil) ? '' : 'none';
  document.getElementById('tabSeg').style.display = (cu.perfil==='coordenador' && COORD_SEGMENTOS[cu.nome]) ? '' : 'none';
  document.getElementById('tabGes').style.display = ['diretor','vice'].includes(cu.perfil) ? '' : 'none';

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
  document.getElementById('gridAdm').innerHTML = TB0.map(t =>
    `<button class="tb2 ab2" onclick="window._selTipo('${t.n}',this,'administrativa')"><span class="tn" style="background:var(--bl)">${t.n}</span><span>${t.l}</span></button>`
  ).join('');
  document.getElementById('gridUrg').innerHTML = TU.map(t =>
    `<button class="tb2 ub2" onclick="window._selTipo('${t.n}',this,'urgencia')"><span class="tn">${t.n}</span><span>${t.l}</span></button>`
  ).join('');
  document.getElementById('gridGrav').innerHTML = TG.map(t =>
    `<button class="tb2 gb2" onclick="window._selTipo('${t.n}',this,'grave')"><span class="tn">${t.n}</span><span>${t.l}</span></button>`
  ).join('');
}
window._selTipo = (num, btn, nivel) => {
  const todos = [...TB0,...TU,...TG];
  const tipo = todos.find(t=>t.n===num);
  const label = tipo ? tipo.l : '';
  document.querySelectorAll('.tb2').forEach(b=>b.classList.remove('sel'));
  btn.classList.add('sel');
  sTipo = {num, label, nivel};
  document.getElementById('tipoLabel').textContent = 'Art. '+num+' — '+label;
  if(!PODE_EDIT.includes(cu.perfil) && nivel==='urgencia') nivel='grave';
  document.getElementById('occGrav').value = nivel==='urgencia'?'urgencia':'grave';
  if (nivel === 'administrativa') {
    document.getElementById('protBox').innerHTML = `<div class="pb" style="background:var(--bll);border-color:#90CAF9"><strong style="color:var(--bl)">Orientações — Ocorrência Administrativa/Pedagógica:</strong>
      <div class="ps"><span class="pn" style="background:var(--bl)">1</span><span>Registre a ocorrência com dados completos do aluno</span></div>
      <div class="ps"><span class="pn" style="background:var(--bl)">2</span><span>Comunique à coordenação pedagógica se houver reincidência</span></div>
      <div class="ps"><span class="pn" style="background:var(--bl)">3</span><span>Comunique à família quando necessário</span></div>
      <div class="ps"><span class="pn" style="background:var(--bl)">4</span><span>Aguarde orientação da equipe gestora pelo chat do sistema</span></div>
    </div>`;
    document.getElementById('protBox').style.display='block';
    document.getElementById('occGrav').value = 'leve';
    return;
  }
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
  const regNome = o.registradoPorNome || '—';
  const regPerfil = o.registradoPorPerfil || '';
  const nomes = o.alunos&&o.alunos.length ? o.alunos.map(a=>a.nome).join(', ') : '—';
  const pchip = regPerfil==='professor'?'background:#E8EAF6;color:#3949AB':regPerfil==='poc'?'background:var(--orl);color:var(--or)':'background:var(--mgl);color:var(--mg)';
  const naoLidos = chatNaoLidos[String(o.id)] || 0;
  const badgeChat = naoLidos > 0 ? `<span style="background:var(--re);color:#fff;border-radius:50%;width:16px;height:16px;font-size:9px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;margin-left:4px">${naoLidos}</span>` : '';
  const badgePlacon = o.placon === 'Sim'
    ? `<span class="bg" style="background:#E8F5E9;color:#2E7D32;font-size:10px">✅ Placon</span>`
    : o.placon === 'Pendente'
    ? `<span class="bg" style="background:#FFF3E0;color:#E65100;font-size:10px">⏳ Placon</span>`
    : o.status === 'encerrado'
    ? `<span class="bg" style="background:#FFEBEE;color:#C62828;font-size:10px">⚠ Placon</span>`
    : '';
  return `<div class="oc ${o.gravidade}">
    <div class="oh"><div style="flex:1;min-width:0">
      <div class="ot">Art. ${o.numero} — ${o.tipo}</div>
      <div class="om">${o.data} às ${o.hora} · ${o.local} · <strong>${o.turma}</strong></div>
      <div class="om">Aluno(s): ${nomes}</div>
      ${regNome?`<div class="om">Por: ${regNome} <span style="font-size:10px;padding:1px 6px;border-radius:10px;font-weight:500;${pchip}">${regPerfil.toUpperCase()}</span></div>`:''}
    </div>
    <div class="bs">
      <span class="bg bg-${o.gravidade}">${GL[o.gravidade]}</span>
      <span class="bg bg-${o.status}">${SL[o.status]||o.status}</span>
      ${badgePlacon}
    </div></div>
    <div class="oa">
      <button class="bn" onclick="window._verDet(${o.id})">Ver detalhes</button>
      ${isEdit()&&o.status==='pendente'?`<button class="bn mg" onclick="window._abrirComp(${o.id})">✏ Complementar</button>`:''}
      ${isEdit()?`<button class="bn or" onclick="window._abrirEdit(${o.id})">⬆ Editar</button>`:''}
      <button class="bn vd" onclick="window._abrirChat(${o.id})">💬 Chat${badgeChat}</button>
      ${isImprimir()?`<button class="bn bl" onclick="window._gerarDoc(${o.id})">📄 Gerar Documento</button>`:''}
    </div></div>`;
}

// ─── DASHBOARD ───────────────────────────────────────────────────────────────
function renderDash() {
  const ehProf = cu && cu.perfil === 'professor';
  // Professor só vê suas próprias ocorrências no dashboard
  const lista = occ.filter(o=>o&&o.gravidade&&(ehProf?(o.registradoPorId==cu.id||o.registradoPorNome===cu.nome):true));
  const total=lista.length, urg=lista.filter(o=>o.gravidade==='urgencia').length;
  const pend=lista.filter(o=>o.status==='pendente').length, enc=lista.filter(o=>o.status==='encerrado').length;
  document.getElementById('statsGrid').innerHTML=`
    <div class="sc re"><div class="sn">${urg}</div><div class="sl">Urgência</div></div>
    <div class="sc or"><div class="sn">${pend}</div><div class="sl">Aguard. complemento</div></div>
    <div class="sc mg"><div class="sn">${total}</div><div class="sl">Total</div></div>
    <div class="sc gr"><div class="sn">${enc}</div><div class="sl">Encerradas</div></div>`;
  const al=[];
  if(urg>0) al.push(`<div class="ab re" style="margin-bottom:8px">⚠ ${urg} ocorrência(s) de urgência/emergência.</div>`);
  if(pend>0&&isEdit()) al.push(`<div class="ab or" style="margin-bottom:8px">📋 ${pend} ocorrência(s) aguardando complemento.</div>`);
  document.getElementById('dashAlerts').innerHTML=al.join('');
  const rec = [...lista].sort((a,b)=>b.id-a.id).slice(0,5);
  document.getElementById('dashList').innerHTML = rec.length
    ? rec.map(cardHTML).join('')
    : '<div class="es">Nenhuma ocorrência registrada ainda.</div>';
}

window.renderOcc = function renderOcc() {
  const fN=document.getElementById('fNivel').value;
  const fT=document.getElementById('fTurma').value;
  const fG=document.getElementById('fGrav').value;
  const fS=document.getElementById('fStatus').value;
  // Professor só vê as próprias ocorrências; gestão vê todas
  const ehProf = cu && cu.perfil === 'professor';
  let lista=occ.filter(o=>o&&o.gravidade).sort((a,b)=>b.id-a.id);
  if(ehProf) lista=lista.filter(o=>o.registradoPorId==cu.id||o.registradoPorNome===cu.nome);
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

  const resp = await apiFetch('/api/ocorrencias', { method:'POST', body:JSON.stringify(payload) });
  if (!resp || !resp.ok) { alert('Erro ao registrar. Tente novamente.'); return; }
  // Não adiciona aqui — o WebSocket (evento nova_ocorrencia) cuida disso para todos
  _limparForm();
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
  const regNome2 = o.registradoPorNome || '—';
  const regPerfil2 = o.registradoPorPerfil || 'professor';
  const compNome = o.complementadoPorNome || null;
  const compPerfil = o.complementadoPorPerfil || null;
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
    <div class="ir"><span class="il">Registrado por</span><span>${regNome2}</span></div>
    ${o.relato?`<div style="margin-top:10px;background:#f9f9f9;border-radius:8px;padding:10px"><p style="font-size:12px;color:var(--mu);font-weight:500;margin-bottom:4px">Relato</p><p style="font-size:13px">${o.relato}</p></div>`:''}
    ${o.descricao?`<div style="margin-top:8px;background:var(--mgl);border-radius:8px;padding:10px"><p style="font-size:12px;color:var(--mg);font-weight:500;margin-bottom:4px">Descrição — ${compNome||'Coordenação'}</p><p style="font-size:13px">${o.descricao}</p>${o.providencias?`<p style="font-size:12px;color:var(--mu);font-weight:500;margin:6px 0 3px">Providências</p><p style="font-size:13px">${o.providencias}</p>`:''}</div>`:''}
    <div style="display:flex;gap:6px;margin-top:1rem;flex-wrap:wrap">
      ${isEdit()&&o.status==='pendente'?`<button class="bn mg" onclick="closeModal();window._abrirComp(${id})">✏ Complementar</button>`:''}
      ${isEdit()?`<button class="bn or" onclick="closeModal();window._abrirEdit(${id})">⬆ Editar</button>`:''}
      <button class="bn vd" onclick="closeModal();window._abrirChat(${id})">💬 Chat</button>
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
  await apiFetch('/api/ocorrencias/'+id+'/editar',{method:'PATCH',body:JSON.stringify(body)});
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
        <div class="fg"><label>B.O. registrado?</label><select id="cBO"><option value="">Selecione...</option><option${o.bo==='Sim'?' selected':''}>Sim</option><option${o.bo==='Não'?' selected':''}>Não</option><option${o.bo==='Não se aplica'?' selected':''}>Não se aplica</option></select></div>
        <div class="fg"><label>Família comunicada?</label><select id="cFam"><option value="">Selecione...</option><option${o.familia==='Sim'?' selected':''}>Sim</option><option${o.familia==='Não'?' selected':''}>Não</option><option${o.familia==='Não se aplica'?' selected':''}>Não se aplica</option></select></div>
        <div class="fg"><label>Conselho Tutelar?</label><select id="cConselhoTutelar"><option value="">Selecione...</option><option${o.conselhoTutelar==='Sim'?' selected':''}>Sim</option><option${o.conselhoTutelar==='Não'?' selected':''}>Não</option><option${o.conselhoTutelar==='Não se aplica'?' selected':''}>Não se aplica</option></select></div>
        <div class="fg"><label>Lançado no Placon?</label><select id="cPlacon"><option value="">Selecione...</option><option${o.placon==='Sim'?' selected':''}>Sim</option><option${o.placon==='Não'?' selected':''}>Não</option><option${o.placon==='Pendente'?' selected':''}>Pendente</option></select></div>
      </div>
      ${o.placon==='Sim'?'':`<div class="ab or" style="margin-top:8px;font-size:12px">📋 Lembrete: registrar esta ocorrência na <strong>Plataforma CONVIVA (Placon)</strong> após encerrar.</div>`}
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
  const _v = (id) => { const el = document.getElementById(id); return el ? el.value : ''; };
  const body={
    relatosAlunos,
    relatoResponsavel: _v('cRelResp'),
    descricao: d,
    providencias: _v('cProv'),
    bo: _v('cBO') || 'Não informado',
    familia: _v('cFam') || 'Não informado',
    conselhoTutelar: _v('cConselhoTutelar') || 'Não informado',
    placon: _v('cPlacon') || 'Não informado',
    complementadoPorId: cu.id,
  };
  const resp = await apiFetch('/api/ocorrencias/'+id+'/complementar',{method:'PATCH',body:JSON.stringify(body)});
  if (!resp) return; // token expirado — auth.js já fez reload
  if (!resp.ok) {
    const erro = await resp.json().catch(() => ({erro: 'Erro desconhecido'}));
    alert('Erro ao salvar: ' + (erro.erro || resp.status));
    return;
  }
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
  ['dashboard','registrar','ocorrencias','relatorio','alunos','segmento','gestao'].forEach(t => {
    document.getElementById('tab-'+t).style.display = t===name ? '' : 'none';
  });
  document.querySelectorAll('.nt button').forEach(b=>b.classList.remove('act'));
  if(btn) btn.classList.add('act');
  if(name==='ocorrencias') renderOcc();
  if(name==='gestao') { renderGestao(); if(['diretor','vice'].includes(cu?.perfil)) window._carregarAuditoria(); }
  if(name==='dashboard') renderDash();
  if(name==='alunos') { _initAbaAlunos(); window.renderAlunos(); }
  if(name==='segmento') window.renderSegmento();
};

let usuariosDB = []; // usuários carregados do banco

async function renderGestao() {
  // Carregar usuários do banco
  const resp = await apiFetch('/api/usuarios');
  if (!resp || !resp.ok) return;
  usuariosDB = await resp.json();

  const podeMgmt = ['diretor','vice'].includes(cu.perfil);
  const perfisOrdem = ['diretor','vice','coordenador','poc','professor'];

  // Agrupar por perfil
  const grupos = {};
  perfisOrdem.forEach(p => { grupos[p] = []; });
  usuariosDB.forEach(u => {
    if (grupos[u.perfil]) grupos[u.perfil].push(u);
    else grupos['professor'] = grupos['professor'] || [];
  });

  let html = '';

  // Botão adicionar usuário (só diretor e vice)
  if (podeMgmt) {
    html += `<div class="fc" style="margin-bottom:1rem">
      <div class="st" style="font-size:13px;margin-bottom:10px">➕ Adicionar Usuário</div>
      <div class="fr">
        <div class="fg"><label>Nome completo</label>
          <input type="text" id="novoNome" placeholder="Nome em maiúsculas..." style="text-transform:uppercase"/></div>
        <div class="fg"><label>Perfil / Cargo</label>
          <select id="novoPerfil">
            <option value="">Selecione...</option>
            <option value="professor">Professor</option>
            <option value="poc">P.O.C.</option>
            <option value="coordenador">Coordenador</option>
            <option value="vice">Vice-Diretor</option>
            <option value="diretor">Diretor</option>
          </select></div>
      </div>
      <button class="bn mg" onclick="window._adicionarUsuario()">➕ Adicionar</button>
      <div id="msgNovoUsuario" style="display:none;margin-top:8px;font-size:13px"></div>
    </div>`;
  }

  // Lista por perfil
  perfisOrdem.forEach(p => {
    const lista = usuariosDB.filter(u => u.perfil === p);
    if (!lista.length) return;
    html += `<div class="fl" style="margin-bottom:8px">${PL[p]}</div>`;
    html += lista.map(u => {
      const inativo = !u.ativo;
      return `<div class="oc leve" style="border-left-color:${inativo?'#ccc':'var(--mg)'};opacity:${inativo?'.5':'1'}">
        <div class="oh">
          <div style="flex:1">
            <div class="ot" style="${inativo?'color:#999':''}">
              ${u.nome}
              ${inativo?'<span style="font-size:10px;background:#eee;color:#999;border-radius:3px;padding:1px 6px;margin-left:4px">Inativo</span>':''}
            </div>
            <div class="om">${PL[u.perfil]}</div>
          </div>
          ${podeMgmt ? `<div class="bs" style="flex-wrap:wrap;gap:4px;justify-content:flex-end">
            <button class="bn" style="font-size:11px;padding:3px 8px" onclick="window._editarPerfil(${u.id},'${u.nome}','${u.perfil}')">✏ Cargo</button>
            <button class="bn" style="font-size:11px;padding:3px 8px" onclick="window._resetSenha(${u.id},'${u.nome}')">🔑 Senha</button>
            <button class="bn" style="font-size:11px;padding:3px 8px;color:${inativo?'var(--gr)':'var(--re)'}"
              onclick="window._toggleUsuario(${u.id},'${u.nome}',${u.ativo})">
              ${inativo?'✅ Ativar':'🚫 Desativar'}
            </button>
          </div>` : ''}
        </div>
      </div>`;
    }).join('');
  });

  document.getElementById('gestaoList').innerHTML = html;

  // Exibe seção de auditoria só para diretor/vice
  const audSec = document.getElementById('auditoriaSection');
  if (audSec) audSec.style.display = ['diretor','vice'].includes(cu.perfil) ? '' : 'none';
}

// ─── AUDITORIA ────────────────────────────────────────────────────────────────
const _ACAO_LABEL = {
  login:                  { icon: '🔑', label: 'Login' },
  trocar_senha:           { icon: '🔒', label: 'Trocou a própria senha' },
  nova_ocorrencia:        { icon: '📝', label: 'Registrou ocorrência' },
  complementar_ocorrencia:{ icon: '✅', label: 'Complementou ocorrência' },
  editar_ocorrencia:      { icon: '✏️', label: 'Editou ocorrência' },
  criar_usuario:          { icon: '👤', label: 'Criou usuário' },
  alterar_perfil:         { icon: '🔄', label: 'Alterou perfil de usuário' },
  resetar_senha:          { icon: '🔑', label: 'Resetou senha de usuário' },
  ativar_usuario:         { icon: '✅', label: 'Ativou usuário' },
  desativar_usuario:      { icon: '🚫', label: 'Desativou usuário' },
  exportar_backup:        { icon: '💾', label: 'Exportou backup' },
  resetar_ocorrencias:    { icon: '🗑', label: 'Apagou todas as ocorrências' },
};

window._carregarAuditoria = async () => {
  const el = document.getElementById('auditoriaList');
  el.innerHTML = '<p style="font-size:13px;color:var(--mu);text-align:center;padding:1rem">Carregando...</p>';
  const resp = await apiFetch('/api/auditoria?limite=200');
  if (!resp || !resp.ok) {
    el.innerHTML = '<p style="font-size:13px;color:var(--re);text-align:center;padding:1rem">Erro ao carregar logs.</p>';
    return;
  }
  const logs = await resp.json();
  if (!logs.length) {
    el.innerHTML = '<p style="font-size:13px;color:var(--mu);text-align:center;padding:1rem">Nenhum registro encontrado.</p>';
    return;
  }
  el.innerHTML = logs.map(l => {
    const { icon, label } = _ACAO_LABEL[l.acao] || { icon: '•', label: l.acao };
    let detalhe = '';
    if (l.detalhes) {
      const d = l.detalhes;
      if (d.occId)         detalhe += ` · Ocorrência #${d.occId}`;
      if (d.tipo)          detalhe += ` · ${d.tipo}`;
      if (d.turma)         detalhe += ` · ${d.turma}`;
      if (d.novoUsuario)   detalhe += ` · ${d.novoUsuario} (${d.perfil||''})`;
      if (d.usuarioAlvo)   detalhe += ` · ${d.usuarioAlvo}`;
      if (d.perfilNovo)    detalhe += ` → ${PL[d.perfilNovo]||d.perfilNovo}`;
      if (d.formato)       detalhe += ` (${d.formato.toUpperCase()})`;
      if (d.totalApagadas !== undefined) detalhe += ` · ${d.totalApagadas} registros`;
      if (d.ip)            detalhe += ` · IP: ${d.ip}`;
    }
    return `<div style="display:flex;align-items:flex-start;gap:10px;padding:8px 0;border-bottom:1px solid var(--bd)">
      <span style="font-size:16px;line-height:1.4">${icon}</span>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:600;color:var(--tx)">${label}<span style="font-weight:400;color:var(--mu)">${detalhe}</span></div>
        <div style="font-size:12px;color:var(--mu);margin-top:2px">${l.usuario_nome || '—'} · ${l.criado_em}</div>
      </div>
    </div>`;
  }).join('');
};

window._adicionarUsuario = async () => {
  const nome = document.getElementById('novoNome').value.trim().toUpperCase();
  const perfil = document.getElementById('novoPerfil').value;
  const msg = document.getElementById('msgNovoUsuario');
  if (!nome || !perfil) {
    msg.textContent = '⚠ Preencha nome e perfil.';
    msg.style.color = 'var(--re)'; msg.style.display = 'block'; return;
  }
  const resp = await apiFetch('/api/usuarios', { method:'POST', body:JSON.stringify({ nome, perfil }) });
  const data = await resp.json();
  if (!resp.ok) {
    msg.textContent = '⚠ ' + data.erro;
    msg.style.color = 'var(--re)'; msg.style.display = 'block'; return;
  }
  msg.textContent = `✅ Usuário criado! Senha padrão: Malba@2025`;
  msg.style.color = 'var(--gr)'; msg.style.display = 'block';
  document.getElementById('novoNome').value = '';
  document.getElementById('novoPerfil').value = '';
  renderGestao();
};

window._editarPerfil = (id, nome, perfilAtual) => {
  document.getElementById('modalTit').textContent = '✏ Alterar Cargo — ' + nome.split(' ')[0];
  document.getElementById('modalBody').innerHTML = `
    <div class="ab bl" style="margin-bottom:1rem">Cargo atual: <strong>${PL[perfilAtual]}</strong></div>
    <div class="fg"><label>Novo cargo</label>
      <select id="novoCargoSel">
        ${['professor','poc','coordenador','vice','diretor'].map(p =>
          `<option value="${p}"${p===perfilAtual?' selected':''}>${PL[p]}</option>`
        ).join('')}
      </select></div>
    <div style="display:flex;gap:8px;margin-top:1rem">
      <button class="bp" style="flex:1" onclick="window._salvarPerfil(${id})">Salvar</button>
      <button class="bn" style="flex:1;padding:10px" onclick="closeModal()">Cancelar</button>
    </div>`;
  document.getElementById('modalOv').classList.add('show');
};

window._salvarPerfil = async (id) => {
  const perfil = document.getElementById('novoCargoSel').value;
  const btn = document.querySelector('#modalBody .bp');
  if (btn) { btn.textContent = 'Salvando...'; btn.disabled = true; }
  const resp = await apiFetch('/api/usuarios/'+id+'/perfil', { method:'PATCH', body:JSON.stringify({ perfil }) });
  if (!resp) { if (btn) { btn.textContent = 'Salvar'; btn.disabled = false; } return; }
  const data = await resp.json();
  if (!resp.ok) {
    if (btn) { btn.textContent = 'Salvar'; btn.disabled = false; }
    alert('Erro ao salvar cargo: ' + data.erro);
    return;
  }
  closeModal();
  await renderGestao();
  alert('✅ Cargo alterado para ' + (PL[perfil]||perfil) + '.\nO usuário precisará fazer login novamente.');
};

window._resetSenha = async (id, nome) => {
  if (!confirm('Redefinir senha de ' + nome + ' para Malba@2025?')) return;
  const resp = await apiFetch('/api/usuarios/'+id+'/resetar-senha', { method:'POST' });
  const data = await resp.json();
  if (!resp.ok) { alert('Erro ao redefinir senha.'); return; }
  alert('✅ Senha redefinida para: Malba@2025');
};

window._toggleUsuario = async (id, nome, ativo) => {
  const acao = ativo ? 'desativar' : 'ativar';
  if (!confirm(`Deseja ${acao} o usuário ${nome}?`)) return;
  const resp = await apiFetch('/api/usuarios/'+id+'/toggle', { method:'POST', body:JSON.stringify({ ativo: !ativo }) });
  const data = await resp.json();
  if (!resp.ok) { alert('Erro: ' + data.erro); return; }
  renderGestao();
};

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
  const regNome2 = o.registradoPorNome || '—';
  const regPerfil2 = o.registradoPorPerfil || 'professor';
  const compNome = o.complementadoPorNome || null;
  const compPerfil = o.complementadoPorPerfil || null;
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
      <div class="campo"><label>Por: ${regNome2} (${PL[regPerfil2]||regPerfil2}) · ${o.data} às ${o.hora}</label></div>
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
      <div class="campo"><label>Por: ${compNome||(o.dataComp?'Equipe Gestora':'—')} ${compNome?'('+( PL[compPerfil]||compPerfil)+')':''} · Em: ${o.dataComp||'—'}</label></div>
      <div class="campo"><label>Descrição detalhada</label></div>
      ${o.descricao?`<div class="caixa-texto" style="min-height:60px">${o.descricao}</div>`:`<div class="caixa-vazia" style="min-height:60px"></div>`}
      <div class="campo" style="margin-top:6px"><label>Providências tomadas</label></div>
      ${o.providencias?`<div class="caixa-texto" style="min-height:40px">${o.providencias}</div>`:`<div class="caixa-vazia" style="min-height:40px"></div>`}
      <div class="campo-grid-3" style="margin-top:6px">
        <div class="campo"><label>B.O.</label><div class="valor">${o.bo&&o.bo!=='Não informado'?o.bo:'☐ Sim  ☐ Não  ☐ N/A'}</div></div>
        <div class="campo"><label>Família</label><div class="valor">${o.familia&&o.familia!=='Não informado'?o.familia:'☐ Sim  ☐ Não  ☐ N/A'}</div></div>
        <div class="campo"><label>Conselho Tutelar</label><div class="valor">${o.conselhoTutelar&&o.conselhoTutelar!=='Não informado'?o.conselhoTutelar:'☐ Sim  ☐ Não  ☐ N/A'}</div></div>
        <div class="campo"><label>Lançado no Placon</label><div class="valor" style="${o.placon==='Sim'?'color:#2E7D32;font-weight:bold':o.placon==='Pendente'?'color:#E65100':''}">${o.placon&&o.placon!=='Não informado'?o.placon:'☐ Sim  ☐ Não  ☐ Pendente'}</div></div>
      </div>
    </div>
    <div class="secao"><div class="secao-titulo">6. Providências — Protocolo 179 · CONVIVA SP</div>
      <ul class="protocolo-lista">${passos.map((p,i)=>`<li><span class="step-n">${i+1}</span><span>${p}</span></li>`).join('')}</ul>
    </div>
    <div class="secao"><div class="secao-titulo">7. Assinaturas</div>
      <div class="assinaturas-grid">
        ${(()=>{
          const jaAssinou = new Set();
          const caixa = (nome, cargo, rodape) => {
            const r = rodape || 'CPF: ___.___.___-__ · Data: ____/____/________';
            if (nome) {
              if (jaAssinou.has(nome)) return '';
              jaAssinou.add(nome);
              return '<div class="assinatura-box"><div class="assinatura-linha"></div><div class="assinatura-nome">'+nome+'</div><div class="assinatura-cargo">'+cargo+'</div><div class="assinatura-cpf">'+r+'</div></div>';
            }
            return '<div class="assinatura-box"><div class="assinatura-linha"></div><div class="assinatura-nome">'+cargo+'</div><div class="assinatura-cargo">Nome: ____________________________________________</div><div class="assinatura-cpf">'+r+'</div></div>';
          };
          let h = '';
          h += caixa(regNome2, PL[regPerfil2]||regPerfil2||'Professor(a)');
          if(o.alunos&&o.alunos.length){o.alunos.forEach(a=>{h+='<div class="assinatura-box"><div class="assinatura-linha"></div><div class="assinatura-nome">'+a.nome+'</div><div class="assinatura-cargo">Estudante · RA: '+(a.ra||'—')+'</div><div class="assinatura-cpf">Data: ____/____/________</div></div>';});}
          h += caixa(null,'Responsável pelo(a) Estudante');
          if(regPerfil2!=='poc') h += caixa(null,'P.O.C. — Prof. Orientador de Convivência');
          if(compNome) h += caixa(compNome, PL[compPerfil]||compPerfil||'Equipe Gestora');
          else h += caixa(null,'Coordenador(a) Pedagógico(a)');
          if(!compPerfil||!['vice','diretor'].includes(compPerfil)) h += caixa(null,'Diretor(a) / Vice-Diretor(a)');
          h += caixa(null,'Testemunha');
          return h;
        })()}
      </div>
    </div>div>
    <div class="aviso-legal">Este documento possui valor legal e deve ser arquivado na UE, conforme Res. SE nº 19/2010 e Protocolo 179 CONVIVA SP. Falsificação: Art. 299 CP.</div>
    <div class="rodape">
      <div>EE Professora Malba Thereza Ferraz Campaner · Protocolo 179 · CONVIVA SP · SEDUC SP · ${numF}</div>
      <div style="text-align:right">Emitido em: ${hoje}</div>
    </div>
  </div></body></html>`;
}

// ─── ABA ALUNOS ──────────────────────────────────────────────────────────────

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
               'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const LIMITE_ALERTA = 3; // ocorrências no mês para acionar alerta

function _initAbaAlunos() {
  // Popular select de mês se ainda não foi
  const sel = document.getElementById('aMes');
  if (sel.options.length > 1) return;
  const hoje = new Date();
  // Últimos 12 meses
  for (let i = 0; i < 12; i++) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    const val = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const opt = document.createElement('option');
    opt.value = val;
    opt.textContent = `${MESES[d.getMonth()]} ${d.getFullYear()}`;
    if (i === 0) opt.selected = true;
    sel.appendChild(opt);
  }
  // Popular select de turma
  const st = document.getElementById('aTurma');
  if (st.options.length > 1) return;
  _ordTurmas(Object.keys(TD)).forEach(t => {
    const o = document.createElement('option');
    o.value = t; o.textContent = t;
    st.appendChild(o);
  });
}

window.renderAlunos = function() {
  const mes = document.getElementById('aMes')?.value || '';
  const turmaFiltro = document.getElementById('aTurma')?.value || '';
  const [ano, mesNum] = mes.split('-').map(Number);

  // Filtrar ocorrências pelo mês/ano selecionado
  let lista = occ.filter(o => {
    if (!o || !o.data) return false;
    // data formato dd/mm/yyyy ou yyyy-mm-dd
    let d;
    if (o.data.includes('/')) {
      const [dd,mm,yyyy] = o.data.split('/');
      d = new Date(parseInt(yyyy), parseInt(mm)-1, parseInt(dd));
    } else {
      d = new Date(o.data);
    }
    return d.getFullYear() === ano && (d.getMonth()+1) === mesNum;
  });

  if (turmaFiltro) lista = lista.filter(o => o.turma === turmaFiltro);

  // Montar mapa aluno → ocorrências
  const mapaAluno = {}; // ra → {nome, ra, turma, ocorrencias:[]}
  lista.forEach(o => {
    if (!o.alunos || !o.alunos.length) return;
    o.alunos.forEach(a => {
      const chave = a.ra || a.nome;
      if (!mapaAluno[chave]) mapaAluno[chave] = { nome:a.nome, ra:a.ra||'—', turma:o.turma, ocorrencias:[] };
      mapaAluno[chave].ocorrencias.push(o);
    });
  });

  const alunos = Object.values(mapaAluno).sort((a,b) => b.ocorrencias.length - a.ocorrencias.length);
  const emAlerta = alunos.filter(a => a.ocorrencias.length >= LIMITE_ALERTA);

  // ── STATS ──
  const totalOcc = lista.length;
  const totalAlunos = alunos.length;
  const totalAlerta = emAlerta.length;
  const encerradas = lista.filter(o => o.status === 'encerrado').length;
  document.getElementById('aStats').innerHTML = `
    <div class="sc mg"><div class="sn">${totalOcc}</div><div class="sl">Ocorrências no mês</div></div>
    <div class="sc or"><div class="sn">${totalAlunos}</div><div class="sl">Alunos envolvidos</div></div>
    <div class="sc re"><div class="sn">${totalAlerta}</div><div class="sl">Em alerta (${LIMITE_ALERTA}+)</div></div>
    <div class="sc gr"><div class="sn">${encerradas}</div><div class="sl">Encerradas</div></div>`;

  // ── ALERTAS ──
  const alertaEl = document.getElementById('aAlerta');
  if (emAlerta.length) {
    alertaEl.innerHTML = `
      <div class="ab re" style="flex-direction:column;align-items:stretch;gap:8px">
        <strong style="font-size:13px">🚨 ${emAlerta.length} aluno(s) com ${LIMITE_ALERTA}+ ocorrências em ${MESES[mesNum-1]} — Requer intervenção!</strong>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:4px">
          ${emAlerta.map(a => `
            <div onclick="window._verHistoricoAluno('${_esc(a.ra)}','${_esc(a.nome)}')"
              style="background:#fff;border:1.5px solid var(--re);border-radius:8px;padding:6px 12px;cursor:pointer;display:flex;align-items:center;gap:8px">
              <span style="background:var(--re);color:#fff;border-radius:50%;width:22px;height:22px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0">${a.ocorrencias.length}</span>
              <div><div style="font-size:12px;font-weight:600;color:var(--re)">${a.nome}</div>
              <div style="font-size:10px;color:var(--mu)">${a.turma} · RA: ${a.ra}</div></div>
            </div>`).join('')}
        </div>
      </div>`;
  } else {
    alertaEl.innerHTML = `<div class="ab gr" style="margin-bottom:0">✅ Nenhum aluno com ${LIMITE_ALERTA}+ ocorrências em ${MESES[mesNum-1]}.</div>`;
  }

  // ── GRÁFICO POR TURMA ──
  const mapaTurma = {};
  lista.forEach(o => {
    if (!o.turma) return;
    if (!mapaTurma[o.turma]) mapaTurma[o.turma] = { total:0, urgencia:0, grave:0, media:0, leve:0, administrativa:0 };
    mapaTurma[o.turma].total++;
    mapaTurma[o.turma][o.gravidade] = (mapaTurma[o.turma][o.gravidade]||0)+1;
  });
  const turmasOrd = _ordTurmas(Object.keys(mapaTurma));
  const maxVal = Math.max(...turmasOrd.map(t => mapaTurma[t].total), 1);
  const cores = {urgencia:'var(--re)',grave:'var(--or)',media:'var(--go)',leve:'var(--gr)',administrativa:'var(--bl)'};
  document.getElementById('aGrafico').innerHTML = turmasOrd.length
    ? `<div style="display:flex;flex-direction:column;gap:6px;min-width:300px">
        ${turmasOrd.map(t => {
          const d = mapaTurma[t];
          const pct = Math.round((d.total/maxVal)*100);
          const segmentos = ['urgencia','grave','media','leve','administrativa']
            .filter(g => d[g])
            .map(g => `<div title="${GL[g]}: ${d[g]}" style="width:${Math.round((d[g]/d.total)*pct)}%;background:${cores[g]};height:100%;min-width:2px"></div>`)
            .join('');
          return `<div style="display:flex;align-items:center;gap:8px">
            <div style="width:70px;font-size:11px;text-align:right;color:var(--mu);flex-shrink:0">${t}</div>
            <div style="flex:1;background:#f0f0f0;border-radius:4px;height:18px;overflow:hidden;display:flex">${segmentos}</div>
            <div style="width:24px;font-size:12px;font-weight:500;color:var(--mg);text-align:right">${d.total}</div>
          </div>`;
        }).join('')}
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:6px;font-size:10px">
          ${Object.entries(cores).map(([g,c])=>`<span style="display:flex;align-items:center;gap:3px"><span style="width:10px;height:10px;background:${c};border-radius:2px;display:inline-block"></span>${GL[g]||g}</span>`).join('')}
        </div>
      </div>`
    : '<div class="es">Nenhuma ocorrência no período.</div>';

  // ── RANKING ──
  document.getElementById('aRanking').innerHTML = alunos.length
    ? `<div style="display:flex;flex-direction:column;gap:6px">
        ${alunos.slice(0,20).map((a,i) => {
          const alerta = a.ocorrencias.length >= LIMITE_ALERTA;
          const cor = alerta ? 'var(--re)' : a.ocorrencias.length >= 2 ? 'var(--or)' : 'var(--mu)';
          const bg = alerta ? 'var(--rel)' : '#fff';
          return `<div onclick="window._verHistoricoAluno('${_esc(a.ra)}','${_esc(a.nome)}')"
            style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:${bg};border:0.5px solid ${alerta?'#FFCDD2':'var(--bd)'};border-radius:8px;cursor:pointer;transition:.15s"
            onmouseover="this.style.borderColor='var(--mg)'" onmouseout="this.style.borderColor='${alerta?'#FFCDD2':'var(--bd)'}'">
            <span style="font-size:11px;font-weight:700;color:${cor};min-width:20px;text-align:center">${i+1}º</span>
            <div style="flex:1;min-width:0">
              <div style="font-size:13px;font-weight:500;color:${alerta?'var(--re)':'#222'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${a.nome}${alerta?' 🚨':''}</div>
              <div style="font-size:11px;color:var(--mu)">${a.turma} · RA: ${a.ra}</div>
            </div>
            <div style="text-align:right;flex-shrink:0">
              <div style="font-size:18px;font-weight:700;color:${cor}">${a.ocorrencias.length}</div>
              <div style="font-size:10px;color:var(--mu)">ocorr.</div>
            </div>
          </div>`;
        }).join('')}
      </div>`
    : '<div class="es">Nenhum aluno envolvido no período.</div>';
};

window._verHistoricoAluno = function(ra, nome) {
  // Busca todas as ocorrências do aluno (sem filtro de mês)
  const hist = occ.filter(o => o && o.alunos && o.alunos.some(a => (a.ra||a.nome) === ra || a.nome === nome))
    .sort((a,b) => b.id - a.id);

  const total = hist.length;
  const porGrav = {};
  hist.forEach(o => { porGrav[o.gravidade] = (porGrav[o.gravidade]||0)+1; });

  document.getElementById('modalAlunoTit').textContent = `👤 ${nome}`;
  document.getElementById('modalAlunoBody').innerHTML = `
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:1rem">
      <span class="bg" style="background:var(--mgl);color:var(--mg);font-size:12px;padding:4px 10px">RA: ${ra}</span>
      <span class="bg" style="background:var(--mgl);color:var(--mg);font-size:12px;padding:4px 10px">${total} ocorrência(s) no total</span>
      ${Object.entries(porGrav).map(([g,n])=>`<span class="bg bg-${g}" style="font-size:11px;padding:3px 8px">${GL[g]||g}: ${n}</span>`).join('')}
    </div>
    ${hist.length ? hist.map(o => `
      <div class="oc ${o.gravidade}" style="margin-bottom:6px">
        <div class="oh">
          <div>
            <div class="ot">Art. ${o.numero} — ${o.tipo}</div>
            <div class="om">${o.data} às ${o.hora} · ${o.turma}</div>
            <div class="om">Por: ${o.registradoPorNome||'—'}</div>
          </div>
          <div class="bs">
            <span class="bg bg-${o.gravidade}">${GL[o.gravidade]||o.gravidade}</span>
            <span class="bg bg-${o.status}">${o.status==='encerrado'?'Encerrado':'Pendente'}</span>
          </div>
        </div>
        ${o.relato?`<div style="margin-top:6px;font-size:12px;color:var(--mu);padding:6px 8px;background:#f9f9f9;border-radius:6px">${o.relato}</div>`:''}
      </div>`).join('')
    : '<div class="es">Nenhuma ocorrência encontrada.</div>'}`;

  document.getElementById('modalAluno').classList.add('show');
};

window.fecharModalAluno = () => document.getElementById('modalAluno').classList.remove('show');

function _esc(str) { return String(str||'').replace(/'/g,"\'"); }

// ─── BACKUP ──────────────────────────────────────────────────────────────────

window._baixarBackup = async () => {
  const resp = await apiFetch('/api/backup/json');
  if (!resp || !resp.ok) { alert('Erro ao gerar backup.'); return; }
  const data = await resp.json();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  _dispararDownload(blob, `ocorrencias_backup_${_dataHoje()}.json`);
  document.getElementById('backupMsg').textContent = `✅ Backup gerado com ${data.ocorrencias.length} ocorrência(s).`;
  document.getElementById('backupMsg').style.display = 'block';
};

window._baixarBackupCSV = async () => {
  const resp = await apiFetch('/api/backup/csv');
  if (!resp || !resp.ok) { alert('Erro ao gerar backup CSV.'); return; }
  const texto = await resp.text();
  const blob = new Blob(['﻿' + texto], { type: 'text/csv;charset=utf-8' });
  _dispararDownload(blob, `ocorrencias_backup_${_dataHoje()}.csv`);
  document.getElementById('backupMsg').textContent = '✅ Backup CSV gerado com sucesso.';
  document.getElementById('backupMsg').style.display = 'block';
};

function _dispararDownload(blob, nomeArquivo) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nomeArquivo;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function _dataHoje() {
  return new Date().toISOString().slice(0,10).replace(/-/g,'');
}

// ─── DASHBOARD DO SEGMENTO (Coordenadores) ───────────────────────────────────

window.renderSegmento = function() {
  const seg = COORD_SEGMENTOS[cu.nome];
  if (!seg) return;

  const periodoSel = document.getElementById('segPeriodo')?.value || 'mes';
  const tipoFiltro = document.getElementById('segTipo')?.value || '';
  const hoje = new Date();

  // Calcular intervalo de datas
  let dataInicio;
  if (periodoSel === 'semana') {
    dataInicio = new Date(hoje); dataInicio.setDate(hoje.getDate() - 7);
  } else if (periodoSel === 'mes') {
    dataInicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  } else if (periodoSel === 'bimestre') {
    const bim = Math.floor(hoje.getMonth() / 2);
    dataInicio = new Date(hoje.getFullYear(), bim * 2, 1);
  } else { // ano
    dataInicio = new Date(hoje.getFullYear(), 0, 1);
  }

  // Filtrar ocorrências do segmento
  let lista = occ.filter(o => {
    if (!o || !o.turma || !o.data) return false;
    if (!seg.turmas.includes(o.turma)) return false;
    let d;
    if (o.data.includes('/')) {
      const [dd,mm,yyyy] = o.data.split('/');
      d = new Date(parseInt(yyyy), parseInt(mm)-1, parseInt(dd));
    } else { d = new Date(o.data); }
    return d >= dataInicio && d <= hoje;
  });

  if (tipoFiltro) lista = lista.filter(o => o.tipo === tipoFiltro);

  // Stats gerais
  const total = lista.length;
  const pend  = lista.filter(o => o.status === 'pendente').length;
  const enc   = lista.filter(o => o.status === 'encerrado').length;

  // Mapa alunos
  const mapaAluno = {};
  lista.forEach(o => {
    (o.alunos||[]).forEach(a => {
      const k = a.ra||a.nome;
      if (!mapaAluno[k]) mapaAluno[k] = { nome:a.nome, ra:a.ra||'—', turma:o.turma, occ:[] };
      mapaAluno[k].occ.push(o);
    });
  });
  const alunosAlerta = Object.values(mapaAluno)
    .filter(a => a.occ.length >= 3)
    .sort((a,b) => b.occ.length - a.occ.length);

  // Mapa tipos
  const mapaTipo = {};
  lista.forEach(o => { mapaTipo[o.tipo] = (mapaTipo[o.tipo]||0)+1; });
  const topTipos = Object.entries(mapaTipo).sort((a,b)=>b[1]-a[1]);

  // Mapa turmas
  const mapaTurma = {};
  lista.forEach(o => { mapaTurma[o.turma] = (mapaTurma[o.turma]||0)+1; });
  const topTurmas = Object.entries(mapaTurma).sort((a,b)=>b[1]-a[1]);
  const maxT = topTurmas[0]?.[1] || 1;

  // Labels período
  const PER = {semana:'últimos 7 dias', mes:'este mês', bimestre:'este bimestre', ano:'este ano'};

  // Tipos únicos para filtro
  const tiposUnicos = [...new Set(occ.filter(o=>o&&seg.turmas.includes(o.turma)).map(o=>o.tipo))].sort();

  const el = document.getElementById('tab-segmento');
  if (!el) return;

  el.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;flex-wrap:wrap;gap:8px">
      <div>
        <div class="st" style="margin:0;border:none;padding:0">📊 Meu Segmento — ${seg.periodo}</div>
        <div style="font-size:12px;color:var(--mu);margin-top:2px">${seg.desc}</div>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <select id="segPeriodo" onchange="window.renderSegmento()" style="font-size:12px;padding:4px 8px;border:0.5px solid #ccc;border-radius:8px;background:#fff">
          <option value="semana"${periodoSel==='semana'?' selected':''}>Última semana</option>
          <option value="mes"${periodoSel==='mes'?' selected':''}>Este mês</option>
          <option value="bimestre"${periodoSel==='bimestre'?' selected':''}>Este bimestre</option>
          <option value="ano"${periodoSel==='ano'?' selected':''}>Este ano</option>
        </select>
        <select id="segTipo" onchange="window.renderSegmento()" style="font-size:12px;padding:4px 8px;border:0.5px solid #ccc;border-radius:8px;background:#fff">
          <option value="">Todos os tipos</option>
          ${tiposUnicos.map(t=>`<option value="${t}"${t===tipoFiltro?' selected':''}>${t}</option>`).join('')}
        </select>
      </div>
    </div>

    <!-- STATS -->
    <div class="sg" style="margin-bottom:1rem">
      <div class="sc mg"><div class="sn">${total}</div><div class="sl">Ocorrências (${PER[periodoSel]})</div></div>
      <div class="sc re"><div class="sn">${alunosAlerta.length}</div><div class="sl">Alunos em alerta (3+)</div></div>
      <div class="sc or"><div class="sn">${pend}</div><div class="sl">Aguard. complemento</div></div>
      <div class="sc gr"><div class="sn">${enc}</div><div class="sl">Encerradas</div></div>
    </div>

    <!-- ALUNOS EM ALERTA -->
    ${alunosAlerta.length ? `
    <div class="fc" style="margin-bottom:1rem">
      <div class="st" style="font-size:13px;margin-bottom:10px">🚨 Alunos em Alerta — 3+ ocorrências no período</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px">
        ${alunosAlerta.map(a=>`
          <div onclick="window._verHistoricoAluno('${a.ra}','${a.nome}')"
            style="background:var(--rel);border:1.5px solid var(--re);border-radius:8px;padding:8px 12px;cursor:pointer;min-width:200px;flex:1">
            <div style="display:flex;align-items:center;gap:8px">
              <span style="background:var(--re);color:#fff;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0">${a.occ.length}</span>
              <div>
                <div style="font-size:13px;font-weight:600;color:var(--re)">${a.nome}</div>
                <div style="font-size:11px;color:var(--mu)">${a.turma} · RA: ${a.ra}</div>
              </div>
            </div>
          </div>`).join('')}
      </div>
    </div>` : `<div class="ab gr" style="margin-bottom:1rem">✅ Nenhum aluno com 3+ ocorrências no período.</div>`}

    <!-- TIPOS MAIS FREQUENTES + INTERVENÇÕES -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1rem">
      <div class="fc">
        <div class="st" style="font-size:13px;margin-bottom:10px">📈 Tipos mais frequentes</div>
        ${topTipos.length ? topTipos.slice(0,8).map(([tipo,n])=>{
          const pct = Math.round((n/total)*100);
          return `<div style="margin-bottom:8px">
            <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px">
              <span style="max-width:75%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${tipo}</span>
              <strong>${n} (${pct}%)</strong>
            </div>
            <div style="background:#f0f0f0;border-radius:4px;height:8px">
              <div style="background:var(--mg);width:${pct}%;height:100%;border-radius:4px"></div>
            </div>
          </div>`;
        }).join('') : '<div class="es">Nenhuma ocorrência no período.</div>'}
      </div>

      <div class="fc">
        <div class="st" style="font-size:13px;margin-bottom:10px">💡 Sugestões de Intervenção</div>
        ${topTipos.slice(0,3).map(([tipo])=>{
          const sugs = INTERVENCOES[tipo];
          if (!sugs) return '';
          return `<div style="margin-bottom:10px">
            <div style="font-size:12px;font-weight:600;color:var(--mg);margin-bottom:4px">${tipo}</div>
            <ul style="list-style:none;padding:0">
              ${sugs.map(s=>`<li style="font-size:12px;padding:2px 0;display:flex;gap:6px">
                <span style="color:var(--mg);flex-shrink:0">→</span><span>${s}</span>
              </li>`).join('')}
            </ul>
          </div>`;
        }).join('') || '<div class="es">Selecione um período com ocorrências.</div>'}
      </div>
    </div>

    <!-- RANKING DE TURMAS -->
    <div class="fc">
      <div class="st" style="font-size:13px;margin-bottom:10px">🏫 Ranking de Turmas</div>
      ${topTurmas.length ? `<div style="display:flex;flex-direction:column;gap:6px">
        ${topTurmas.map(([turma,n],i)=>`
          <div style="display:flex;align-items:center;gap:10px">
            <span style="font-size:11px;font-weight:700;color:${i===0?'var(--re)':i===1?'var(--or)':'var(--mu)'};min-width:20px;text-align:center">${i+1}º</span>
            <span style="width:90px;font-size:12px;flex-shrink:0">${turma}</span>
            <div style="flex:1;background:#f0f0f0;border-radius:4px;height:14px;overflow:hidden">
              <div style="background:${i===0?'var(--re)':i===1?'var(--or)':'var(--mg)'};width:${Math.round((n/maxT)*100)}%;height:100%;border-radius:4px"></div>
            </div>
            <span style="font-size:13px;font-weight:700;color:var(--mg);min-width:20px;text-align:right">${n}</span>
          </div>`).join('')}
      </div>` : '<div class="es">Nenhuma ocorrência no período.</div>'}
    </div>`;
};

// ─── RESET ───────────────────────────────────────────────────────────────────

window._confirmarReset = async () => {
  const conf = prompt('Digite CONFIRMAR para apagar todas as ocorrências:');
  if (conf !== 'CONFIRMAR') { alert('Operação cancelada.'); return; }
  const resp = await apiFetch('/api/admin/resetar-ocorrencias', { method: 'POST' });
  if (!resp || !resp.ok) { alert('Erro ao apagar. Tente novamente.'); return; }
  occ = []; chats = {};
  renderDash(); renderOcc();
  alert('✅ Todas as ocorrências foram apagadas.');
};

// ─── BOOTSTRAP ────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await init();
  _montarTurmasSelectReal();
  _montarGridTiposReal();

  // Auto-login se tiver sessão salva
  if (temSessao()) {
    const usuario = getUsuario();
    if (usuario) await _autenticar(usuario);
  }
});
