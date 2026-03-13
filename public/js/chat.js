// chat.js — componente de chat entre usuários

import { enviar } from './ws.js';

const PL = {
  professor:'Professor',
  poc:'P.O.C.',
  coordenador:'Coordenador',
  vice:'Vice-Diretor',
  diretor:'Diretor',
};

let modalEl = null;
let msgListEl = null;
let inputEl = null;
let occAtual = null;
let usuarioAtual = null;
let todosChats = {};  // occId → [msgs]

export function iniciarChat(occ, usuario, chatsExistentes) {
  occAtual = occ;
  usuarioAtual = usuario;
  // Sempre usa a versão mais completa de cada chat
  if (chatsExistentes) {
    Object.keys(chatsExistentes).forEach(k => {
      const existente = todosChats[k] || [];
      const novo = chatsExistentes[k] || [];
      // Mescla sem duplicar — usa id da mensagem como chave
      const mapa = {};
      [...existente, ...novo].forEach(m => { mapa[m.id] = m; });
      todosChats[k] = Object.values(mapa).sort((a,b) => a.id - b.id);
    });
  }

  if (!modalEl) _criarModal();

  const perfisGestao = ['poc','coordenador','vice','diretor'];
  const ehGestao = perfisGestao.includes(usuario.perfil);

  // Título
  modalEl.querySelector('#chat-titulo').textContent =
    `Chat — Ocorrência #${occ.id} · Art. ${occ.numero}`;
  modalEl.querySelector('#chat-subtitulo').textContent =
    `${occ.turma} · ${occ.data} às ${occ.hora} · ${occ.tipo}`;

  // Verifica se gestão já iniciou a conversa
  const msgsDoChat = (chatsExistentes && chatsExistentes[String(occ.id)]) || [];
  const gestaoJaFalou = msgsDoChat.some(m => perfisGestao.includes(m.remetentePerfil));

  // Professor só pode responder se gestão já enviou mensagem
  const podeEnviar = ehGestao || gestaoJaFalou;

  // Área de input
  const inputArea = modalEl.querySelector('#chat-input-area');
  const bloqueado = modalEl.querySelector('#chat-bloqueado');
  if (podeEnviar) {
    inputArea.style.display = 'flex';
    bloqueado.style.display = 'none';
  } else {
    inputArea.style.display = 'none';
    bloqueado.style.display = 'block';
    bloqueado.textContent = '⏳ Aguardando a equipe gestora iniciar a conversa.';
  }

  modalEl.classList.add('show');
  _renderMsgs();
  _scrollBottom();
}

export function fecharChat() {
  if (modalEl) modalEl.classList.remove('show');
  occAtual = null;
}

// Recebe nova mensagem do servidor via WebSocket
export function receberMsgChat(msg) {
  const id = String(msg.occId);
  if (!todosChats[id]) todosChats[id] = [];

  // Evita duplicatas: não adiciona se mensagem com mesmo id já existe
  const jaExiste = todosChats[id].some(m => m.id === msg.id);
  if (!jaExiste) todosChats[id].push(msg);

  if (occAtual && String(occAtual.id) === id && modalEl.classList.contains('show')) {
    // Só renderiza na tela se for mensagem nova
    if (!jaExiste) {
      _adicionarMsg(msg);
      _scrollBottom();
    }

    // Se professor estava bloqueado e gestão acabou de falar, libera o input
    const perfisGestao = ['poc','coordenador','vice','diretor'];
    if (!perfisGestao.includes(usuarioAtual.perfil) && perfisGestao.includes(msg.remetentePerfil)) {
      const inputArea = modalEl.querySelector('#chat-input-area');
      const bloqueado = modalEl.querySelector('#chat-bloqueado');
      if (inputArea) inputArea.style.display = 'flex';
      if (bloqueado) bloqueado.style.display = 'none';
    }
  }
}

// ─── PRIVADO ──────────────────────────────────────────────────────────────────

function _criarModal() {
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
        <div class="sem-msgs">Nenhuma mensagem ainda.<br>Inicie a conversa com o professor.</div>
      </div>
      <div class="chat-input-area" id="chat-input-area" style="display:none">
        <textarea id="chat-input" placeholder="Digite sua mensagem..." rows="1"
          onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();window._enviarChatMsg();}"></textarea>
        <button onclick="window._enviarChatMsg()" title="Enviar">➤</button>
      </div>
      <div class="chat-bloqueado" id="chat-bloqueado" style="display:none"></div>
    </div>`;

  // Fecha ao clicar fora
  modalEl.addEventListener('click', (e) => {
    if (e.target === modalEl) fecharChat();
  });

  document.body.appendChild(modalEl);
  msgListEl = modalEl.querySelector('#chat-msgs');
  inputEl = modalEl.querySelector('#chat-input');

  // Expõe funções globais para onclick no HTML
  window._fecharChat = fecharChat;
  window._enviarChatMsg = _enviarMensagem;
}

function _renderMsgs() {
  if (!msgListEl || !occAtual) return;
  const id = String(occAtual.id);
  const msgs = todosChats[id] || [];
  msgListEl.innerHTML = msgs.length
    ? msgs.map(m => _htmlMsg(m)).join('')
    : '<div class="sem-msgs">Nenhuma mensagem ainda.<br>Inicie a conversa com o professor.</div>';
}

function _adicionarMsg(msg) {
  if (!msgListEl) return;
  const semMsgs = msgListEl.querySelector('.sem-msgs');
  if (semMsgs) semMsgs.remove();
  const div = document.createElement('div');
  div.innerHTML = _htmlMsg(msg);
  msgListEl.appendChild(div.firstElementChild);
}

function _htmlMsg(msg) {
  const meu = msg.remetenteId === usuarioAtual.id;
  const cargo = PL[msg.remetentePerfil] || msg.remetentePerfil;
  return `<div class="msg-row ${meu ? 'meu' : 'outro'}">
    <div class="msg-bubble">${_escape(msg.texto)}</div>
    <div class="msg-meta">${meu ? '' : `<strong>${msg.remetenteNome.split(' ')[0]}</strong> (${cargo}) · `}${msg.hora}</div>
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
    remetenteId: usuarioAtual.id,
    remetenteNome: usuarioAtual.nome,
    remetentePerfil: usuarioAtual.perfil,
  });

  inputEl.value = '';
  inputEl.style.height = 'auto';
}

function _scrollBottom() {
  if (msgListEl) msgListEl.scrollTop = msgListEl.scrollHeight;
}

function _escape(str) {
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/\n/g,'<br>');
}
