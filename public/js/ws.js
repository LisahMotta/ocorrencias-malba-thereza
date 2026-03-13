// ws.js — gerencia conexão WebSocket com o servidor

let socket = null;
let reconectando = false;

// Callbacks registrados pelo app
const handlers = {};

export function onEvento(tipo, fn) {
  handlers[tipo] = fn;
}

function disparar(tipo, dados) {
  if (handlers[tipo]) handlers[tipo](dados);
}

export function conectar(userId) {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const url = `${proto}://${location.host}`;
  socket = new WebSocket(url);

  socket.onopen = () => {
    reconectando = false;
    socket.send(JSON.stringify({ type: 'auth', userId }));
    disparar('status', 'conectado');
  };

  socket.onmessage = (ev) => {
    let msg;
    try { msg = JSON.parse(ev.data); } catch { return; }
    disparar(msg.type, msg);
    disparar('qualquer', msg);
  };

  socket.onclose = () => {
    disparar('status', 'desconectado');
    if (!reconectando) {
      reconectando = true;
      setTimeout(() => conectar(userId), 3000);
    }
  };

  socket.onerror = () => {
    disparar('status', 'erro');
  };
}

export function enviar(payload) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(payload));
    return true;
  }
  return false;
}
