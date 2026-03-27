// ws.js — gerencia conexão WebSocket com token JWT
let socket = null;
let reconectando = false;
let tentativas = 0;
const handlers = {};

export function onEvento(tipo, fn) { handlers[tipo] = fn; }
function disparar(tipo, dados) { if (handlers[tipo]) handlers[tipo](dados); }

export function conectar(token) {
  if (socket && socket.readyState === WebSocket.OPEN) return;

  // Garante protocolo correto — wss para https, ws para http
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const url = `${proto}://${location.host}`;
  console.log(`[WS] Conectando em ${url}...`);

  try {
    socket = new WebSocket(url);
  } catch(e) {
    console.error('[WS] Erro ao criar WebSocket:', e);
    _agendar(token);
    return;
  }

  socket.onopen = () => {
    reconectando = false;
    tentativas = 0;
    console.log('[WS] Conectado!');
    socket.send(JSON.stringify({ type: 'auth', token }));
    disparar('status', 'conectado');

    // Keepalive — envia mensagem a cada 20s para evitar timeout do Railway
    const keepalive = setInterval(() => {
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'ping' }));
      } else {
        clearInterval(keepalive);
      }
    }, 20000);
  };

  socket.onmessage = (ev) => {
    let msg; try { msg = JSON.parse(ev.data); } catch { return; }
    disparar(msg.type, msg);
  };

  // Responde ao ping do servidor para manter conexão viva no Railway
  socket.addEventListener('message', (ev) => {
    if (ev.data === 'ping') socket.send('pong');
  });

  socket.onclose = (e) => {
    console.log('[WS] Desconectado. Código:', e.code);
    disparar('status', 'desconectado');
    _agendar(token);
  };

  socket.onerror = (e) => {
    console.error('[WS] Erro:', e);
    disparar('status', 'erro');
  };
}

function _agendar(token) {
  if (reconectando) return;
  reconectando = true;
  tentativas++;
  // Espera progressiva: 3s, 5s, 10s, máximo 15s
  const espera = Math.min(3000 * Math.min(tentativas, 3), 15000);
  console.log(`[WS] Reconectando em ${espera/1000}s... (tentativa ${tentativas})`);
  setTimeout(() => {
    reconectando = false;
    const t = localStorage.getItem('ocorrencias_token');
    if (t) conectar(t);
  }, espera);
}

export function enviar(payload) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(payload)); return true;
  }
  console.warn('[WS] Não conectado. Mensagem não enviada.');
  return false;
}

export function getStatus() {
  if (!socket) return 'desconectado';
  const s = socket.readyState;
  if (s === WebSocket.OPEN) return 'conectado';
  if (s === WebSocket.CONNECTING) return 'conectando';
  return 'desconectado';
}

// Encerra conexão sem reconectar (chamado no logout)
export function desconectar() {
  reconectando = true; // bloqueia _agendar temporariamente
  if (socket) {
    socket.onclose = null; // remove o handler que dispara reconexão
    socket.close();
    socket = null;
  }
  reconectando = false;
  tentativas = 0;
}
