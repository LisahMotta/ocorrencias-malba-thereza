// ws.js — gerencia conexão WebSocket com token JWT
let socket = null;
let reconectando = false;
const handlers = {};

export function onEvento(tipo, fn) { handlers[tipo] = fn; }
function disparar(tipo, dados) { if (handlers[tipo]) handlers[tipo](dados); }

export function conectar(token) {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  socket = new WebSocket(`${proto}://${location.host}`);

  socket.onopen = () => {
    reconectando = false;
    socket.send(JSON.stringify({ type: 'auth', token }));
    disparar('status', 'conectado');
  };
  socket.onmessage = (ev) => {
    let msg; try { msg = JSON.parse(ev.data); } catch { return; }
    disparar(msg.type, msg);
  };
  socket.onclose = () => {
    disparar('status', 'desconectado');
    if (!reconectando) {
      reconectando = true;
      const t = localStorage.getItem('token');
      if (t) setTimeout(() => conectar(t), 3000);
    }
  };
  socket.onerror = () => disparar('status', 'erro');
}

export function enviar(payload) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(payload)); return true;
  }
  return false;
}
