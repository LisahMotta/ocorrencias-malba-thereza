// toast.js — substitui alert() nativo por toasts estilizados
let wrap = null;

function getWrap() {
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.className = 'toast-wrap';
    document.body.appendChild(wrap);
  }
  return wrap;
}

// tipo: 'success' | 'error' | 'warn' | 'info'
export function toast(mensagem, tipo = 'info', duracao = 4000) {
  const ICONES = { success: '✅', error: '❌', warn: '⚠️', info: 'ℹ️' };

  const el = document.createElement('div');
  el.className = `toast toast-${tipo}`;

  el.innerHTML = `
    <span class="toast-icon">${ICONES[tipo] || 'ℹ️'}</span>
    <span class="toast-msg">${mensagem}</span>
    <button class="toast-close" title="Fechar">✕</button>
    <div class="toast-bar"></div>`;

  const fechar = () => {
    el.classList.add('toast-saindo');
    el.addEventListener('animationend', () => el.remove(), { once: true });
  };

  el.querySelector('.toast-close').addEventListener('click', fechar);

  getWrap().appendChild(el);

  // Barra de progresso animada via CSS custom property
  el.style.setProperty('--dur', duracao + 'ms');

  if (duracao > 0) {
    setTimeout(fechar, duracao);
  }

  return fechar; // permite fechar programaticamente
}

export const toastOk    = (msg) => toast(msg, 'success', 4000);
export const toastErro  = (msg) => toast(msg, 'error',   6000);
export const toastAviso = (msg) => toast(msg, 'warn',    5000);
