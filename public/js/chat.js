// chat.js — componente de chat entre usuários

import { enviar } from './ws.js';

const PL = {
  professor:'Professor', poc:'P.O.C.',
  coordenador:'Coordenador', vice:'Vice-Diretor', diretor:'Diretor',
};
const GESTAO = ['poc','coordenador','vice','diretor'];

let modalEl  = null;
let msgListEl = null;
let inputEl  = null;
let occAtual = null;
let usuarioAtual = null;
let todosChats = {};  // String(occId) → [msgs]

// Pré-cria o modal assim que o DOM carrega
document.addEventListener('DOMContentLoaded', () => _criarModal());

// ─── PÚBLICO ──────────────────────────────────────────────────────────────────

export function sincronizarChats(chatsServidor) {
  if (!chatsServidor) return;
  Object.keys(chatsServidor).forEach(k => {
    const chave = String(k);
    const novo = chatsServidor[k] || [];
    const existente = todosChats[chave] || [];
    const mapa = {};
    [...existente, ...novo].forEach(m => { mapa[String(m.id)] = m; });
    todosChats[chave] = Object.values(mapa).sort((a,b) => Number(a.id) - Number(b.id));
  });
}

export function receberMsgChat(msg) {
  const chave = String(msg.occId);
  if (!todosChats[chave]) todosChats[chave] = [];

  // Evita duplicata
  const jaExiste = todosChats[chave].some(m => String(m.id) === String(msg.id));
  if (!jaExiste) {
    todosChats[chave].push(msg);
    todosChats[chave].sort((a,b) => Number(a.id) - Number(b.id));
  }

  // Se o chat desta ocorrência está aberto, atualiza
  if (occAtual && String(occAtual.id) === chave && modalEl?.classList.contains('show')) {
    _renderMsgs();
    _scrollBottom();
    // Libera professor se gestão acabou de falar
    if (usuarioAtual && !GESTAO.includes(usuarioAtual.perfil) && GESTAO.includes(msg.remetentePerfil)) {
      _liberarInput();
    }
  }
}

export function iniciarChat(occ, usuario, chatsExistentes) {
  occAtual     = occ;
  usuarioAtual = usuario;

  // Sincroniza histórico antes de abrir
  if (chatsExistentes) sincronizarChats(chatsExistentes);

  if (!modalEl) _criarModal();

  // Verifica se professor pode responder
  const msgsDoChat   = todosChats[String(occ.id)] || [];
  const gestaoFalou  = msgsDoChat.some(m => GESTAO.includes(m.remetentePerfil));
  const podeEnviar   = GESTAO.includes(usuario.perfil) || gestaoFalou;

  // Atualiza cabeçalho
  modalEl.querySelector('#chat-titulo').textContent =
    `Chat — Ocorrência #${occ.id} · Art. ${occ.numero}`;
  modalEl.querySelector('#chat-subtitulo').textContent =
    `${occ.turma} · ${occ.data} às ${occ.hora} · ${occ.tipo}`;

  if (podeEnviar) {
    _liberarInput();
  } else {
    _bloquearInput('⏳ Aguardando a equipe gestora iniciar a conversa.');
  }

  modalEl.classList.add('show');
  _renderMsgs();
  _scrollBottom();
}

export function fecharChat() {
  if (modalEl) modalEl.classList.remove('show');
  occAtual = null;
}

// ─── PRIVADO ──────────────────────────────────────────────────────────────────

function _liberarInput() {
  const ia = modalEl?.querySelector('#chat-input-area');
  const bl = modalEl?.querySelector('#chat-bloqueado');
  if (ia) ia.style.display = 'flex';
  if (bl) bl.style.display = 'none';
}

function _bloquearInput(msg) {
  const ia = modalEl?.querySelector('#chat-input-area');
  const bl = modalEl?.querySelector('#chat-bloqueado');
  if (ia) ia.style.display = 'none';
  if (bl) { bl.style.display = 'block'; bl.textContent = msg; }
}

function _criarModal() {
  if (modalEl) return;
  modalEl = document.createElement('div');
  modalEl.className = 'mo-chat';
  modalEl.innerHTML = `
    <div class="chat-box">
      <div class="chat-header">
        <div>
          <h3 id="chat-titulo">Chat</h3>
          <p id="chat-subtitulo"></p>
        </div>
        <button onclick="window._fecharChat()">✕</button>
      </div>
      <div class="chat-msgs" id="chat-msgs">
        <div class="sem-msgs">Nenhuma mensagem ainda.</div>
      </div>
      <div class="chat-input-area" id="chat-input-area" style="display:none">
        <textarea id="chat-input" placeholder="Digite sua mensagem..." rows="1"
          onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();window._enviarChatMsg();}"></textarea>
        <button onclick="window._enviarChatMsg()" title="Enviar">➤</button>
      </div>
      <div class="chat-bloqueado" id="chat-bloqueado" style="display:none"></div>
    </div>`;

  modalEl.addEventListener('click', e => { if (e.target === modalEl) fecharChat(); });
  document.body.appendChild(modalEl);
  msgListEl = modalEl.querySelector('#chat-msgs');
  inputEl   = modalEl.querySelector('#chat-input');

  window._fecharChat    = fecharChat;
  window._enviarChatMsg = _enviarMensagem;
}

function _renderMsgs() {
  if (!msgListEl || !occAtual) return;
  const msgs = todosChats[String(occAtual.id)] || [];
  msgListEl.innerHTML = msgs.length
    ? msgs.map(m => _htmlMsg(m)).join('')
    : '<div class="sem-msgs">Nenhuma mensagem ainda.<br>Aguardando início da conversa.</div>';
}

function _htmlMsg(msg) {
  // Comparação segura de ID (número ou string)
  const meu = usuarioAtual && String(msg.remetenteId) === String(usuarioAtual.id);
  const cargo = PL[msg.remetentePerfil] || msg.remetentePerfil;
  return `<div class="msg-row ${meu ? 'meu' : 'outro'}">
    <div class="msg-bubble">${_escape(msg.texto)}</div>
    <div class="msg-meta">${meu
      ? ''
      : `<strong>${(msg.remetenteNome||'').split(' ')[0]}</strong> (${cargo}) · `
    }${msg.hora}</div>
  </div>`;
}

function _enviarMensagem() {
  if (!inputEl || !occAtual || !usuarioAtual) return;
  const texto = inputEl.value.trim();
  if (!texto) return;
  enviar({
    type: 'chat_msg',
    occId: occAtual.id,
    texto,
    remetenteId:    usuarioAtual.id,
    remetenteNome:  usuarioAtual.nome,
    remetentePerfil:usuarioAtual.perfil,
  });
  inputEl.value = '';
  inputEl.style.height = 'auto';
}

function _scrollBottom() {
  if (msgListEl) msgListEl.scrollTop = msgListEl.scrollHeight;
}

function _escape(str) {
  return String(str||'')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/\n/g,'<br>');
}
